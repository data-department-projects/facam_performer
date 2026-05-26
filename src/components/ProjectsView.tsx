import { useState, useEffect, useMemo } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Project, ProjectMilestone, ProjectCollaborator, CollaboratorMission, MissionMilestone, Deliverable } from "@/data/projects";
import { getDepartmentDisplayName } from "@/data/departments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown, ChevronRight, FolderKanban, Lock, CalendarIcon, Users, Link2, Send, AlertTriangle, ShieldAlert, GanttChart, Pencil } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import ModificationRequestDialog from "@/components/ModificationRequestDialog";
import ProjectExpenses from "@/components/ProjectExpenses";
import ProjectCostSection from "@/components/ProjectCostSection";
import MultiSelect from "@/components/ui/multi-select";
import { useProfiles } from "@/hooks/useProfiles";


const QUARTERS = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027", "Q3 2027", "Q4 2027"];

const ProjectsView = ({ initialExpandedId, onNavigateToGantt }: { initialExpandedId?: string | null; onNavigateToGantt?: () => void }) => {
  const { projects, addProject, updateProject, deleteProject, updateMilestoneDeadline, submitDeliverable } = useProjects();
  const { departments } = useDepartments();
  const { isAdmin, user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId || null);
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [deliverableInputs, setDeliverableInputs] = useState<Record<string, { name: string; link: string }>>({});
  const { toast } = useToast();
  const userProfiles = useProfiles();
  const [canCreateProjects, setCanCreateProjects] = useState(false);

  useEffect(() => {
    if (isAdmin) { setCanCreateProjects(true); return; }
    if (!user) return;
    const check = async () => {
      const { data } = await supabase.from("user_create_permissions" as any).select("can_create_projects").eq("user_id", user.id).maybeSingle();
      setCanCreateProjects(!!(data as any)?.can_create_projects);
    };
    check();
  }, [user, isAdmin]);

  useEffect(() => {
    if (initialExpandedId) setExpandedId(initialExpandedId);
  }, [initialExpandedId]);

  // Modification request dialog state
  const [modRequestOpen, setModRequestOpen] = useState(false);
  const [modRequestData, setModRequestData] = useState<{
    entityType: "project" | "milestone";
    entityId: string;
    projectId: string;
    fieldName: string;
    oldValue: string;
    newValue: string;
  } | null>(null);

  const handleAdd = () => {
    const now = new Date().toISOString().split("T")[0];
    const p: Project = {
      id: `proj-${Date.now()}`,
      name: "Nouveau Projet",
      description: "",
      objective: "",
      projectLead: [],
      departmentIds: [],
      responsibles: [],
      collaborators: [],
      color: `hsl(${Math.round(Math.random() * 360)} 50% 45%)`,
      milestones: [],
      createdAt: now,
      isNew: true,
    };
    addProject(p);
    setExpandedId(p.id);
  };

  // Check if current user is a project lead
  const currentUserProfile = useMemo(() => {
    if (!user) return null;
    return userProfiles.find(p => p.user_id === user.id);
  }, [user, userProfiles]);

  const isProjectLead = (proj: Project) => {
    if (!currentUserProfile) return false;
    const leads = Array.isArray(proj.projectLead) ? proj.projectLead : [proj.projectLead];
    return leads.some(l => l === currentUserProfile.full_name);
  };

  // Filter projects: admins see all, others see only projects they're attached to
  const filteredProjects = useMemo(() => {
    if (isAdmin) return projects;
    if (!currentUserProfile) return [];
    const name = currentUserProfile.full_name;
    return projects.filter(proj => {
      const leads = Array.isArray(proj.projectLead) ? proj.projectLead : [proj.projectLead];
      if (leads.includes(name)) return true;
      if (proj.responsibles?.includes(name)) return true;
      if (proj.collaborators?.some(c => c.name === name)) return true;
      return false;
    });
  }, [isAdmin, projects, currentUserProfile]);

  const canShowEditButton = (proj: Project) => !proj.isNew && (isAdmin || isProjectLead(proj));

  const toggleEditing = (projId: string) => {
    setEditingIds(prev => {
      const next = new Set(prev);
      if (next.has(projId)) next.delete(projId);
      else next.add(projId);
      return next;
    });
  };

  // Check if a project can be freely edited (new projects, admin editing, or project lead editing)
  const canFreeEdit = (proj: Project) => proj.isNew === true || (isAdmin && editingIds.has(proj.id)) || (isProjectLead(proj) && editingIds.has(proj.id));

  // Attempt to modify a project field - if locked, open request dialog
  const tryUpdateProjectField = (proj: Project, field: string, oldValue: string, newValue: string) => {
    if (canFreeEdit(proj)) {
      updateProject({ ...proj, [field]: newValue });
    } else {
      setModRequestData({
        entityType: "project",
        entityId: proj.id,
        projectId: proj.id,
        fieldName: field,
        oldValue,
        newValue,
      });
      setModRequestOpen(true);
    }
  };

  // Attempt to modify a milestone field
  const tryUpdateMilestoneField = (proj: Project, ms: ProjectMilestone, field: string, oldValue: string, newValue: string) => {
    if (canFreeEdit(proj)) {
      updateProject({
        ...proj,
        milestones: proj.milestones.map(m => m.id === ms.id ? { ...m, [field]: newValue } : m),
      });
    } else {
      setModRequestData({
        entityType: "milestone",
        entityId: ms.id,
        projectId: proj.id,
        fieldName: field,
        oldValue,
        newValue,
      });
      setModRequestOpen(true);
    }
  };

  // Mark project as saved (no longer new)
  const finalizeProject = (proj: Project) => {
    updateProject({ ...proj, isNew: false });
    toast({ title: "Projet enregistré", description: "Le projet est désormais verrouillé. Les modifications futures nécessiteront l'approbation du DG." });
  };

  const toggleDept = (proj: Project, deptId: string) => {
    if (!canFreeEdit(proj)) {
      const oldVal = proj.departmentIds.join(", ");
      const ids = proj.departmentIds.includes(deptId)
        ? proj.departmentIds.filter(d => d !== deptId)
        : [...proj.departmentIds, deptId];
      setModRequestData({
        entityType: "project",
        entityId: proj.id,
        projectId: proj.id,
        fieldName: "departmentIds",
        oldValue: oldVal,
        newValue: ids.join(", "),
      });
      setModRequestOpen(true);
      return;
    }
    const ids = proj.departmentIds.includes(deptId)
      ? proj.departmentIds.filter(d => d !== deptId)
      : [...proj.departmentIds, deptId];
    updateProject({ ...proj, departmentIds: ids });
  };

  const addResponsible = (proj: Project) => {
    updateProject({ ...proj, responsibles: [...proj.responsibles, ""] });
  };

  const updateResponsible = (proj: Project, idx: number, value: string) => {
    if (!canFreeEdit(proj)) {
      setModRequestData({
        entityType: "project",
        entityId: proj.id,
        projectId: proj.id,
        fieldName: `responsable #${idx + 1}`,
        oldValue: proj.responsibles[idx],
        newValue: value,
      });
      setModRequestOpen(true);
      return;
    }
    const r = [...proj.responsibles];
    r[idx] = value;
    updateProject({ ...proj, responsibles: r });
  };

  const removeResponsible = (proj: Project, idx: number) => {
    if (!canFreeEdit(proj)) {
      toast({ title: "Modification verrouillée", description: "Soumettez une demande pour modifier ce projet.", variant: "destructive" });
      return;
    }
    updateProject({ ...proj, responsibles: proj.responsibles.filter((_, i) => i !== idx) });
  };

  const addCollaborator = (proj: Project) => {
    updateProject({ ...proj, collaborators: [...proj.collaborators, { name: "", role: "", department: "" }] });
  };

  const updateCollaborator = (proj: Project, idx: number, field: keyof ProjectCollaborator, value: string) => {
    if (!canFreeEdit(proj)) {
      setModRequestData({
        entityType: "project",
        entityId: proj.id,
        projectId: proj.id,
        fieldName: `collaborateur #${idx + 1} - ${field}`,
        oldValue: String(proj.collaborators[idx]?.[field] || ""),
        newValue: value,
      });
      setModRequestOpen(true);
      return;
    }
    const c = proj.collaborators.map((col, i) => i === idx ? { ...col, [field]: value } : col);
    updateProject({ ...proj, collaborators: c });
  };

  const removeCollaborator = (proj: Project, idx: number) => {
    if (!canFreeEdit(proj)) {
      toast({ title: "Modification verrouillée", description: "Soumettez une demande pour modifier ce projet.", variant: "destructive" });
      return;
    }
    updateProject({ ...proj, collaborators: proj.collaborators.filter((_, i) => i !== idx) });
  };

  const addMilestone = (proj: Project) => {
    const now = new Date().toISOString().split("T")[0];
    const m: ProjectMilestone = {
      id: `ms-${Date.now()}`,
      quarter: "Q1 2026",
      title: "Nouveau jalon",
      description: "",
      status: "planned",
      deliverables: [],
      createdAt: now,
    };
    updateProject({ ...proj, milestones: [...proj.milestones, m] });
  };

  const updateMilestone = (proj: Project, msId: string, field: keyof ProjectMilestone, value: string) => {
    const ms = proj.milestones.find(m => m.id === msId);
    if (!ms) return;
    if (!canFreeEdit(proj)) {
      tryUpdateMilestoneField(proj, ms, field, String(ms[field] || ""), value);
      return;
    }
    updateProject({
      ...proj,
      milestones: proj.milestones.map(m => m.id === msId ? { ...m, [field]: value } : m),
    });
  };

  const removeMilestone = (proj: Project, msId: string) => {
    if (!canFreeEdit(proj)) {
      toast({ title: "Modification verrouillée", description: "Soumettez une demande pour supprimer ce jalon.", variant: "destructive" });
      return;
    }
    updateProject({ ...proj, milestones: proj.milestones.filter(m => m.id !== msId) });
  };

  const setMilestoneDeadlineDate = (proj: Project, msId: string, date: Date | undefined) => {
    if (!date) return;
    const iso = format(date, "yyyy-MM-dd");
    updateMilestone(proj, msId, "deadline", iso);
  };

  const handleSubmitDeliverable = (projId: string, msId: string) => {
    const input = deliverableInputs[msId];
    if (!input?.name || !input?.link) {
      toast({ title: "Erreur", description: "Veuillez remplir le nom et le lien du livrable.", variant: "destructive" });
      return;
    }
    const result = submitDeliverable(projId, msId, input.name, input.link);
    if (result.success) {
      toast({ title: "Livrable déposé ✓", description: `Livrable envoyé par ${input.name}` });
      setDeliverableInputs(prev => ({ ...prev, [msId]: { name: "", link: "" } }));
    } else {
      toast({ title: "Dépôt impossible", description: result.error, variant: "destructive" });
    }
  };

  const getDeadlineInfo = (ms: ProjectMilestone) => {
    if (!ms.deadline) return null;
    const deadlineDate = new Date(ms.deadline);
    const now = new Date();
    const hoursLeft = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const canSubmit = hoursLeft >= 0 && hoursLeft <= 24;
    return { hoursLeft, canSubmit, isPast: hoursLeft < 0 };
  };

  const getDeptName = (id: string) => { const d = departments.find(dep => dep.id === id); return d ? getDepartmentDisplayName(d) : id; };
  const getDeptIcon = (id: string) => departments.find(d => d.id === id)?.icon || "🏢";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl">Projets</h2>
          <p className="text-sm text-muted-foreground">Gérez vos projets, deadlines et livrables</p>
        </div>
        <div className="flex items-center gap-2">
          {onNavigateToGantt && (
            <Button variant="outline" onClick={onNavigateToGantt} size="sm" className="text-xs gap-1.5">
              <GanttChart className="w-3.5 h-3.5" /> Vue Gantt
            </Button>
          )}
          {canCreateProjects && (
            <Button onClick={handleAdd} size="sm" className="text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Nouveau projet
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {filteredProjects.map(proj => (
          <Collapsible
            key={proj.id}
            open={expandedId === proj.id}
            onOpenChange={open => setExpandedId(open ? proj.id : null)}
          >
            <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left">
                  <div className="w-3 h-8 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-bold text-sm truncate">{proj.name}</p>
                      {proj.isNew && <Badge className="text-[9px] bg-green-100 text-green-800">Nouveau</Badge>}
                      {!proj.isNew && !isAdmin && (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    {proj.projectLead?.length > 0 && <p className="text-[11px] text-muted-foreground">Chef de projet : {Array.isArray(proj.projectLead) ? proj.projectLead.join(", ") : proj.projectLead}</p>}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {proj.departmentIds.map(id => (
                        <span key={id} className="text-[10px] text-muted-foreground">{getDeptIcon(id)} {getDeptName(id).replace(/^Département\s+/, "").substring(0, 20)}</span>
                      ))}
                      <span className="text-[10px] text-muted-foreground">· {proj.milestones.length} jalons · {proj.collaborators.length} collaborateur(s)</span>
                      {proj.createdAt && (
                        <span className="text-[10px] text-muted-foreground">· Créé le {format(new Date(proj.createdAt + "T00:00:00"), "dd/MM/yyyy", { locale: fr })}</span>
                      )}
                    </div>
                  </div>
                  {expandedId === proj.id ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-5 space-y-6 border-t border-border pt-4">
                  {/* Edit button for admin / project lead */}
                  {canShowEditButton(proj) && (
                    <div className="flex justify-end">
                      <Button
                        variant={editingIds.has(proj.id) ? "default" : "outline"}
                        size="sm"
                        className="text-xs gap-1.5"
                        onClick={() => toggleEditing(proj.id)}
                      >
                        <Pencil className="w-3 h-3" />
                        {editingIds.has(proj.id) ? "Terminer la modification" : "Modifier"}
                      </Button>
                    </div>
                  )}

                  {/* Lock notice */}
                  {!canFreeEdit(proj) && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>Ce projet est verrouillé. {canShowEditButton(proj) ? "Cliquez sur « Modifier » pour éditer." : "Toute modification sera soumise au Directeur Général pour validation."}</span>
                    </div>
                  )}

                  {/* New project: finalize button */}
                  {proj.isNew && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
                      <span className="flex-1">Nouveau projet — vous pouvez éditer librement. Une fois finalisé, les modifications nécessiteront l'approbation du DG.</span>
                      <Button size="sm" className="text-xs gap-1" onClick={() => finalizeProject(proj)}>
                        <Lock className="w-3 h-3" /> Finaliser et verrouiller
                      </Button>
                    </div>
                  )}

                  {/* Creation date */}
                  {proj.createdAt && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      Date de création : {format(new Date(proj.createdAt + "T00:00:00"), "dd MMMM yyyy", { locale: fr })}
                    </div>
                  )}

                  {/* General */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-muted-foreground" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informations</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Nom du projet</Label>
                        <Input
                          value={proj.name}
                          onChange={e => tryUpdateProjectField(proj, "name", proj.name, e.target.value)}
                          className="text-sm h-8"
                          readOnly={!canFreeEdit(proj)}
                          onClick={() => !canFreeEdit(proj) && toast({ title: "Verrouillé", description: "Cliquez pour soumettre une demande de modification" })}
                        />
                      </div>
                       <div className="space-y-1">
                        <Label className="text-[10px]">Responsable(s) du projet</Label>
                        <MultiSelect
                          options={userProfiles.map(u => ({
                            value: u.full_name,
                            label: u.full_name,
                            sublabel: u.poste || undefined,
                          }))}
                          selected={Array.isArray(proj.projectLead) ? proj.projectLead : (proj.projectLead ? [proj.projectLead] : [])}
                          onChange={values => {
                            if (canFreeEdit(proj)) {
                              updateProject({ ...proj, projectLead: values });
                            } else {
                              const oldVal = (Array.isArray(proj.projectLead) ? proj.projectLead : [proj.projectLead]).join(";");
                              const newVal = values.join(";");
                              setModRequestData({
                                entityType: "project",
                                entityId: proj.id,
                                projectId: proj.id,
                                fieldName: "projectLead",
                                oldValue: oldVal,
                                newValue: newVal,
                              });
                              setModRequestOpen(true);
                            }
                          }}
                          placeholder="Sélectionner les responsables"
                          className="h-auto min-h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Couleur</Label>
                        <Select
                          value={proj.color}
                          onValueChange={v => tryUpdateProjectField(proj, "color", proj.color, v)}
                          disabled={!canFreeEdit(proj)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full shrink-0 border border-border" style={{ backgroundColor: proj.color }} />
                              <SelectValue placeholder="Choisir une couleur" />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              { label: "Bleu", value: "hsl(220 70% 50%)" },
                              { label: "Rouge", value: "hsl(0 70% 50%)" },
                              { label: "Vert", value: "hsl(140 60% 40%)" },
                              { label: "Orange", value: "hsl(30 90% 50%)" },
                              { label: "Violet", value: "hsl(270 60% 50%)" },
                              { label: "Rose", value: "hsl(330 70% 55%)" },
                              { label: "Cyan", value: "hsl(190 80% 45%)" },
                              { label: "Jaune", value: "hsl(50 90% 45%)" },
                              { label: "Marron", value: "hsl(25 60% 35%)" },
                              { label: "Gris", value: "hsl(220 10% 50%)" },
                              { label: "Turquoise", value: "hsl(170 60% 40%)" },
                              { label: "Indigo", value: "hsl(240 60% 45%)" },
                            ].map(c => (
                              <SelectItem key={c.value} value={c.value}>
                                <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 rounded-full shrink-0 border border-border" style={{ backgroundColor: c.value }} />
                                  {c.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Objet du projet</Label>
                      <Textarea
                        value={proj.objective}
                        onChange={e => tryUpdateProjectField(proj, "objective", proj.objective, e.target.value)}
                        rows={2}
                        placeholder="Objectif principal et enjeux stratégiques..."
                        className="text-sm"
                        readOnly={!canFreeEdit(proj)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Description</Label>
                      <Textarea
                        value={proj.description}
                        onChange={e => tryUpdateProjectField(proj, "description", proj.description, e.target.value)}
                        rows={2}
                        className="text-sm"
                        readOnly={!canFreeEdit(proj)}
                      />
                    </div>
                  </div>

                  {/* Departments */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Départements rattachés</h4>
                    <div className="flex flex-wrap gap-2">
                      {departments.map(d => {
                        const active = proj.departmentIds.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => toggleDept(proj, d.id)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                              active
                                ? "bg-accent text-accent-foreground border-accent"
                                : "bg-transparent text-muted-foreground border-border hover:border-accent/50"
                            }`}
                          >
                            {d.icon} {getDepartmentDisplayName(d).replace(/^Département\s+/, "").substring(0, 25)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Collaborators with missions */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collaborateurs impliqués</h4>
                      </div>
                      {canFreeEdit(proj) && (
                        <Button variant="ghost" size="sm" onClick={() => addCollaborator(proj)} className="h-7 text-xs gap-1">
                          <Plus className="w-3 h-3" /> Ajouter
                        </Button>
                      )}
                    </div>
                    <div className="space-y-4">
                      {(() => {
                        // Group collaborators by department
                        const grouped: Record<string, number[]> = {};
                        proj.collaborators.forEach((c, idx) => {
                          const deptKey = c.department || "__none__";
                          if (!grouped[deptKey]) grouped[deptKey] = [];
                          grouped[deptKey].push(idx);
                        });
                        const deptKeys = Object.keys(grouped);
                        return deptKeys.map(deptKey => (
                          <div key={deptKey} className="space-y-2">
                            {deptKey !== "__none__" && (
                              <div className="flex items-center gap-2 px-1">
                                <span className="text-sm">{getDeptIcon(deptKey)}</span>
                                <span className="text-xs font-semibold text-muted-foreground">{getDeptName(deptKey)}</span>
                                <span className="text-[10px] text-muted-foreground">({grouped[deptKey].length})</span>
                              </div>
                            )}
                            {grouped[deptKey].map(collabIdx => {
                        const c = proj.collaborators[collabIdx];
                        const collabMissions = c.missions || [];

                        const addMissionToCollab = () => {
                          const updatedCollabs = [...proj.collaborators];
                          const newMission: CollaboratorMission = {
                            id: `mission-${Date.now()}`,
                            title: "",
                            description: "",
                            milestones: [],
                          };
                          updatedCollabs[collabIdx] = { ...updatedCollabs[collabIdx], missions: [...collabMissions, newMission] };
                          updateProject({ ...proj, collaborators: updatedCollabs });
                        };

                        const updateMissionField = (missionIdx: number, field: keyof CollaboratorMission, value: any) => {
                          const updatedCollabs = [...proj.collaborators];
                          const missions = [...(updatedCollabs[collabIdx].missions || [])];
                          missions[missionIdx] = { ...missions[missionIdx], [field]: value };
                          updatedCollabs[collabIdx] = { ...updatedCollabs[collabIdx], missions };
                          updateProject({ ...proj, collaborators: updatedCollabs });
                        };

                        const removeMissionFromCollab = (missionIdx: number) => {
                          const updatedCollabs = [...proj.collaborators];
                          const missions = [...(updatedCollabs[collabIdx].missions || [])];
                          missions.splice(missionIdx, 1);
                          updatedCollabs[collabIdx] = { ...updatedCollabs[collabIdx], missions };
                          updateProject({ ...proj, collaborators: updatedCollabs });
                        };

                        const addMilestoneToMission = (missionIdx: number) => {
                          const updatedCollabs = [...proj.collaborators];
                          const missions = [...(updatedCollabs[collabIdx].missions || [])];
                          const ms: MissionMilestone = {
                            id: `mms-${Date.now()}`,
                            title: "",
                            quarter: QUARTERS[0],
                            status: "planned",
                          };
                          missions[missionIdx] = { ...missions[missionIdx], milestones: [...missions[missionIdx].milestones, ms] };
                          updatedCollabs[collabIdx] = { ...updatedCollabs[collabIdx], missions };
                          updateProject({ ...proj, collaborators: updatedCollabs });
                        };

                        const updateMissionMilestone = (missionIdx: number, msId: string, field: string, value: any) => {
                          const updatedCollabs = [...proj.collaborators];
                          const missions = [...(updatedCollabs[collabIdx].missions || [])];
                          missions[missionIdx] = {
                            ...missions[missionIdx],
                            milestones: missions[missionIdx].milestones.map(m => m.id === msId ? { ...m, [field]: value } : m),
                          };
                          updatedCollabs[collabIdx] = { ...updatedCollabs[collabIdx], missions };
                          updateProject({ ...proj, collaborators: updatedCollabs });
                        };

                        const removeMissionMilestone = (missionIdx: number, msId: string) => {
                          const updatedCollabs = [...proj.collaborators];
                          const missions = [...(updatedCollabs[collabIdx].missions || [])];
                          missions[missionIdx] = {
                            ...missions[missionIdx],
                            milestones: missions[missionIdx].milestones.filter(m => m.id !== msId),
                          };
                          updatedCollabs[collabIdx] = { ...updatedCollabs[collabIdx], missions };
                          updateProject({ ...proj, collaborators: updatedCollabs });
                        };

                        const addDeliverableToMissionMs = (missionIdx: number, msId: string, link: string) => {
                          const updatedCollabs = [...proj.collaborators];
                          const missions = [...(updatedCollabs[collabIdx].missions || [])];
                          const newDel: Deliverable = {
                            id: `del-${Date.now()}`,
                            submittedBy: c.name || "Inconnu",
                            link,
                            submittedAt: new Date().toISOString(),
                          };
                          missions[missionIdx] = {
                            ...missions[missionIdx],
                            milestones: missions[missionIdx].milestones.map(m =>
                              m.id === msId ? { ...m, deliverables: [...(m.deliverables || []), newDel] } : m
                            ),
                          };
                          updatedCollabs[collabIdx] = { ...updatedCollabs[collabIdx], missions };
                          updateProject({ ...proj, collaborators: updatedCollabs });
                        };

                        return (
                          <div key={collabIdx} className="border border-border rounded-lg p-3 space-y-3">
                            {/* Collaborator identity */}
                            <div className="flex gap-2 items-center">
                              <Select
                                value={c.name || ""}
                                onValueChange={v => {
                                  const profile = userProfiles.find(u => u.full_name === v);
                                  updateCollaborator(proj, collabIdx, "name", v);
                                  if (profile?.department_id) {
                                    const updatedCollabs = [...proj.collaborators];
                                    updatedCollabs[collabIdx] = { ...updatedCollabs[collabIdx], name: v, department: profile.department_id };
                                    updateProject({ ...proj, collaborators: updatedCollabs });
                                  }
                                }}
                                disabled={!canFreeEdit(proj)}
                              >
                                <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="Sélectionner un collaborateur" /></SelectTrigger>
                                <SelectContent>
                                  {userProfiles.map(u => (
                                    <SelectItem key={u.user_id} value={u.full_name}>{u.full_name}{u.poste ? ` — ${u.poste}` : ""}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input value={c.role} onChange={e => updateCollaborator(proj, collabIdx, "role", e.target.value)} placeholder="Rôle dans le projet" className="text-sm h-8 flex-1" readOnly={!canFreeEdit(proj)} />
                              {canFreeEdit(proj) && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeCollaborator(proj, collabIdx)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>

                            {/* Missions */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Missions</Label>
                                {canFreeEdit(proj) && (
                                  <Button variant="ghost" size="sm" onClick={addMissionToCollab} className="h-6 text-[10px] gap-1">
                                    <Plus className="w-2.5 h-2.5" /> Mission
                                  </Button>
                                )}
                              </div>

                              {collabMissions.map((mission, mIdx) => (
                                <div key={mission.id} className="bg-muted/20 rounded-lg p-3 space-y-2 border border-border/50">
                                  {/* Mission header */}
                                  <div className="flex gap-2 items-center">
                                    <Input
                                      value={mission.title}
                                      onChange={e => updateMissionField(mIdx, "title", e.target.value)}
                                      placeholder="Titre de la mission"
                                      className="text-xs h-7 flex-1 font-medium"
                                      readOnly={!canFreeEdit(proj)}
                                    />
                                    {canFreeEdit(proj) && (
                                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => removeMissionFromCollab(mIdx)}>
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </Button>
                                    )}
                                  </div>
                                  <Textarea
                                    value={mission.description || ""}
                                    onChange={e => updateMissionField(mIdx, "description", e.target.value)}
                                    placeholder="Description de la mission..."
                                    rows={2}
                                    className="text-[11px]"
                                    readOnly={!canFreeEdit(proj)}
                                  />

                                  {/* Mission milestones */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Jalons</span>
                                      {canFreeEdit(proj) && (
                                        <Button variant="ghost" size="sm" onClick={() => addMilestoneToMission(mIdx)} className="h-5 text-[9px] gap-0.5 px-1.5">
                                          <Plus className="w-2 h-2" /> Jalon
                                        </Button>
                                      )}
                                    </div>
                                    {mission.milestones.map(ms => {
                                      const delivKey = `${mission.id}-${ms.id}`;
                                      const delivInput = deliverableInputs[delivKey] || { name: c.name || "", link: "" };
                                      return (
                                        <div key={ms.id} className="bg-card rounded-md p-2 space-y-1.5 border border-border">
                                          <div className="flex gap-1.5 items-center">
                                            <Select value={ms.quarter} onValueChange={v => updateMissionMilestone(mIdx, ms.id, "quarter", v)} disabled={!canFreeEdit(proj)}>
                                              <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                {QUARTERS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                                              </SelectContent>
                                            </Select>
                                            <Input value={ms.title} onChange={e => updateMissionMilestone(mIdx, ms.id, "title", e.target.value)} placeholder="Titre du jalon" className="text-[10px] h-6 flex-1" readOnly={!canFreeEdit(proj)} />
                                            <Select value={ms.status} onValueChange={v => updateMissionMilestone(mIdx, ms.id, "status", v)} disabled={!canFreeEdit(proj)}>
                                              <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="planned">Planifié</SelectItem>
                                                <SelectItem value="in-progress">En cours</SelectItem>
                                                <SelectItem value="done">Terminé</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            {canFreeEdit(proj) && (
                                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-destructive" onClick={() => removeMissionMilestone(mIdx, ms.id)}>
                                                <Trash2 className="w-2 h-2" />
                                              </Button>
                                            )}
                                          </div>

                                          {/* Deadline */}
                                          <div className="flex items-center gap-1.5">
                                            <CalendarIcon className="w-2.5 h-2.5 text-muted-foreground" />
                                            <span className="text-[9px] text-muted-foreground">Deadline :</span>
                                            {canFreeEdit(proj) ? (
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <Button variant="outline" size="sm" className={cn("h-5 text-[9px] gap-1 w-28 justify-start", !ms.deadline && "text-muted-foreground")}>
                                                    <CalendarIcon className="w-2 h-2" />
                                                    {ms.deadline ? format(new Date(ms.deadline + "T00:00:00"), "dd/MM/yyyy") : "Choisir"}
                                                  </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                  <Calendar
                                                    mode="single"
                                                    selected={ms.deadline ? new Date(ms.deadline + "T00:00:00") : undefined}
                                                    onSelect={(date) => {
                                                      if (date) updateMissionMilestone(mIdx, ms.id, "deadline", format(date, "yyyy-MM-dd"));
                                                    }}
                                                    initialFocus
                                                    className="p-3 pointer-events-auto"
                                                  />
                                                </PopoverContent>
                                              </Popover>
                                            ) : (
                                              <span className="text-[9px]">{ms.deadline ? format(new Date(ms.deadline + "T00:00:00"), "dd/MM/yyyy") : "—"}</span>
                                            )}
                                          </div>

                                          {/* Deliverable deposit */}
                                          {canFreeEdit(proj) && (
                                            <div className="flex gap-1.5 items-end">
                                              <div className="space-y-0.5 flex-[2]">
                                                <Label className="text-[8px]">Date de livraison</Label>
                                                <Input
                                                  type="date"
                                                  value={delivInput.link}
                                                  onChange={e => setDeliverableInputs(prev => ({ ...prev, [delivKey]: { ...delivInput, link: e.target.value } }))}
                                                  className="text-[9px] h-5"
                                                />
                                              </div>
                                              <Button
                                                size="sm"
                                                className="h-5 text-[8px] gap-0.5 px-1.5"
                                                onClick={() => {
                                                  if (!delivInput.link) return;
                                                  addDeliverableToMissionMs(mIdx, ms.id, delivInput.link);
                                                  setDeliverableInputs(prev => ({ ...prev, [delivKey]: { name: c.name || "", link: "" } }));
                                                  toast({ title: "Livrable déposé" });
                                                }}
                                              >
                                                <Send className="w-2 h-2" /> Déposer
                                              </Button>
                                            </div>
                                          )}

                                          {/* Existing deliverables */}
                                          {(ms.deliverables || []).length > 0 && (
                                            <div className="space-y-0.5">
                                              {(ms.deliverables || []).map(d => (
                                                <div key={d.id} className="flex items-center gap-1.5 text-[9px] bg-muted/30 rounded px-1.5 py-0.5 border border-border">
                                                  <CalendarIcon className="w-2 h-2 text-accent shrink-0" />
                                                  <span className="text-foreground">Livré le {d.link && /^\d{4}-\d{2}-\d{2}/.test(d.link) ? format(new Date(d.link + "T00:00:00"), "dd MMMM yyyy", { locale: fr }) : d.link}</span>
                                                  <span className="text-[8px] text-muted-foreground shrink-0">— déposé le {format(new Date(d.submittedAt), "dd/MM/yyyy", { locale: fr })}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                    {mission.milestones.length === 0 && (
                                      <p className="text-[9px] text-muted-foreground italic">Aucun jalon</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {collabMissions.length === 0 && (
                                <p className="text-[10px] text-muted-foreground italic">Aucune mission définie</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                          </div>
                        ));
                      })()}
                      {proj.collaborators.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">Aucun collaborateur assigné</p>
                      )}
                    </div>
                  </div>


                  {/* Project Cost (admin only) */}
                  {isAdmin && <ProjectCostSection project={proj} />}

                  {/* Expenses */}
                  <ProjectExpenses projectId={proj.id} />

                  {/* Delete */}
                  <div className="pt-4 border-t border-border flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={() => { if (confirm(`Supprimer « ${proj.name} » ?`)) { deleteProject(proj.id); setExpandedId(null); } }}
                    >
                      <Trash2 className="w-3 h-3" /> Supprimer ce projet
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>

      {/* Modification request dialog */}
      {modRequestData && (
        <ModificationRequestDialog
          open={modRequestOpen}
          onOpenChange={setModRequestOpen}
          entityType={modRequestData.entityType}
          entityId={modRequestData.entityId}
          projectId={modRequestData.projectId}
          fieldName={modRequestData.fieldName}
          oldValue={modRequestData.oldValue}
          newValue={modRequestData.newValue}
          onSuccess={() => setModRequestData(null)}
        />
      )}
    </div>
  );
};

export default ProjectsView;
