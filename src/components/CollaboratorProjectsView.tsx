import { useMemo, useState } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderKanban, GitBranch, Plus, Trash2, CheckCircle2,
  Clock, AlertTriangle, ChevronDown, ChevronUp, X,
  GanttChart, BarChart3,
} from "lucide-react";
import { parseISO, format } from "date-fns";
import { fr } from "date-fns/locale";
import type { MissionMilestone, CollaboratorMission } from "@/data/projects";

interface CollaboratorProjectsViewProps {
  onNavigateToGantt?: () => void;
}

const STATUS_LABELS: Record<MissionMilestone["status"], string> = {
  "done": "Terminé",
  "in-progress": "En cours",
  "planned": "Planifié",
};

const STATUS_COLORS: Record<MissionMilestone["status"], string> = {
  "done": "text-emerald-600 bg-emerald-50 border border-emerald-200",
  "in-progress": "text-blue-600 bg-blue-50 border border-blue-200",
  "planned": "text-slate-500 bg-slate-50 border border-slate-200",
};

const cycleStatus = (s: MissionMilestone["status"]): MissionMilestone["status"] => {
  if (s === "planned") return "in-progress";
  if (s === "in-progress") return "done";
  return "planned";
};

const fmtDate = (d: string) => {
  try { return format(parseISO(d), "dd MMM yyyy", { locale: fr }); } catch { return d; }
};

interface MilestoneForm { title: string; quarter: string; startDate: string; deadline: string; status: MissionMilestone["status"] }
interface MissionForm { title: string; description: string }
const emptyMs = (): MilestoneForm => ({ title: "", quarter: "Q1 2026", startDate: "", deadline: "", status: "planned" });
const emptyMission = (): MissionForm => ({ title: "", description: "" });

const QUARTERS = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027", "Q3 2027", "Q4 2027"];

const CollaboratorProjectsView = ({ onNavigateToGantt }: CollaboratorProjectsViewProps) => {
  const {
    projects,
    addCollaboratorMilestone,
    removeCollaboratorMilestone,
    updateCollaboratorMilestoneStatus,
    addCollaboratorMission,
    removeCollaboratorMission,
  } = useProjects();
  const { profile } = useAuth();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  // addingMsFor = { projectId, missionId }
  const [addingMsFor, setAddingMsFor] = useState<{ projectId: string; missionId: string } | null>(null);
  const [msForm, setMsForm] = useState<MilestoneForm>(emptyMs());
  // addingMissionFor = projectId
  const [addingMissionFor, setAddingMissionFor] = useState<string | null>(null);
  const [missionForm, setMissionForm] = useState<MissionForm>(emptyMission());

  const myName = profile?.full_name ?? "";

  const myProjects = useMemo(() =>
    projects.filter(p => p.collaborators?.some(c => c.name === myName)),
    [projects, myName]
  );

  const handleAddMs = (projectId: string, collabName: string, missionId: string) => {
    if (!msForm.title.trim()) return;
    const ms: MissionMilestone = {
      id: `ms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: msForm.title.trim(),
      quarter: msForm.quarter,
      status: msForm.status,
      ...(msForm.startDate ? { startDate: msForm.startDate } : {}),
      ...(msForm.deadline ? { deadline: msForm.deadline } : {}),
    };
    addCollaboratorMilestone(projectId, collabName, missionId, ms);
    setAddingMsFor(null);
    setMsForm(emptyMs());
  };

  const handleAddMission = (projectId: string, collabName: string) => {
    if (!missionForm.title.trim()) return;
    const mission: CollaboratorMission = {
      id: `mission-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: missionForm.title.trim(),
      description: missionForm.description.trim() || undefined,
      milestones: [],
    };
    addCollaboratorMission(projectId, collabName, mission);
    setAddingMissionFor(null);
    setMissionForm(emptyMission());
  };

  if (!myName) {
    return <div className="text-center text-sm text-muted-foreground py-16">Profil non chargé</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <FolderKanban className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-display font-semibold text-sm">Mes projets</p>
          <p className="text-[11px] text-muted-foreground">
            {myProjects.length} projet{myProjects.length !== 1 ? "s" : ""} assigné{myProjects.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {myProjects.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="py-12 text-center">
            <FolderKanban className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucun projet ne vous est encore assigné.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {myProjects.map(proj => {
          const myCollabs = proj.collaborators.filter(c => c.name === myName);
          const isExpanded = expandedId === proj.id;
          let totalMs = 0, doneMs = 0;
          myCollabs.forEach(c => (c.missions || []).forEach(m =>
            (m.milestones || []).forEach(ms => { totalMs++; if (ms.status === "done") doneMs++; })
          ));

          return (
            <Card key={proj.id} className="shadow-card overflow-hidden">
              <CardContent className="p-0">
                {/* Project header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                    onClick={() => setExpandedId(isExpanded ? null : proj.id)}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{proj.name}</p>
                        {proj.ganttEnabled && (
                          <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
                            <BarChart3 className="w-2.5 h-2.5" /> Gantt
                          </span>
                        )}
                      </div>
                      {proj.description && (
                        <p className="text-[11px] text-muted-foreground truncate">{proj.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {doneMs}/{totalMs} jalon{totalMs !== 1 ? "s" : ""}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  {/* Planification shortcut — only when Gantt is enabled */}
                  {proj.ganttEnabled && onNavigateToGantt && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-7 text-[10px] gap-1 border-primary/40 text-primary hover:bg-primary/10"
                      onClick={onNavigateToGantt}
                    >
                      <GanttChart className="w-3 h-3" />
                      Planification
                    </Button>
                  )}
                </div>

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/50 px-4 py-4 space-y-5 bg-muted/20">
                        {/* Gantt info banner */}
                        {proj.ganttEnabled && (
                          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                            <BarChart3 className="w-3.5 h-3.5 text-primary shrink-0" />
                            <p className="text-[11px] text-primary">
                              Le Gantt est activé pour ce projet. Définissez vos missions et jalons ci-dessous pour alimenter la page Planification.
                            </p>
                            {onNavigateToGantt && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] gap-1 ml-auto text-primary shrink-0"
                                onClick={onNavigateToGantt}
                              >
                                <GanttChart className="w-2.5 h-2.5" /> Voir
                              </Button>
                            )}
                          </div>
                        )}

                        {myCollabs.map(collab => (
                          <div key={collab.name} className="space-y-4">
                            {/* Role */}
                            {collab.role && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rôle :</span>
                                <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{collab.role}</span>
                              </div>
                            )}

                            {/* Missions header + add button */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Missions</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] gap-1"
                                onClick={() => {
                                  if (addingMissionFor === proj.id) {
                                    setAddingMissionFor(null);
                                    setMissionForm(emptyMission());
                                  } else {
                                    setAddingMissionFor(proj.id);
                                    setMissionForm(emptyMission());
                                  }
                                }}
                              >
                                {addingMissionFor === proj.id ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                {addingMissionFor === proj.id ? "Annuler" : "Nouvelle mission"}
                              </Button>
                            </div>

                            {/* Add mission form */}
                            <AnimatePresence>
                              {addingMissionFor === proj.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="ml-0 p-3 rounded-lg border border-border bg-card space-y-2">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nouvelle mission</p>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">Titre *</Label>
                                      <Input
                                        value={missionForm.title}
                                        onChange={e => setMissionForm(f => ({ ...f, title: e.target.value }))}
                                        placeholder="Ex. Développement module A"
                                        className="h-8 text-xs"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">Description (optionnel)</Label>
                                      <Textarea
                                        value={missionForm.description}
                                        onChange={e => setMissionForm(f => ({ ...f, description: e.target.value }))}
                                        placeholder="Décrivez brièvement cette mission…"
                                        rows={2}
                                        className="text-xs"
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                                        onClick={() => { setAddingMissionFor(null); setMissionForm(emptyMission()); }}>
                                        Annuler
                                      </Button>
                                      <Button size="sm" className="h-7 text-xs gap-1"
                                        onClick={() => handleAddMission(proj.id, collab.name)}
                                        disabled={!missionForm.title.trim()}>
                                        <Plus className="w-3 h-3" /> Créer
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Mission list */}
                            {(collab.missions || []).length === 0 && addingMissionFor !== proj.id && (
                              <p className="text-xs text-muted-foreground">
                                Aucune mission définie.{proj.ganttEnabled ? " Ajoutez vos missions pour alimenter le Gantt." : ""}
                              </p>
                            )}

                            {(collab.missions || []).map(mission => {
                              const isAddingHere = addingMsFor?.projectId === proj.id && addingMsFor?.missionId === mission.id;
                              return (
                                <div key={mission.id} className="space-y-2 border border-border/50 rounded-lg p-3 bg-card">
                                  {/* Mission header */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <GitBranch className="w-3 h-3 text-muted-foreground shrink-0" />
                                      <span className="text-xs font-semibold truncate">{mission.title}</span>
                                      {mission.description && (
                                        <span className="text-[10px] text-muted-foreground truncate hidden sm:block">— {mission.description}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-[10px] gap-1"
                                        onClick={() => {
                                          if (isAddingHere) { setAddingMsFor(null); setMsForm(emptyMs()); }
                                          else { setAddingMsFor({ projectId: proj.id, missionId: mission.id }); setMsForm(emptyMs()); }
                                        }}
                                      >
                                        {isAddingHere ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                        {isAddingHere ? "Annuler" : "Jalon"}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                        onClick={() => removeCollaboratorMission(proj.id, collab.name, mission.id)}
                                        title="Supprimer cette mission"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Add milestone form */}
                                  <AnimatePresence>
                                    {isAddingHere && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-3 mt-1">
                                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nouveau jalon</p>
                                          <div className="grid grid-cols-2 gap-2">
                                            <div className="col-span-2 space-y-1">
                                              <Label className="text-[11px]">Titre *</Label>
                                              <Input
                                                value={msForm.title}
                                                onChange={e => setMsForm(f => ({ ...f, title: e.target.value }))}
                                                placeholder="Ex. Livraison rapport V1"
                                                className="h-8 text-xs"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-[11px]">Trimestre</Label>
                                              <Select value={msForm.quarter} onValueChange={v => setMsForm(f => ({ ...f, quarter: v }))}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                  {QUARTERS.map(q => <SelectItem key={q} value={q} className="text-xs">{q}</SelectItem>)}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-[11px]">Date de début (Gantt)</Label>
                                              <Input type="date" value={msForm.startDate} onChange={e => setMsForm(f => ({ ...f, startDate: e.target.value }))} className="h-8 text-xs" />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-[11px]">Deadline / Date de fin</Label>
                                              <Input type="date" value={msForm.deadline} onChange={e => setMsForm(f => ({ ...f, deadline: e.target.value }))} className="h-8 text-xs" />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-[11px]">Statut</Label>
                                              <Select value={msForm.status} onValueChange={v => setMsForm(f => ({ ...f, status: v as MissionMilestone["status"] }))}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="planned" className="text-xs">Planifié</SelectItem>
                                                  <SelectItem value="in-progress" className="text-xs">En cours</SelectItem>
                                                  <SelectItem value="done" className="text-xs">Terminé</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>
                                          <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                                              onClick={() => { setAddingMsFor(null); setMsForm(emptyMs()); }}>
                                              Annuler
                                            </Button>
                                            <Button size="sm" className="h-7 text-xs gap-1"
                                              onClick={() => handleAddMs(proj.id, collab.name, mission.id)}
                                              disabled={!msForm.title.trim()}>
                                              <Plus className="w-3 h-3" /> Ajouter
                                            </Button>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>

                                  {/* Milestone list */}
                                  {(mission.milestones || []).length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground">Aucun jalon — cliquez sur "+ Jalon" pour en créer un.</p>
                                  ) : (
                                    <div className="space-y-1">
                                      {mission.milestones.map(ms => {
                                        const overdue = ms.status !== "done" && ms.deadline && parseISO(ms.deadline) < new Date();
                                        return (
                                          <div key={ms.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group">
                                            <button
                                              onClick={() => updateCollaboratorMilestoneStatus(proj.id, collab.name, mission.id, ms.id, cycleStatus(ms.status))}
                                              className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                                                ms.status === "done" ? "border-emerald-500 bg-emerald-500" :
                                                ms.status === "in-progress" ? "border-blue-400 bg-blue-100" :
                                                "border-border bg-background group-hover:border-primary/60"
                                              }`}
                                              title={`${STATUS_LABELS[ms.status]} — cliquer pour changer`}
                                            >
                                              {ms.status === "done" && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                                              {ms.status === "in-progress" && <Clock className="w-2.5 h-2.5 text-blue-600" />}
                                            </button>

                                            <span className={`text-xs flex-1 truncate ${ms.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                                              {ms.title}
                                            </span>

                                            <span className="text-[10px] text-muted-foreground shrink-0">{ms.quarter}</span>

                                            {ms.deadline && (
                                              <span className={`text-[10px] shrink-0 flex items-center gap-0.5 ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                                                {overdue && <AlertTriangle className="w-2.5 h-2.5" />}
                                                {fmtDate(ms.deadline)}
                                              </span>
                                            )}

                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium ${STATUS_COLORS[ms.status]}`}>
                                              {STATUS_LABELS[ms.status]}
                                            </span>

                                            <button
                                              onClick={() => removeCollaboratorMilestone(proj.id, collab.name, mission.id, ms.id)}
                                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                                              title="Supprimer ce jalon"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default CollaboratorProjectsView;
