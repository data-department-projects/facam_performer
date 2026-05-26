import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useCommittees } from "@/contexts/CommitteesContext";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { Department, TeamMember, Milestone } from "@/data/departments";
import { Project, ProjectCollaborator, ProjectMilestone } from "@/data/projects";
import { Committee, CommitteeMember } from "@/data/committees";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

type ImportType = "departments" | "members" | "milestones" | "projects" | "project_collaborators" | "project_milestones" | "committees" | "committee_members" | "timeentries";

interface SheetPreview {
  type: ImportType;
  label: string;
  data: any[];
  errors: string[];
  selected: boolean;
}

// ── Parsers ──────────────────────────────────────────────────

const parseDepartmentsSheet = (rows: any[]): Department[] => {
  return rows.filter(r => r["id"]).map((r, i) => ({
    id: String(r["id"]).trim(),
    name: String(r["nom"] || "").trim(),
    nameTomorrow: String(r["nom_cible_2027"] || r["nom"] || "").trim(),
    icon: String(r["icone"] || "🏢").trim(),
    color: String(r["couleur"] || "hsl(200 50% 50%)").trim(),
    head: String(r["responsable"] || "").trim(),
    headRoleToday: String(r["role_actuel"] || "Responsable").trim(),
    headRoleTomorrow: String(r["role_cible_2027"] || "Directeur").trim(),
    missionToday: String(r["mission_actuelle"] || "").trim(),
    missionTomorrow: String(r["mission_cible_2027"] || "").trim(),
    services: String(r["services"] || "").split(";").map(s => s.trim()).filter(Boolean).map(s => ({ name: s })),
    compositionToday: [],
    compositionTomorrow: [],
    milestones2026: [],
    milestones2027: [],
    nameChangesTomorrow: false,
    decomposesTomorrow: false,
    futureDepartments: [],
    newDirectionName: "",
  }));
};

const parseMembersSheet = (rows: any[]): { deptId: string; period: string; member: TeamMember }[] => {
  return rows.filter(r => r["departement_id"] && r["nom"]).map(r => ({
    deptId: String(r["departement_id"]).trim(),
    period: String(r["periode"] || "aujourd'hui").trim().toLowerCase(),
    member: {
      name: String(r["nom"]).trim(),
      role: String(r["role"] || "").trim(),
      services: String(r["services_attribues"] || "").split(";").map(s => s.trim()).filter(Boolean),
    },
  }));
};

const parseMilestonesSheet = (rows: any[]): { deptId: string; year: string; ms: Milestone }[] => {
  return rows.filter(r => r["departement_id"] && r["titre"]).map(r => ({
    deptId: String(r["departement_id"]).trim(),
    year: String(r["annee"] || "2026").trim(),
    ms: {
      quarter: `${String(r["trimestre"] || "Q1").trim()} ${String(r["annee"] || "2026").trim()}`,
      title: String(r["titre"]).trim(),
      description: String(r["description"] || "").trim(),
      status: (String(r["statut"] || "planned").trim().toLowerCase() as Milestone["status"]),
    },
  }));
};

const parseProjectsSheet = (rows: any[]): Project[] => {
  return rows.filter(r => r["id"]).map(r => ({
    id: String(r["id"]).trim(),
    name: String(r["nom"] || "").trim(),
    description: String(r["description"] || "").trim(),
    objective: String(r["objectif"] || "").trim(),
    projectLead: String(r["responsable"] || "").split(";").map(s => s.trim()).filter(Boolean),
    departmentIds: String(r["departements"] || "").split(";").map(s => s.trim()).filter(Boolean),
    responsibles: String(r["responsables"] || "").split(";").map(s => s.trim()).filter(Boolean),
    collaborators: [],
    color: String(r["couleur"] || "hsl(200 50% 50%)").trim(),
    milestones: [],
    createdAt: String(r["date_creation"] || new Date().toISOString().split("T")[0]).trim(),
  }));
};

const parseProjectCollaboratorsSheet = (rows: any[]): { projectId: string; collab: ProjectCollaborator }[] => {
  return rows.filter(r => r["projet_id"] && r["nom"]).map(r => ({
    projectId: String(r["projet_id"]).trim(),
    collab: {
      name: String(r["nom"]).trim(),
      role: String(r["role"] || "").trim(),
      department: String(r["departement"] || "").trim(),
    },
  }));
};

const parseProjectMilestonesSheet = (rows: any[]): { projectId: string; ms: ProjectMilestone }[] => {
  return rows.filter(r => r["projet_id"] && r["titre"]).map((r, i) => ({
    projectId: String(r["projet_id"]).trim(),
    ms: {
      id: `m-import-${Date.now()}-${i}`,
      quarter: String(r["trimestre"] || "Q1 2026").trim(),
      title: String(r["titre"]).trim(),
      description: String(r["description"] || "").trim(),
      status: (String(r["statut"] || "planned").trim().toLowerCase() as ProjectMilestone["status"]),
      deadline: String(r["deadline"] || "").trim() || undefined,
      createdAt: String(r["date_creation"] || new Date().toISOString().split("T")[0]).trim(),
    },
  }));
};

const parseCommitteesSheet = (rows: any[]): Committee[] => {
  return rows.filter(r => r["id"]).map(r => ({
    id: String(r["id"]).trim(),
    name: String(r["nom"] || "").trim(),
    icon: String(r["icone"] || "📋").trim(),
    purpose: String(r["objet"] || "").trim(),
    responsible: String(r["responsable"] || "").trim(),
    frequency: (String(r["frequence"] || "mensuel").trim().toLowerCase() as Committee["frequency"]),
    linkedDepartmentIds: String(r["departements"] || "").split(";").map(s => s.trim()).filter(Boolean),
    members: [],
    guests: String(r["invites"] || "").split(";").map(s => s.trim()).filter(Boolean),
    institutions: String(r["institutions"] || "").split(";").map(s => s.trim()).filter(Boolean),
  }));
};

const parseCommitteeMembersSheet = (rows: any[]): { comId: string; member: CommitteeMember }[] => {
  return rows.filter(r => r["comite_id"] && r["nom"]).map(r => ({
    comId: String(r["comite_id"]).trim(),
    member: {
      name: String(r["nom"]).trim(),
      role: String(r["role"] || "").trim(),
      departmentId: String(r["departement_id"] || "").trim() || undefined,
    },
  }));
};

const parseTimeEntriesSheet = (rows: any[]): any[] => {
  return rows.filter(r => r["projet_id"] && r["collaborateur"] && r["date"]).map(r => ({
    projectId: String(r["projet_id"]).trim(),
    collaboratorName: String(r["collaborateur"]).trim(),
    date: String(r["date"]).trim(),
    startTime: String(r["heure_debut"] || "09:00").trim(),
    endTime: String(r["heure_fin"] || "17:00").trim(),
  }));
};

// ── Sheet config for template generation ──────────────────────

const SHEET_CONFIGS: { type: ImportType; sheetName: string; label: string; headers: string[]; examples: any[] }[] = [
  {
    type: "departments", sheetName: "Départements", label: "Départements",
    headers: ["id", "nom", "nom_cible_2027", "icone", "couleur", "responsable", "role_actuel", "role_cible_2027", "mission_actuelle", "mission_cible_2027", "services"],
    examples: [
      { id: "tech", nom: "Département Technologie", nom_cible_2027: "Direction Tech & Innovation", icone: "💻", couleur: "hsl(222 60% 50%)", responsable: "Marc Dupont", role_actuel: "Responsable SI", role_cible_2027: "Directeur Tech", mission_actuelle: "Gérer l'infrastructure IT", mission_cible_2027: "Piloter la transformation digitale", services: "Développement;Infrastructure;Support" },
      { id: "rh", nom: "Département RH", nom_cible_2027: "Direction People & Culture", icone: "👥", couleur: "hsl(175 50% 42%)", responsable: "Nadia Cherif", role_actuel: "DRH", role_cible_2027: "Chief People Officer", mission_actuelle: "Gérer les ressources humaines", mission_cible_2027: "Transformer l'expérience collaborateur", services: "Recrutement;Formation;Paie" },
    ],
  },
  {
    type: "members", sheetName: "Membres", label: "Membres départements",
    headers: ["departement_id", "nom", "role", "periode", "services_attribues"],
    examples: [
      { departement_id: "tech", nom: "Pierre Duval", role: "Lead Développeur", periode: "aujourd'hui", services_attribues: "Développement" },
      { departement_id: "tech", nom: "Sophie Martin", role: "Architecte Cloud", periode: "aujourd'hui", services_attribues: "Infrastructure" },
      { departement_id: "tech", nom: "Pierre Duval", role: "Head of Engineering", periode: "cible 2027", services_attribues: "Développement;Infrastructure" },
      { departement_id: "rh", nom: "Luc Moreau", role: "Chargé RH", periode: "aujourd'hui", services_attribues: "Recrutement" },
    ],
  },
  {
    type: "milestones", sheetName: "Jalons Départements", label: "Jalons départements",
    headers: ["departement_id", "titre", "description", "trimestre", "annee", "statut"],
    examples: [
      { departement_id: "tech", titre: "Migration Cloud", description: "Migration complète vers AWS", trimestre: "Q1", annee: "2026", statut: "done" },
      { departement_id: "tech", titre: "CI/CD Complet", description: "Pipeline automatisé", trimestre: "Q2", annee: "2026", statut: "in-progress" },
      { departement_id: "tech", titre: "Architecture Microservices", description: "Refonte architecture", trimestre: "Q1", annee: "2027", statut: "planned" },
      { departement_id: "rh", titre: "SIRH Digital", description: "Déploiement nouvel outil", trimestre: "Q1", annee: "2026", statut: "done" },
    ],
  },
  {
    type: "projects", sheetName: "Projets", label: "Projets",
    headers: ["id", "nom", "description", "objectif", "responsable", "departements", "responsables", "couleur", "date_creation"],
    examples: [
      { id: "proj-1", nom: "Migration Cloud", description: "Migration infrastructure vers le cloud", objectif: "Migrer 100% des systèmes critiques", responsable: "Marc Dupont", departements: "tech;finance", responsables: "Marc Dupont;François Blanc", couleur: "hsl(222 60% 22%)", date_creation: "2025-12-15" },
      { id: "proj-2", nom: "Transformation RH", description: "Digitalisation des processus RH", objectif: "Réduire de 50% le temps administratif", responsable: "Nadia Cherif", departements: "rh;tech", responsables: "Nadia Cherif;Sophie Martin", couleur: "hsl(175 50% 42%)", date_creation: "2025-12-20" },
    ],
  },
  {
    type: "project_collaborators", sheetName: "Collaborateurs Projets", label: "Collaborateurs projets",
    headers: ["projet_id", "nom", "role", "departement"],
    examples: [
      { projet_id: "proj-1", nom: "Pierre Duval", role: "Lead Infrastructure", departement: "tech" },
      { projet_id: "proj-1", nom: "Karim Benali", role: "Référent Finance", departement: "finance" },
      { projet_id: "proj-2", nom: "Luc Moreau", role: "Chef de projet RH", departement: "rh" },
    ],
  },
  {
    type: "project_milestones", sheetName: "Jalons Projets", label: "Jalons projets",
    headers: ["projet_id", "titre", "description", "trimestre", "statut", "deadline", "date_creation"],
    examples: [
      { projet_id: "proj-1", titre: "Audit infrastructure", description: "Évaluation complète", trimestre: "Q1 2026", statut: "done", deadline: "2026-03-31", date_creation: "2025-12-15" },
      { projet_id: "proj-1", titre: "Migration serveurs", description: "Migration des serveurs critiques", trimestre: "Q2 2026", statut: "in-progress", deadline: "2026-06-30", date_creation: "2025-12-15" },
      { projet_id: "proj-2", titre: "SIRH Digital", description: "Déploiement du SIRH", trimestre: "Q1 2026", statut: "done", deadline: "2026-03-15", date_creation: "2025-12-20" },
    ],
  },
  {
    type: "committees", sheetName: "Comités", label: "Comités",
    headers: ["id", "nom", "icone", "objet", "responsable", "frequence", "departements", "invites", "institutions"],
    examples: [
      { id: "com-dir", nom: "Comité de Direction", icone: "👔", objet: "Pilotage stratégique de l'organisation", responsable: "Marc Dupont", frequence: "hebdomadaire", departements: "tech;rh;finance;marketing", invites: "", institutions: "" },
      { id: "com-tech", nom: "Comité Tech", icone: "💻", objet: "Coordination technique et architecture", responsable: "Pierre Duval", frequence: "bimensuel", departements: "tech", invites: "Consultant externe", institutions: "" },
    ],
  },
  {
    type: "committee_members", sheetName: "Membres Comités", label: "Membres comités",
    headers: ["comite_id", "nom", "role", "departement_id"],
    examples: [
      { comite_id: "com-dir", nom: "Marc Dupont", role: "Directeur Tech", departement_id: "tech" },
      { comite_id: "com-dir", nom: "Nadia Cherif", role: "DRH", departement_id: "rh" },
      { comite_id: "com-tech", nom: "Pierre Duval", role: "Lead Dev", departement_id: "tech" },
    ],
  },
  {
    type: "timeentries", sheetName: "Saisies Temps", label: "Saisies de temps",
    headers: ["projet_id", "collaborateur", "date", "heure_debut", "heure_fin", "heures_travaillees", "commentaire"],
    examples: [
      { projet_id: "proj-1", collaborateur: "Pierre Duval", date: "2026-03-01", heure_debut: "09:00", heure_fin: "17:30", heures_travaillees: "8.5", commentaire: "Travail sur le livrable X" },
      { projet_id: "proj-1", collaborateur: "Sophie Martin", date: "2026-03-01", heure_debut: "08:30", heure_fin: "16:00", heures_travaillees: "7.5", commentaire: "Réunion client" },
      { projet_id: "proj-2", collaborateur: "Luc Moreau", date: "2026-03-02", heure_debut: "09:00", heure_fin: "12:30", heures_travaillees: "3.5", commentaire: "Formation interne" },
    ],
  },
];

// ── Sheet name to type mapping ──────────────────────────────

const SHEET_NAME_MAP: Record<string, ImportType> = {};
SHEET_CONFIGS.forEach(c => { SHEET_NAME_MAP[c.sheetName.toLowerCase()] = c.type; });

// ── Component ──────────────────────────────────────────────

const ImportExcel = () => {
  const { addDepartment, departments } = useDepartments();
  const { addProject } = useProjects();
  const { addCommittee } = useCommittees();
  const { addEntry } = useTimeTracking();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [previews, setPreviews] = useState<SheetPreview[]>([]);
  const [importing, setImporting] = useState(false);

  const downloadFullTemplate = () => {
    const wb = XLSX.utils.book_new();
    SHEET_CONFIGS.forEach(cfg => {
      const ws = XLSX.utils.json_to_sheet(cfg.examples, { header: cfg.headers });
      // Set column widths
      ws["!cols"] = cfg.headers.map(h => ({ wch: Math.max(h.length + 2, 18) }));
      XLSX.utils.book_append_sheet(wb, ws, cfg.sheetName);
    });
    XLSX.writeFile(wb, "modele_import_complet.xlsx");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);

    const results: SheetPreview[] = [];

    wb.SheetNames.forEach(sheetName => {
      const sheet = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);
      if (rows.length === 0) return;

      const type = SHEET_NAME_MAP[sheetName.toLowerCase()];
      if (!type) return;

      const cfg = SHEET_CONFIGS.find(c => c.type === type);
      if (!cfg) return;

      let parsedData: any[] = [];
      try {
        switch (type) {
          case "departments": parsedData = parseDepartmentsSheet(rows); break;
          case "members": parsedData = parseMembersSheet(rows); break;
          case "milestones": parsedData = parseMilestonesSheet(rows); break;
          case "projects": parsedData = parseProjectsSheet(rows); break;
          case "project_collaborators": parsedData = parseProjectCollaboratorsSheet(rows); break;
          case "project_milestones": parsedData = parseProjectMilestonesSheet(rows); break;
          case "committees": parsedData = parseCommitteesSheet(rows); break;
          case "committee_members": parsedData = parseCommitteeMembersSheet(rows); break;
          case "timeentries": parsedData = parseTimeEntriesSheet(rows); break;
        }
      } catch (err) {
        // skip
      }

      results.push({
        type,
        label: cfg.label,
        data: parsedData,
        errors: [],
        selected: parsedData.length > 0,
      });
    });

    if (results.length === 0) {
      toast({ title: "Aucun onglet reconnu", description: "Vérifiez que les noms d'onglets correspondent au modèle.", variant: "destructive" });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setPreviews(results);
    setOpen(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggleSheet = (type: ImportType) => {
    setPreviews(prev => prev.map(p => p.type === type ? { ...p, selected: !p.selected } : p));
  };

  const confirmImport = () => {
    setImporting(true);
    try {
      const selected = previews.filter(p => p.selected && p.data.length > 0);

      // 1. Departments first
      const deptSheet = selected.find(s => s.type === "departments");
      const newDepts: Department[] = deptSheet?.data ?? [];

      // 2. Apply members to departments
      const membersSheet = selected.find(s => s.type === "members");
      if (membersSheet) {
        membersSheet.data.forEach(({ deptId, period, member }: any) => {
          const dept = newDepts.find(d => d.id === deptId);
          if (dept) {
            if (period.includes("cible") || period.includes("2027")) {
              dept.compositionTomorrow.push(member);
            } else {
              dept.compositionToday.push(member);
            }
          }
        });
      }

      // 3. Apply milestones to departments
      const msSheet = selected.find(s => s.type === "milestones");
      if (msSheet) {
        msSheet.data.forEach(({ deptId, year, ms }: any) => {
          const dept = newDepts.find(d => d.id === deptId);
          if (dept) {
            if (year.includes("2027")) {
              dept.milestones2027.push(ms);
            } else {
              dept.milestones2026.push(ms);
            }
          }
        });
      }

      // Add departments
      newDepts.forEach(d => addDepartment(d));

      // 4. Projects
      const projSheet = selected.find(s => s.type === "projects");
      const newProjects: Project[] = projSheet?.data ?? [];

      // Apply collaborators
      const pcSheet = selected.find(s => s.type === "project_collaborators");
      if (pcSheet) {
        pcSheet.data.forEach(({ projectId, collab }: any) => {
          const proj = newProjects.find(p => p.id === projectId);
          if (proj) proj.collaborators.push(collab);
        });
      }

      // Apply milestones
      const pmSheet = selected.find(s => s.type === "project_milestones");
      if (pmSheet) {
        pmSheet.data.forEach(({ projectId, ms }: any) => {
          const proj = newProjects.find(p => p.id === projectId);
          if (proj) proj.milestones.push(ms);
        });
      }

      newProjects.forEach(p => addProject(p));

      // 5. Committees
      const comSheet = selected.find(s => s.type === "committees");
      const newComs: Committee[] = comSheet?.data ?? [];

      const cmSheet = selected.find(s => s.type === "committee_members");
      if (cmSheet) {
        cmSheet.data.forEach(({ comId, member }: any) => {
          const com = newComs.find(c => c.id === comId);
          if (com) com.members.push(member);
        });
      }

      newComs.forEach(c => addCommittee(c));

      // 6. Time entries
      const teSheet = selected.find(s => s.type === "timeentries");
      if (teSheet) {
        teSheet.data.forEach((e: any) => addEntry(e, ""));
      }

      const totalItems = selected.reduce((s, p) => s + p.data.length, 0);
      toast({ title: "Import réussi ✓", description: `${totalItems} élément(s) importé(s) depuis ${selected.length} onglet(s).` });
      setOpen(false);
      setPreviews([]);
    } catch (err) {
      toast({ title: "Erreur", description: "Erreur lors de l'import.", variant: "destructive" });
    }
    setImporting(false);
  };

  const totalSelected = previews.filter(p => p.selected).reduce((s, p) => s + p.data.length, 0);

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={downloadFullTemplate}>
          <Download className="w-3.5 h-3.5" /> Modèle Excel
        </Button>
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => fileRef.current?.click()}>
          <Upload className="w-3.5 h-3.5" /> Importer
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Import multi-onglets — Prévisualisation
            </DialogTitle>
          </DialogHeader>

          {previews.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {previews.length} onglet(s) détecté(s). Sélectionnez ceux à importer.
              </p>

              <div className="space-y-2">
                {previews.map(p => (
                  <Card key={p.type} className={`transition-all ${p.selected ? "border-primary/40" : "opacity-60"}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={p.selected} onCheckedChange={() => toggleSheet(p.type)} />
                          <span className="text-sm font-medium">{p.label}</span>
                          <Badge variant="secondary" className="text-[10px]">{p.data.length} ligne(s)</Badge>
                        </label>
                        {p.errors.length > 0 && (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-destructive" />
                            <span className="text-[10px] text-destructive">{p.errors.length} erreur(s)</span>
                          </div>
                        )}
                      </div>
                      {p.selected && p.data.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.data.slice(0, 6).map((item, i) => (
                            <Badge key={i} variant="outline" className="text-[9px]">
                              {item.name || item.nom || item.member?.name || item.collab?.name || item.ms?.title || item.collaboratorName || `#${i + 1}`}
                            </Badge>
                          ))}
                          {p.data.length > 6 && (
                            <Badge variant="outline" className="text-[9px]">+{p.data.length - 6}</Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-muted-foreground">{totalSelected} élément(s) sélectionné(s)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => { setOpen(false); setPreviews([]); }}>
                    Annuler
                  </Button>
                  <Button size="sm" className="text-xs gap-1.5" onClick={confirmImport} disabled={importing || totalSelected === 0}>
                    <Upload className="w-3 h-3" /> Importer
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Aucun fichier chargé</p>
              <p className="text-xs text-muted-foreground mb-4">
                Téléchargez d'abord le modèle Excel, remplissez-le, puis importez-le.
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={downloadFullTemplate}>
                  <Download className="w-3 h-3" /> Télécharger le modèle
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-3 h-3" /> Choisir un fichier
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImportExcel;
