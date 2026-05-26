import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useCommittees } from "@/contexts/CommitteesContext";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { useAuth } from "@/contexts/AuthContext";
import { Department, TeamMember, Milestone } from "@/data/departments";
import { Project, ProjectCollaborator, ProjectMilestone } from "@/data/projects";
import { Committee, CommitteeMember } from "@/data/committees";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Module to sheet type mapping
export type ModuleType = "dashboard" | "orgchart" | "roadmap" | "gantt" | "comites" | "projects" | "timeentry" | "reports";
type ImportType = "departments" | "members" | "milestones" | "projects" | "project_collaborators" | "project_milestones" | "committees" | "committee_members" | "timeentries";

interface SheetPreview {
  type: ImportType;
  label: string;
  data: any[];
  errors: string[];
  selected: boolean;
}

const MODULE_SHEETS: Record<ModuleType, ImportType[]> = {
  dashboard: ["departments", "members", "milestones", "projects", "project_collaborators", "project_milestones", "committees", "committee_members", "timeentries"],
  orgchart: ["departments", "members"],
  roadmap: ["departments", "members", "milestones"],
  gantt: ["projects", "project_milestones"],
  comites: ["committees", "committee_members"],
  projects: ["projects", "project_collaborators", "project_milestones"],
  timeentry: ["timeentries"],
  reports: [],
};

const SHEET_CONFIGS: { type: ImportType; sheetName: string; label: string; headers: string[]; examples: any[] }[] = [
  {
    type: "departments", sheetName: "Départements", label: "Départements",
    headers: ["id", "nom", "nom_cible_2027", "icone", "couleur", "responsable", "role_actuel", "role_cible_2027", "mission_actuelle", "mission_cible_2027", "services"],
    examples: [
      { id: "tech", nom: "Département Technologie", nom_cible_2027: "Direction Tech & Innovation", icone: "💻", couleur: "hsl(222 60% 50%)", responsable: "Marc Dupont", role_actuel: "Responsable SI", role_cible_2027: "Directeur Tech", mission_actuelle: "Gérer l'infrastructure IT", mission_cible_2027: "Piloter la transformation digitale", services: "Développement;Infrastructure;Support" },
    ],
  },
  {
    type: "members", sheetName: "Membres", label: "Membres départements",
    headers: ["departement_id", "nom", "role", "periode", "services_attribues"],
    examples: [
      { departement_id: "tech", nom: "Pierre Duval", role: "Lead Développeur", periode: "aujourd'hui", services_attribues: "Développement" },
    ],
  },
  {
    type: "milestones", sheetName: "Jalons Départements", label: "Jalons départements",
    headers: ["departement_id", "titre", "description", "trimestre", "annee", "statut"],
    examples: [
      { departement_id: "tech", titre: "Migration Cloud", description: "Migration complète vers AWS", trimestre: "Q1", annee: "2026", statut: "done" },
    ],
  },
  {
    type: "projects", sheetName: "Projets", label: "Projets",
    headers: ["id", "nom", "description", "objectif", "responsable", "departements", "responsables", "couleur", "date_creation"],
    examples: [
      { id: "proj-1", nom: "Migration Cloud", description: "Migration infrastructure vers le cloud", objectif: "Migrer 100% des systèmes critiques", responsable: "Marc Dupont", departements: "tech;finance", responsables: "Marc Dupont;François Blanc", couleur: "hsl(222 60% 22%)", date_creation: "2025-12-15" },
    ],
  },
  {
    type: "project_collaborators", sheetName: "Collaborateurs Projets", label: "Collaborateurs projets",
    headers: ["projet_id", "nom", "role", "departement"],
    examples: [
      { projet_id: "proj-1", nom: "Pierre Duval", role: "Lead Infrastructure", departement: "tech" },
    ],
  },
  {
    type: "project_milestones", sheetName: "Jalons Projets", label: "Jalons projets",
    headers: ["projet_id", "titre", "description", "trimestre", "statut", "deadline", "date_creation"],
    examples: [
      { projet_id: "proj-1", titre: "Audit infrastructure", description: "Évaluation complète", trimestre: "Q1 2026", statut: "done", deadline: "2026-03-31", date_creation: "2025-12-15" },
    ],
  },
  {
    type: "committees", sheetName: "Comités", label: "Comités",
    headers: ["id", "nom", "icone", "objet", "responsable", "frequence", "departements", "invites", "institutions"],
    examples: [
      { id: "com-dir", nom: "Comité de Direction", icone: "👔", objet: "Pilotage stratégique", responsable: "Marc Dupont", frequence: "hebdomadaire", departements: "tech;rh;finance", invites: "", institutions: "" },
    ],
  },
  {
    type: "committee_members", sheetName: "Membres Comités", label: "Membres comités",
    headers: ["comite_id", "nom", "role", "departement_id"],
    examples: [
      { comite_id: "com-dir", nom: "Marc Dupont", role: "Directeur Tech", departement_id: "tech" },
    ],
  },
  {
    type: "timeentries", sheetName: "Saisies Temps", label: "Saisies de temps",
    headers: ["projet_id", "collaborateur", "date", "heure_debut", "heure_fin", "heures_travaillees", "commentaire"],
    examples: [
      { projet_id: "proj-1", collaborateur: "Pierre Duval", date: "2026-03-01", heure_debut: "09:00", heure_fin: "17:30", heures_travaillees: "8.5", commentaire: "Travail sur le livrable X" },
    ],
  },
];

const SHEET_NAME_MAP: Record<string, ImportType> = {};
SHEET_CONFIGS.forEach(c => { SHEET_NAME_MAP[c.sheetName.toLowerCase()] = c.type; });

// Parsers
const parseDepartmentsSheet = (rows: any[]): Department[] =>
  rows.filter(r => r["id"]).map(r => ({
    id: String(r["id"]).trim(), name: String(r["nom"] || "").trim(), nameTomorrow: String(r["nom_cible_2027"] || r["nom"] || "").trim(),
    icon: String(r["icone"] || "🏢").trim(), color: String(r["couleur"] || "hsl(200 50% 50%)").trim(), head: String(r["responsable"] || "").trim(),
    headRoleToday: String(r["role_actuel"] || "Responsable").trim(), headRoleTomorrow: String(r["role_cible_2027"] || "Directeur").trim(),
    missionToday: String(r["mission_actuelle"] || "").trim(), missionTomorrow: String(r["mission_cible_2027"] || "").trim(),
    services: String(r["services"] || "").split(";").map(s => s.trim()).filter(Boolean).map(s => ({ name: s })),
    compositionToday: [], compositionTomorrow: [], milestones2026: [], milestones2027: [],
    nameChangesTomorrow: false, decomposesTomorrow: false, futureDepartments: [], newDirectionName: "",
  }));

const parseMembersSheet = (rows: any[]) =>
  rows.filter(r => r["departement_id"] && r["nom"]).map(r => ({
    deptId: String(r["departement_id"]).trim(),
    period: String(r["periode"] || "aujourd'hui").trim().toLowerCase(),
    member: { name: String(r["nom"]).trim(), role: String(r["role"] || "").trim(), services: String(r["services_attribues"] || "").split(";").map(s => s.trim()).filter(Boolean) },
  }));

const parseMilestonesSheet = (rows: any[]) =>
  rows.filter(r => r["departement_id"] && r["titre"]).map(r => ({
    deptId: String(r["departement_id"]).trim(), year: String(r["annee"] || "2026").trim(),
    ms: { quarter: `${String(r["trimestre"] || "Q1").trim()} ${String(r["annee"] || "2026").trim()}`, title: String(r["titre"]).trim(), description: String(r["description"] || "").trim(), status: String(r["statut"] || "planned").trim().toLowerCase() as Milestone["status"] },
  }));

const parseProjectsSheet = (rows: any[]): Project[] =>
  rows.filter(r => r["id"]).map(r => ({
    id: String(r["id"]).trim(), name: String(r["nom"] || "").trim(), description: String(r["description"] || "").trim(), objective: String(r["objectif"] || "").trim(),
    projectLead: String(r["responsable"] || "").split(";").map(s => s.trim()).filter(Boolean), departmentIds: String(r["departements"] || "").split(";").map(s => s.trim()).filter(Boolean),
    responsibles: String(r["responsables"] || "").split(";").map(s => s.trim()).filter(Boolean), collaborators: [],
    color: String(r["couleur"] || "hsl(200 50% 50%)").trim(), milestones: [], createdAt: String(r["date_creation"] || new Date().toISOString().split("T")[0]).trim(),
  }));

const parseProjectCollaboratorsSheet = (rows: any[]) =>
  rows.filter(r => r["projet_id"] && r["nom"]).map(r => ({
    projectId: String(r["projet_id"]).trim(),
    collab: { name: String(r["nom"]).trim(), role: String(r["role"] || "").trim(), department: String(r["departement"] || "").trim() },
  }));

const parseProjectMilestonesSheet = (rows: any[]) =>
  rows.filter(r => r["projet_id"] && r["titre"]).map((r, i) => ({
    projectId: String(r["projet_id"]).trim(),
    ms: { id: `m-import-${Date.now()}-${i}`, quarter: String(r["trimestre"] || "Q1 2026").trim(), title: String(r["titre"]).trim(), description: String(r["description"] || "").trim(),
      status: String(r["statut"] || "planned").trim().toLowerCase() as ProjectMilestone["status"], deadline: String(r["deadline"] || "").trim() || undefined, createdAt: String(r["date_creation"] || new Date().toISOString().split("T")[0]).trim() },
  }));

const parseCommitteesSheet = (rows: any[]): Committee[] =>
  rows.filter(r => r["id"]).map(r => ({
    id: String(r["id"]).trim(), name: String(r["nom"] || "").trim(), icon: String(r["icone"] || "📋").trim(),
    purpose: String(r["objet"] || "").trim(), responsible: String(r["responsable"] || "").trim(), frequency: String(r["frequence"] || "mensuel").trim().toLowerCase() as Committee["frequency"],
    linkedDepartmentIds: String(r["departements"] || "").split(";").map(s => s.trim()).filter(Boolean), members: [],
    guests: String(r["invites"] || "").split(";").map(s => s.trim()).filter(Boolean),
    institutions: String(r["institutions"] || "").split(";").map(s => s.trim()).filter(Boolean),
  }));

const parseCommitteeMembersSheet = (rows: any[]) =>
  rows.filter(r => r["comite_id"] && r["nom"]).map(r => ({
    comId: String(r["comite_id"]).trim(),
    member: { name: String(r["nom"]).trim(), role: String(r["role"] || "").trim(), departmentId: String(r["departement_id"] || "").trim() || undefined },
  }));

const parseTimeEntriesSheet = (rows: any[]) =>
  rows.filter(r => r["projet_id"] && r["collaborateur"] && r["date"]).map(r => ({
    projectId: String(r["projet_id"]).trim(), collaboratorName: String(r["collaborateur"]).trim(),
    date: String(r["date"]).trim(), startTime: String(r["heure_debut"] || "09:00").trim(), endTime: String(r["heure_fin"] || "17:00").trim(),
  }));

const parseSheet = (type: ImportType, rows: any[]) => {
  switch (type) {
    case "departments": return parseDepartmentsSheet(rows);
    case "members": return parseMembersSheet(rows);
    case "milestones": return parseMilestonesSheet(rows);
    case "projects": return parseProjectsSheet(rows);
    case "project_collaborators": return parseProjectCollaboratorsSheet(rows);
    case "project_milestones": return parseProjectMilestonesSheet(rows);
    case "committees": return parseCommitteesSheet(rows);
    case "committee_members": return parseCommitteeMembersSheet(rows);
    case "timeentries": return parseTimeEntriesSheet(rows);
    default: return [];
  }
};

// Export helpers
const exportModuleData = (moduleType: ModuleType, departments: Department[], projects: Project[], committees: Committee[], timeEntries: any[]) => {
  const wb = XLSX.utils.book_new();
  const sheetTypes = MODULE_SHEETS[moduleType];
  
  sheetTypes.forEach(type => {
    let data: any[] = [];
    switch (type) {
      case "departments":
        data = departments.map(d => ({
          id: d.id, nom: d.name, nom_cible_2027: d.nameTomorrow, icone: d.icon, couleur: d.color,
          responsable: d.head, role_actuel: d.headRoleToday, role_cible_2027: d.headRoleTomorrow,
          mission_actuelle: d.missionToday, mission_cible_2027: d.missionTomorrow, services: d.services.map(s => typeof s === "string" ? s : s.name).join(";"),
        }));
        break;
      case "members":
        departments.forEach(d => {
          d.compositionToday.forEach(m => data.push({ departement_id: d.id, nom: m.name, role: m.role, periode: "aujourd'hui", services_attribues: (m.services || []).join(";") }));
          d.compositionTomorrow.forEach(m => data.push({ departement_id: d.id, nom: m.name, role: m.role, periode: "cible 2027", services_attribues: (m.services || []).join(";") }));
        });
        break;
      case "milestones":
        departments.forEach(d => {
          d.milestones2026.forEach(ms => data.push({ departement_id: d.id, titre: ms.title, description: ms.description, trimestre: ms.quarter.split(" ")[0], annee: "2026", statut: ms.status }));
          d.milestones2027.forEach(ms => data.push({ departement_id: d.id, titre: ms.title, description: ms.description, trimestre: ms.quarter.split(" ")[0], annee: "2027", statut: ms.status }));
        });
        break;
      case "projects":
        data = projects.map(p => ({
          id: p.id, nom: p.name, description: p.description, objectif: p.objective, responsable: Array.isArray(p.projectLead) ? p.projectLead.join(";") : p.projectLead,
          departements: p.departmentIds.join(";"), responsables: p.responsibles.join(";"), couleur: p.color, date_creation: p.createdAt,
        }));
        break;
      case "project_collaborators":
        projects.forEach(p => p.collaborators.forEach(c => data.push({ projet_id: p.id, nom: c.name, role: c.role, departement: c.department })));
        break;
      case "project_milestones":
        projects.forEach(p => p.milestones.forEach(ms => data.push({ projet_id: p.id, titre: ms.title, description: ms.description, trimestre: ms.quarter, statut: ms.status, deadline: ms.deadline || "", date_creation: ms.createdAt })));
        break;
      case "committees":
        data = committees.map(c => ({ id: c.id, nom: c.name, icone: c.icon, objet: c.purpose, responsable: c.responsible || "", frequence: c.frequency, departements: c.linkedDepartmentIds.join(";"), invites: (c.guests || []).join(";"), institutions: (c.institutions || []).join(";") }));
        break;
      case "committee_members":
        committees.forEach(c => c.members.forEach(m => data.push({ comite_id: c.id, nom: m.name, role: m.role, departement_id: m.departmentId || "" })));
        break;
      case "timeentries":
        data = timeEntries.map(e => ({ projet_id: e.projectId, collaborateur: e.collaboratorName, date: e.date, heure_debut: e.startTime, heure_fin: e.endTime, heures_travaillees: e.hoursWorked || "", commentaire: e.comment || "" }));
        break;
    }
    if (data.length > 0) {
      const cfg = SHEET_CONFIGS.find(c => c.type === type)!;
      const ws = XLSX.utils.json_to_sheet(data, { header: cfg.headers });
      ws["!cols"] = cfg.headers.map(h => ({ wch: Math.max(h.length + 2, 18) }));
      XLSX.utils.book_append_sheet(wb, ws, cfg.sheetName);
    }
  });

  const moduleLabels: Record<ModuleType, string> = {
    dashboard: "dashboard", orgchart: "organigramme", roadmap: "roadmap", gantt: "gantt",
    comites: "comites", projects: "projets", timeentry: "saisie_temps", reports: "rapports",
  };
  XLSX.writeFile(wb, `export_${moduleLabels[moduleType]}.xlsx`);
};

interface DataToolbarProps {
  moduleType: ModuleType;
}

const DataToolbar = ({ moduleType }: DataToolbarProps) => {
  const { departments, addDepartment } = useDepartments();
  const { projects, addProject } = useProjects();
  const { committees, addCommittee } = useCommittees();
  const { entries, addEntry } = useTimeTracking();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [previews, setPreviews] = useState<SheetPreview[]>([]);
  const [importing, setImporting] = useState(false);

  const relevantSheets = MODULE_SHEETS[moduleType];

  if (!isAdmin || relevantSheets.length === 0) return null;

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    SHEET_CONFIGS.filter(cfg => relevantSheets.includes(cfg.type)).forEach(cfg => {
      const ws = XLSX.utils.json_to_sheet(cfg.examples, { header: cfg.headers });
      ws["!cols"] = cfg.headers.map(h => ({ wch: Math.max(h.length + 2, 18) }));
      XLSX.utils.book_append_sheet(wb, ws, cfg.sheetName);
    });
    const moduleLabels: Record<ModuleType, string> = {
      dashboard: "complet", orgchart: "organigramme", roadmap: "roadmap", gantt: "gantt",
      comites: "comites", projects: "projets", timeentry: "saisie_temps", reports: "rapports",
    };
    XLSX.writeFile(wb, `modele_${moduleLabels[moduleType]}.xlsx`);
  };

  const handleExport = () => {
    exportModuleData(moduleType, departments, projects, committees, entries);
    toast({ title: "Export réussi ✓" });
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
      if (!type || !relevantSheets.includes(type)) return;
      const cfg = SHEET_CONFIGS.find(c => c.type === type);
      if (!cfg) return;
      try {
        const parsedData = parseSheet(type, rows);
        results.push({ type, label: cfg.label, data: parsedData, errors: [], selected: parsedData.length > 0 });
      } catch { /* skip */ }
    });

    if (results.length === 0) {
      toast({ title: "Aucun onglet reconnu", description: "Vérifiez les noms d'onglets.", variant: "destructive" });
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

      const deptSheet = selected.find(s => s.type === "departments");
      const newDepts: Department[] = deptSheet?.data ?? [];

      const membersSheet = selected.find(s => s.type === "members");
      if (membersSheet) {
        membersSheet.data.forEach(({ deptId, period, member }: any) => {
          const dept = newDepts.find(d => d.id === deptId);
          if (dept) {
            if (period.includes("cible") || period.includes("2027")) dept.compositionTomorrow.push(member);
            else dept.compositionToday.push(member);
          }
        });
      }

      const msSheet = selected.find(s => s.type === "milestones");
      if (msSheet) {
        msSheet.data.forEach(({ deptId, year, ms }: any) => {
          const dept = newDepts.find(d => d.id === deptId);
          if (dept) {
            if (year.includes("2027")) dept.milestones2027.push(ms);
            else dept.milestones2026.push(ms);
          }
        });
      }
      newDepts.forEach(d => addDepartment(d));

      const projSheet = selected.find(s => s.type === "projects");
      const newProjects: Project[] = projSheet?.data ?? [];
      const pcSheet = selected.find(s => s.type === "project_collaborators");
      if (pcSheet) pcSheet.data.forEach(({ projectId, collab }: any) => { const p = newProjects.find(p => p.id === projectId); if (p) p.collaborators.push(collab); });
      const pmSheet = selected.find(s => s.type === "project_milestones");
      if (pmSheet) pmSheet.data.forEach(({ projectId, ms }: any) => { const p = newProjects.find(p => p.id === projectId); if (p) p.milestones.push(ms); });
      newProjects.forEach(p => addProject(p));

      const comSheet = selected.find(s => s.type === "committees");
      const newComs: Committee[] = comSheet?.data ?? [];
      const cmSheet = selected.find(s => s.type === "committee_members");
      if (cmSheet) cmSheet.data.forEach(({ comId, member }: any) => { const c = newComs.find(c => c.id === comId); if (c) c.members.push(member); });
      newComs.forEach(c => addCommittee(c));

      const teSheet = selected.find(s => s.type === "timeentries");
      if (teSheet) teSheet.data.forEach((e: any) => addEntry(e, ""));

      const totalItems = selected.reduce((s, p) => s + p.data.length, 0);
      toast({ title: "Import réussi ✓", description: `${totalItems} élément(s) importé(s).` });
      setOpen(false);
      setPreviews([]);
    } catch {
      toast({ title: "Erreur", description: "Erreur lors de l'import.", variant: "destructive" });
    }
    setImporting(false);
  };

  const totalSelected = previews.filter(p => p.selected).reduce((s, p) => s + p.data.length, 0);

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={downloadTemplate}>
          <FileSpreadsheet className="w-3.5 h-3.5" /> Modèle
        </Button>
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => fileRef.current?.click()}>
          <Upload className="w-3.5 h-3.5" /> Importer
        </Button>
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleExport}>
          <Download className="w-3.5 h-3.5" /> Exporter
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Import — Prévisualisation
            </DialogTitle>
          </DialogHeader>
          {previews.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{previews.length} onglet(s) détecté(s).</p>
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
                      </div>
                      {p.selected && p.data.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.data.slice(0, 6).map((item, i) => (
                            <Badge key={i} variant="outline" className="text-[9px]">
                              {item.name || item.nom || item.member?.name || item.collab?.name || item.ms?.title || item.collaboratorName || `#${i + 1}`}
                            </Badge>
                          ))}
                          {p.data.length > 6 && <Badge variant="outline" className="text-[9px]">+{p.data.length - 6}</Badge>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-muted-foreground">{totalSelected} élément(s)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => { setOpen(false); setPreviews([]); }}>Annuler</Button>
                  <Button size="sm" className="text-xs gap-1.5" onClick={confirmImport} disabled={importing || totalSelected === 0}>
                    <Upload className="w-3 h-3" /> Importer
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DataToolbar;
