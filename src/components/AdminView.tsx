import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Department } from "@/data/departments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronDown, ChevronRight, Building2, UserCog, FileSpreadsheet, Upload, Download, Pencil, Eye, EyeOff, CalendarCheck, ShieldAlert } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminCollaborators from "@/components/AdminCollaborators";
import AdminObjectiveRequests from "@/components/AdminObjectiveRequests";
import ObjectiveAuditLog from "@/components/ObjectiveAuditLog";
import AdminAuditLog from "@/components/AdminAuditLog";

import AdminLoginDesign from "@/components/AdminLoginDesign";
import AdminGlobalDesign from "@/components/AdminGlobalDesign";
import AdminConfiguration from "@/components/AdminConfiguration";
import AdminOperationalMeetings from "@/components/AdminOperationalMeetings";
import AdminEmailLog from "@/components/AdminEmailLog";
import AdminSecurityViolations from "@/components/AdminSecurityViolations";
import AdminCampaigns from "@/components/AdminCampaigns";
import { useProfiles, refreshProfiles } from "@/hooks/useProfiles";
import MultiSelect from "@/components/ui/multi-select";
import { supabase } from "@/integrations/supabase/client";
import { FileText, ClipboardList, Palette, Settings, MailCheck, Sparkles } from "lucide-react";

const DEPARTMENT_ICONS = [
  "🏢", "🏛️", "💼", "📊", "📈", "🔧", "⚙️", "🛠️", "💡", "🎯",
  "📋", "📁", "🗂️", "💰", "🏦", "🔬", "🧪", "🖥️", "📡", "🌐",
  "🚀", "🎓", "📚", "🏗️", "🔒", "⚖️", "🤝", "👥", "📣", "🎨",
];

interface AdminViewProps {
  orgView: "today" | "tomorrow";
  onOrgViewChange: (view: "today" | "tomorrow") => void;
  initialTab?: string;
}

const AdminView = ({ orgView, onOrgViewChange, initialTab }: AdminViewProps) => {
  const { departments, updateDepartment, addDepartment, deleteDepartment, deleteAllDepartments } = useDepartments();
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const { toast } = useToast();
  const importFileRef = useRef<HTMLInputElement>(null);
  const collaborators = useProfiles();
  const { isAdmin } = useAuth();
  const isFullAdmin = isAdmin;

  // ── Excel: Modèle ──
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    // Onglet Départements
    const deptExamples = [
      { nom: "Direction Technique", icone: "🔧", responsable: "Jean Dupont", responsable_2: "", role_responsable: "Directeur", mission: "Gérer les systèmes techniques", collaborateurs: "Marie Martin;Paul Durand" },
      { nom: "Direction RH", icone: "👥", responsable: "Sophie Leclerc", responsable_2: "", role_responsable: "Directrice", mission: "Gestion des ressources humaines", collaborateurs: "Luc Bernard" },
    ];
    const ws = XLSX.utils.json_to_sheet(deptExamples, { header: ["nom", "icone", "responsable", "responsable_2", "role_responsable", "mission", "collaborateurs"] });
    ws["!cols"] = [{ wch: 25 }, { wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, "Départements");
    // Onglet Services
    const svcExamples = [
      { nom: "Développement", departement: "Direction Technique", responsable: "Paul Durand", responsable_2: "", membres: "Marie Martin" },
      { nom: "Infrastructure", departement: "Direction Technique", responsable: "", responsable_2: "", membres: "" },
      { nom: "Recrutement", departement: "Direction RH", responsable: "Luc Bernard", responsable_2: "", membres: "" },
    ];
    const wsSvc = XLSX.utils.json_to_sheet(svcExamples, { header: ["nom", "departement", "responsable", "responsable_2", "membres"] });
    wsSvc["!cols"] = [{ wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsSvc, "Services");
    XLSX.writeFile(wb, "modele_departements.xlsx");
  };

  // ── Excel: Export ──
  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const deptData = departments.map(d => ({
      nom: d.name,
      icone: d.icon,
      responsable: d.head,
      responsable_2: d.head2 || "",
      role_responsable: d.headRoleToday,
      mission: d.missionToday,
      collaborateurs: d.compositionToday.map(m => m.name).join(";"),
    }));
    const ws = XLSX.utils.json_to_sheet(deptData, { header: ["nom", "icone", "responsable", "responsable_2", "role_responsable", "mission", "collaborateurs"] });
    ws["!cols"] = [{ wch: 25 }, { wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, "Départements");
    // Services
    const svcData: { nom: string; departement: string; responsable: string; responsable_2: string; membres: string }[] = [];
    departments.forEach(d => {
      d.services.forEach(s => {
        const svc = typeof s === "string" ? { name: s, responsible: "", responsible2: "", members: [] } : s;
        svcData.push({ nom: svc.name, departement: d.name, responsable: svc.responsible || "", responsable_2: svc.responsible2 || "", membres: (svc.members || []).join(";") });
      });
    });
    const wsSvc = XLSX.utils.json_to_sheet(svcData, { header: ["nom", "departement", "responsable", "responsable_2", "membres"] });
    wsSvc["!cols"] = [{ wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsSvc, "Services");
    XLSX.writeFile(wb, "export_departements.xlsx");
    toast({ title: "Export réussi ✓" });
  };

  // ── Excel: Import ──
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "array" });
      const deptSheet = wb.Sheets["Départements"] || wb.Sheets[wb.SheetNames[0]];
      const deptRows = (deptSheet ? XLSX.utils.sheet_to_json(deptSheet) : []) as Record<string, unknown>[];
      const svcSheet = wb.Sheets["Services"];
      const svcRows = (svcSheet ? XLSX.utils.sheet_to_json(svcSheet) : []) as Record<string, unknown>[];

      if (deptRows.length === 0) {
        toast({ title: "Fichier vide", variant: "destructive" });
        if (importFileRef.current) importFileRef.current.value = "";
        return;
      }

      // Group services by department name
      const svcByDept: Record<string, { name: string; responsible: string; responsible2: string; members: string[] }[]> = {};
      for (const r of svcRows) {
        const svcName = String(r["nom"] || "").trim();
        const deptName = String(r["departement"] || "").trim();
        if (!svcName || !deptName) continue;
        if (!svcByDept[deptName]) svcByDept[deptName] = [];
        const responsible = String(r["responsable"] || "").trim();
        const responsible2 = String(r["responsable_2"] || "").trim();
        const membres = String(r["membres"] || "").trim().split(";").map(m => m.trim()).filter(Boolean);
        svcByDept[deptName].push({ name: svcName, responsible, responsible2, members: membres });
      }

      let count = 0;
      for (const r of deptRows) {
        const name = String(r["nom"] || "").trim();
        if (!name) continue;
        const icon = String(r["icone"] || "🏢").trim();
        const head = String(r["responsable"] || "À définir").trim();
        const head2 = String(r["responsable_2"] || "").trim();
        const headRole = String(r["role_responsable"] || "Responsable").trim();
        const mission = String(r["mission"] || "").trim();
        const collabStr = String(r["collaborateurs"] || "").trim();
        const collabs = collabStr.split(";").map(c => c.trim()).filter(Boolean);

        addDepartment({
          id: `dept-${Date.now()}-${count}`, name, nameTomorrow: name,
          icon, color: "hsl(200 50% 50%)", head, head2: head2 || undefined,
          headRoleToday: headRole, headRoleTomorrow: "Directeur",
          missionToday: mission, missionTomorrow: "",
          services: svcByDept[name] || [],
          compositionToday: collabs.map(c => ({ name: c, role: "", services: [] })),
          compositionTomorrow: [],
          milestones2026: [], milestones2027: [],
          nameChangesTomorrow: false, decomposesTomorrow: false,
          futureDepartments: [], newDirectionName: "",
        });
        count++;
      }
      toast({ title: "Import réussi ✓", description: `${count} département(s) importé(s).` });
      if (importFileRef.current) importFileRef.current.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAddDepartment = () => {
    const newDept: Department = {
      id: `dept-${Date.now()}`,
      name: "Nouveau Département",
      nameTomorrow: "Nouvelle Direction",
      icon: "🏢",
      color: "hsl(200 50% 50%)",
      head: "À définir",
      headRoleToday: "Responsable",
      headRoleTomorrow: "Directeur / Directrice",
      missionToday: "",
      missionTomorrow: "",
      services: [],
      compositionToday: [],
      compositionTomorrow: [],
      milestones2026: [],
      milestones2027: [],
      nameChangesTomorrow: false,
      decomposesTomorrow: false,
      futureDepartments: [],
      newDirectionName: "",
      visibleOnOrgChart: true,
    };
    addDepartment(newDept);
    setExpandedDept(newDept.id);
  };

  const updateField = (dept: Department, field: keyof Department, value: Department[keyof Department]) => {
    updateDepartment({ ...dept, [field]: value });
  };

  const addService = (dept: Department) => {
    updateDepartment({ ...dept, services: [...dept.services, { name: "Nouveau Service", responsible: "" }] });
  };

  const updateService = (dept: Department, idx: number, field: string, value: string | string[]) => {
    const services = dept.services.map((s, i) => {
      const svc = typeof s === "string" ? { name: s, responsible: "", members: [] } : s;
      return i === idx ? { ...svc, [field]: value } : svc;
    });
    updateDepartment({ ...dept, services });
  };

  const removeService = (dept: Department, idx: number) => {
    const serviceName = typeof dept.services[idx] === "string" ? dept.services[idx] : dept.services[idx].name;
    const services = dept.services.filter((_, i) => i !== idx);
    // Also remove service from all members
    const cleanMembers = (members: Department["compositionToday"]) =>
      members.map(m => ({
        ...m,
        services: (m.services || []).filter(s => s !== serviceName),
      }));
    updateDepartment({
      ...dept,
      services,
      compositionToday: cleanMembers(dept.compositionToday),
      compositionTomorrow: cleanMembers(dept.compositionTomorrow),
    });
  };

  const addMember = (dept: Department, list: "compositionToday" | "compositionTomorrow") => {
    updateDepartment({ ...dept, [list]: [...dept[list], { name: "", role: "", services: [] }] });
  };

  const updateMember = (dept: Department, list: "compositionToday" | "compositionTomorrow", idx: number, field: string, value: string | string[]) => {
    updateDepartment({
      ...dept,
      [list]: dept[list].map((m, i) => i === idx ? { ...m, [field]: value } : m),
    });
  };

  const removeMember = (dept: Department, list: "compositionToday" | "compositionTomorrow", idx: number) => {
    updateDepartment({ ...dept, [list]: dept[list].filter((_, i) => i !== idx) });
  };

  const toggleMemberService = (dept: Department, list: "compositionToday" | "compositionTomorrow", memberIdx: number, service: string) => {
    const members = dept[list].map((m, i) => {
      if (i !== memberIdx) return m;
      const current = m.services || [];
      return { ...m, services: current.includes(service) ? current.filter(s => s !== service) : [...current, service] };
    });
    updateDepartment({ ...dept, [list]: members });
  };

  return (
    <div className="space-y-6">

      <Tabs defaultValue={initialTab || "collaborators"} className="w-full">
        {isFullAdmin ? (
          <TabsList className="bg-muted/50 p-1 rounded-lg mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="collaborators" className="rounded-md text-xs font-medium gap-1.5">
              <UserCog className="w-3.5 h-3.5" /> Collaborateurs
            </TabsTrigger>
            <TabsTrigger value="departments" className="rounded-md text-xs font-medium gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Départements
            </TabsTrigger>
            <TabsTrigger value="objective-requests" className="rounded-md text-xs font-medium gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Demandes objectifs
            </TabsTrigger>
            <TabsTrigger value="audit-log" className="rounded-md text-xs font-medium gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Audit
            </TabsTrigger>
            <TabsTrigger value="design" className="rounded-md text-xs font-medium gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Design & Animations
            </TabsTrigger>
            <TabsTrigger value="configuration" className="rounded-md text-xs font-medium gap-1.5">
              <Settings className="w-3.5 h-3.5" /> Configuration
            </TabsTrigger>
            <TabsTrigger value="operational-meetings" className="rounded-md text-xs font-medium gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5" /> Réunions opérationnelles
            </TabsTrigger>
            <TabsTrigger value="email-log" className="rounded-md text-xs font-medium gap-1.5">
              <MailCheck className="w-3.5 h-3.5" /> Suivi emails
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-md text-xs font-medium gap-1.5 text-destructive">
              <ShieldAlert className="w-3.5 h-3.5" /> Sécurité
            </TabsTrigger>
          </TabsList>
        ) : (
          <TabsList className="bg-muted/50 p-1 rounded-lg mb-6">
            <TabsTrigger value="collaborators" className="rounded-md text-xs font-medium gap-1.5">
              <UserCog className="w-3.5 h-3.5" /> Collaborateurs
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="collaborators">
          <AdminCollaborators />
        </TabsContent>

        <TabsContent value="objective-requests">
          <AdminObjectiveRequests />
          <div className="mt-6">
            <ObjectiveAuditLog />
          </div>
        </TabsContent>

        <TabsContent value="audit-log">
          <AdminAuditLog />
        </TabsContent>

        <TabsContent value="configuration">
          <AdminConfiguration />
        </TabsContent>

        <TabsContent value="operational-meetings">
          <AdminOperationalMeetings />
        </TabsContent>

        <TabsContent value="email-log">
          <AdminEmailLog />
        </TabsContent>

        {isFullAdmin && (
          <TabsContent value="security">
            <AdminSecurityViolations />
          </TabsContent>
        )}

        <TabsContent value="design">
          <div className="space-y-8">
            <AdminLoginDesign />
            <AdminCampaigns />
          </div>
        </TabsContent>

        <TabsContent value="departments">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={downloadTemplate}>
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Modèle
                </Button>
                <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => importFileRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5" /> Importer
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleExport}>
                  <Download className="w-3.5 h-3.5" /> Exporter
                </Button>
                {departments.length > 0 && (
                  <Button variant="destructive" size="sm" className="text-xs gap-1.5" onClick={() => {
                    if (confirm(`Supprimer tous les ${departments.length} départements ?`)) {
                      deleteAllDepartments();
                      setExpandedDept(null);
                    }
                  }}>
                    <Trash2 className="w-3.5 h-3.5" /> Tout supprimer
                  </Button>
                )}
                <Button onClick={handleAddDepartment} size="sm" className="text-xs gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Nouveau département
                </Button>
              </div>
            </div>

      <div className="space-y-3">
        {departments.map(dept => (
            <Collapsible
              key={dept.id}
              open={expandedDept === dept.id}
              onOpenChange={(open) => setExpandedDept(open ? dept.id : null)}
            >
              <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left">
                    <span className="text-xl">{dept.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm truncate">{dept.name}</p>
                      <p className="text-[11px] text-muted-foreground">{collaborators.filter(c => c.department_id === dept.id).length} membres</p>
                    </div>
                    {expandedDept === dept.id ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-5 space-y-6 border-t border-border pt-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informations générales</h4>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Nom du département</Label>
                          <Input value={dept.name} onChange={e => updateField(dept, "name", e.target.value)} className="text-sm h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Icône</Label>
                          <Select value={dept.icon} onValueChange={v => updateField(dept, "icon", v)}>
                            <SelectTrigger className="text-sm h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DEPARTMENT_ICONS.map(icon => (
                                <SelectItem key={icon} value={icon} className="text-lg">{icon}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Responsable 1</Label>
                          <Select value={dept.head} onValueChange={v => {
                            const p = collaborators.find(c => c.full_name === v);
                            updateDepartment({ ...dept, head: v, headRoleToday: p?.poste || "" });
                          }}>
                            <SelectTrigger className="text-sm h-8"><SelectValue placeholder="Choisir" /></SelectTrigger>
                            <SelectContent className="max-h-60">
                              {collaborators.map(c => (
                                <SelectItem key={c.user_id} value={c.full_name}>{c.full_name}{c.poste ? ` — ${c.poste}` : ""}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Responsable 2 (optionnel)</Label>
                          <Select value={dept.head2 || "__none__"} onValueChange={v => {
                            const name = v === "__none__" ? "" : v;
                            const p = collaborators.find(c => c.full_name === name);
                            updateDepartment({ ...dept, head2: name, headRoleToday2: name ? (p?.poste || "") : "" });
                          }}>
                            <SelectTrigger className="text-sm h-8"><SelectValue placeholder="Aucun" /></SelectTrigger>
                            <SelectContent className="max-h-60">
                              <SelectItem value="__none__">— Aucun —</SelectItem>
                              {collaborators.map(c => (
                                <SelectItem key={c.user_id} value={c.full_name}>{c.full_name}{c.poste ? ` — ${c.poste}` : ""}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Mission</Label>
                        <Input value={dept.missionToday || ""} onChange={e => updateField(dept, "missionToday", e.target.value)} className="text-sm h-8" placeholder="Mission du département" />
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center gap-2">
                          {dept.visibleOnOrgChart !== false ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                          <Label className="text-[10px]">Visible sur l'organigramme</Label>
                        </div>
                        <Button
                          variant={dept.visibleOnOrgChart !== false ? "default" : "outline"}
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => updateField(dept, "visibleOnOrgChart", dept.visibleOnOrgChart === false ? true : false)}
                        >
                          {dept.visibleOnOrgChart !== false ? "Oui" : "Non"}
                        </Button>
                      </div>
                      {/* Services du département */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Services</Label>
                          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => addService(dept)}>
                            <Plus className="w-3 h-3" /> Ajouter un service
                          </Button>
                        </div>
                        {dept.services.length === 0 && (
                          <p className="text-[10px] text-muted-foreground italic">Aucun service défini</p>
                        )}
                        {dept.services.map((service, si) => {
                          const svc = typeof service === "string" ? { name: service, responsible: "", responsible2: "", members: [] } : service;
                          return (
                            <div key={si} className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={svc.name}
                                  onChange={e => updateService(dept, si, "name", e.target.value)}
                                  placeholder="Nom du service"
                                  className="text-xs h-7 flex-1"
                                />
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => removeService(dept, si)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-0.5">
                                  <Label className="text-[9px] text-muted-foreground">Responsable 1</Label>
                                  <Select value={svc.responsible || "__none__"} onValueChange={v => updateService(dept, si, "responsible", v === "__none__" ? "" : v)}>
                                    <SelectTrigger className="text-xs h-7"><SelectValue placeholder="Responsable" /></SelectTrigger>
                                    <SelectContent className="max-h-60">
                                      <SelectItem value="__none__">— Aucun —</SelectItem>
                                      {collaborators.map(c => (
                                        <SelectItem key={c.user_id} value={c.full_name}>{c.full_name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-0.5">
                                  <Label className="text-[9px] text-muted-foreground">Responsable 2 (optionnel)</Label>
                                  <Select value={svc.responsible2 || "__none__"} onValueChange={v => updateService(dept, si, "responsible2", v === "__none__" ? "" : v)}>
                                    <SelectTrigger className="text-xs h-7"><SelectValue placeholder="2ᵉ responsable" /></SelectTrigger>
                                    <SelectContent className="max-h-60">
                                      <SelectItem value="__none__">— Aucun —</SelectItem>
                                      {collaborators.map(c => (
                                        <SelectItem key={c.user_id} value={c.full_name}>{c.full_name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="space-y-0.5">
                                <Label className="text-[9px] text-muted-foreground">Membres du service</Label>
                                <MultiSelect
                                  options={collaborators.map(c => ({ value: c.full_name, label: `${c.full_name}${c.poste ? ` (${c.poste})` : ""}` }))}
                                  selected={svc.members || []}
                                  onChange={v => updateService(dept, si, "members", v)}
                                  placeholder="Sélectionner des membres..."
                                  className="text-xs"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Membres du département */}
                      <div className="space-y-1.5">
                        <Label className="text-[10px]">Membres du département</Label>
                        <MultiSelect
                          options={collaborators.map(c => ({ value: c.user_id, label: `${c.full_name}${c.poste ? ` (${c.poste})` : ""}` }))}
                          selected={collaborators.filter(c => c.department_id === dept.id).map(c => c.user_id)}
                          onChange={async (selectedUserIds: string[]) => {
                            const currentMembers = collaborators.filter(c => c.department_id === dept.id);
                            const removed = currentMembers.filter(c => !selectedUserIds.includes(c.user_id));
                            for (const r of removed) {
                              await supabase.from("profiles").update({ department_id: null }).eq("user_id", r.user_id);
                            }
                            const currentIds = currentMembers.map(c => c.user_id);
                            const added = selectedUserIds.filter(id => !currentIds.includes(id));
                            for (const id of added) {
                              await supabase.from("profiles").update({ department_id: dept.id }).eq("user_id", id);
                            }
                            refreshProfiles();
                          }}
                          placeholder="Sélectionner les membres..."
                        />
                        {(() => {
                          const deptMembers = collaborators.filter(c => c.department_id === dept.id);
                          return deptMembers.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mt-2">
                              {deptMembers.map(m => (
                                <div key={m.user_id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5">
                                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary">
                                    {m.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium truncate">{m.full_name}</p>
                                    {m.poste && <p className="text-[10px] text-muted-foreground truncate">{m.poste}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border flex justify-end">
                      <Button variant="destructive" size="sm" className="text-xs gap-1.5" onClick={() => {
                        if (confirm(`Supprimer « ${dept.name} » ?`)) { deleteDepartment(dept.id); setExpandedDept(null); }
                      }}>
                        <Trash2 className="w-3 h-3" /> Supprimer ce département
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        
      </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminView;
