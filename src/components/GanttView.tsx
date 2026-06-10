import { useMemo, useState, useRef, useCallback } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Clock, AlertCircle, AlertTriangle, X, User,
  FolderKanban, CalendarDays, Link2, XCircle, ChevronDown,
  ChevronRight, BarChart3, Search, Minus,
  Pencil, Save, Plus, Upload, Download, Layers, Trash2, Users,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import type { MissionMilestone, ProjectGanttTask } from "@/data/projects";
import DataToolbar from "@/components/DataToolbar";
import GanttTaskPanel from "@/components/GanttTaskPanel";
import * as XLSX from "xlsx";

// ═══════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════

const GANTT_START = new Date("2026-01-01T00:00:00");
const GANTT_END   = new Date("2027-12-31T00:00:00");
const TOTAL_DAYS  = differenceInDays(GANTT_END, GANTT_START) + 1; // 730

const ZOOM_PX: Record<string, number> = { month: 14, quarter: 6, year: 3 };
const ZOOM_LABELS: Record<string, string> = { month: "Mois", quarter: "Trimestre", year: "Année" };

const QUARTER_DATES: Record<string, { start: string; end: string }> = {
  "Q1 2026": { start: "2026-01-01", end: "2026-03-31" },
  "Q2 2026": { start: "2026-04-01", end: "2026-06-30" },
  "Q3 2026": { start: "2026-07-01", end: "2026-09-30" },
  "Q4 2026": { start: "2026-10-01", end: "2026-12-31" },
  "Q1 2027": { start: "2027-01-01", end: "2027-03-31" },
  "Q2 2027": { start: "2027-04-01", end: "2027-06-30" },
  "Q3 2027": { start: "2027-07-01", end: "2027-09-30" },
  "Q4 2027": { start: "2027-10-01", end: "2027-12-31" },
};

// Build month headers (2026 + 2027)
const ALL_MONTHS = Array.from({ length: 24 }, (_, i) => {
  const year = 2026 + Math.floor(i / 12);
  const month = i % 12;
  const d = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offsetDays = differenceInDays(d, GANTT_START);
  return { label: format(d, "MMM", { locale: fr }), year, month, daysInMonth, offsetDays };
});

const YEAR_GROUPS = [
  { year: 2026, offsetDays: 0, totalDays: 365 },
  { year: 2027, offsetDays: 365, totalDays: 365 },
];

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

function getMsStart(ms: MissionMilestone): Date {
  if (ms.startDate) return new Date(ms.startDate + "T00:00:00");
  const q = QUARTER_DATES[ms.quarter];
  return q ? new Date(q.start + "T00:00:00") : GANTT_START;
}

function getMsEnd(ms: MissionMilestone): Date {
  if (ms.deadline) return new Date(ms.deadline + "T00:00:00");
  const q = QUARTER_DATES[ms.quarter];
  return q ? new Date(q.end + "T00:00:00") : GANTT_END;
}

function daysOffset(date: Date): number {
  return Math.max(0, Math.min(TOTAL_DAYS - 1, differenceInDays(date, GANTT_START)));
}

function fmtDate(d: string) {
  try { return format(parseISO(d), "dd MMM yyyy", { locale: fr }); } catch { return d; }
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Titre de la tâche *", "Assignés (séparés par ;)", "Date début *", "Date fin / Deadline *", "Statut", "Description", "Avancement (%)"],
    ["Développement API",   "Jean Dupont;Marie Martin",  "01/01/2026",   "31/03/2026",            "planned", "Développer les endpoints REST", "0"],
    ["Tests unitaires",     "Paul Durand",               "01/02/2026",   "28/02/2026",            "in-progress", "", "40"],
    ["Livraison V1",        "Jean Dupont",               "01/04/2026",   "15/04/2026",            "planned", "Release finale", "0"],
  ]);
  ws["!cols"] = [
    { wch: 30 }, { wch: 30 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 30 }, { wch: 15 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tâches");
  XLSX.writeFile(wb, "modele_gantt.xlsx");
}

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

interface GanttTask {
  key: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  projectLead: string;
  collabName: string;
  collabRole: string;
  missionId: string;
  missionTitle: string;
  ms: MissionMilestone;
  startDays: number;
  endDays: number;
  durationDays: number;
  isOverdue: boolean;
  hasDeliverables: boolean;
}

interface DirectTask {
  task: ProjectGanttTask;
  projectId: string;
  projectName: string;
  projectColor: string;
  startDays: number;
  endDays: number;
  durationDays: number;
  isOverdue: boolean;
}

// ═══════════════════════════════════════════════════
// Status helpers
// ═══════════════════════════════════════════════════

const STATUS_ICON = {
  done:        <CheckCircle2 className="w-3 h-3" />,
  "in-progress": <Clock className="w-3 h-3" />,
  planned:     <AlertCircle className="w-3 h-3" />,
};

const STATUS_LABEL: Record<string, string> = {
  done: "Terminé", "in-progress": "En cours", planned: "Planifié",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  done:        "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "in-progress": "bg-primary/10 text-primary border border-primary/20",
  planned:     "bg-muted text-muted-foreground border border-border",
};

// ═══════════════════════════════════════════════════
// Detail Panel (milestone)
// ═══════════════════════════════════════════════════

interface DetailPanelProps {
  task: GanttTask;
  canEdit: boolean;
  onClose: () => void;
  onSave: (milestoneId: string, updates: Partial<MissionMilestone>) => void;
}

const DetailPanel = ({ task, canEdit, onClose, onSave }: DetailPanelProps) => {
  const [editing, setEditing] = useState(false);
  const [startDate, setStartDate] = useState(task.ms.startDate || "");
  const [deadline, setDeadline] = useState(task.ms.deadline || "");
  const [status, setStatus] = useState(task.ms.status);

  const handleSave = () => {
    onSave(task.ms.id, {
      startDate: startDate || undefined,
      deadline: deadline || undefined,
      status,
    });
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ x: 420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 420, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed right-0 top-0 h-full w-[380px] bg-card border-l border-border shadow-elevated z-50 flex flex-col overflow-hidden"
    >
      <div
        className="px-5 py-4 flex items-start gap-3 border-b border-border"
        style={{ background: `linear-gradient(135deg, ${task.projectColor}18, transparent)` }}
      >
        <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: task.projectColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{task.projectName}</p>
          <p className="font-display font-bold text-sm mt-0.5 leading-tight">{task.ms.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{task.missionTitle}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE_CLASS[status]}`}>
            {STATUS_ICON[status]}
            {STATUS_LABEL[status]}
          </span>
          {task.isOverdue && (
            <span className="inline-flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded-full font-semibold border border-destructive/20">
              <AlertTriangle className="w-2.5 h-2.5" /> En retard
            </span>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Informations</p>
          <div className="space-y-1.5 bg-muted/30 rounded-lg p-3 border border-border/50">
            <div className="flex items-center gap-2 text-xs">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Assigné à</span>
              <span className="font-medium ml-auto">{task.collabName}</span>
            </div>
            {task.collabRole && (
              <div className="flex items-center gap-2 text-xs">
                <FolderKanban className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Rôle</span>
                <span className="font-medium ml-auto">{task.collabRole}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs">
              <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Trimestre</span>
              <span className="font-medium ml-auto">{task.ms.quarter}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dates</p>
          {editing ? (
            <div className="space-y-3 bg-muted/30 rounded-lg p-3 border border-border/50">
              <div className="space-y-1">
                <Label className="text-[11px]">Date de début</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Date de fin / Deadline</Label>
                <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Statut</Label>
                <Select value={status} onValueChange={v => setStatus(v as MissionMilestone["status"])}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planifié</SelectItem>
                    <SelectItem value="in-progress">En cours</SelectItem>
                    <SelectItem value="done">Terminé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs gap-1 flex-1" onClick={handleSave}>
                  <Save className="w-3 h-3" /> Enregistrer
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 bg-muted/30 rounded-lg p-3 border border-border/50">
              <div className="flex items-center gap-2 text-xs">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Début</span>
                <span className={`font-medium ml-auto ${!task.ms.startDate ? "text-muted-foreground italic" : ""}`}>
                  {task.ms.startDate ? fmtDate(task.ms.startDate) : "Inféré du trimestre"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <CalendarDays className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground">Fin / Deadline</span>
                <span className={`font-medium ml-auto ${task.isOverdue ? "text-destructive" : ""} ${!task.ms.deadline ? "text-muted-foreground italic" : ""}`}>
                  {task.ms.deadline ? fmtDate(task.ms.deadline) : "Fin du trimestre"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Durée</span>
                <span className="font-medium ml-auto">{task.durationDays} jour{task.durationDays > 1 ? "s" : ""}</span>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full mt-2"
                  onClick={() => setEditing(true)}>
                  <Pencil className="w-3 h-3" /> Modifier les dates
                </Button>
              )}
            </div>
          )}
        </div>

        {(task.ms.deliverables || []).length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Livrables ({task.ms.deliverables!.length})
            </p>
            <div className="space-y-1.5">
              {task.ms.deliverables!.map(d => (
                <div key={d.id} className="bg-muted/30 rounded-lg p-2.5 border border-border/50 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-3 h-3 text-accent shrink-0" />
                    <span className="text-xs font-medium">{d.submittedBy}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Déposé le {format(new Date(d.submittedAt), "dd MMM yyyy", { locale: fr })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════
// Main GanttView
// ═══════════════════════════════════════════════════

const GanttView = ({ onNavigateToProject }: { onNavigateToProject?: (projectId: string) => void }) => {
  const { projects, updateCollaboratorMilestone, removeGanttTask } = useProjects();
  const { isAdmin, profile } = useAuth();

  const [zoom, setZoom] = useState<"month" | "quarter" | "year">("quarter");
  const [filterProject, setFilterProject] = useState("__all__");
  const [filterCollab, setFilterCollab] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const [showOverdue, setShowOverdue] = useState(true);

  // GanttTaskPanel state
  const [taskPanel, setTaskPanel] = useState<{
    open: boolean;
    mode: "create" | "edit" | "import";
    projectId: string;
    task?: ProjectGanttTask;
  }>({ open: false, mode: "create", projectId: "" });

  const scrollRef = useRef<HTMLDivElement>(null);
  const dayPx = ZOOM_PX[zoom];
  const totalWidth = TOTAL_DAYS * dayPx;
  const canEdit = isAdmin || !!profile?.is_manager;

  // ── Projets visibles selon le rôle ──
  // Admin    → tous les projets
  // Manager  → seulement les projets dont il est chef de projet (projectLead)
  // Autres   → seulement les projets où il est listé comme collaborateur
  const visibleProjects = useMemo(() => {
    if (isAdmin) return projects;
    const name = profile?.full_name ?? "";
    if (profile?.is_manager) {
      return projects.filter(p =>
        (Array.isArray(p.projectLead) ? p.projectLead : [p.projectLead as string])
          .includes(name)
      );
    }
    return projects.filter(p =>
      p.collaborators.some(c => c.name === name)
    );
  }, [projects, isAdmin, profile]);

  // Default project for "Nouvelle tâche" button
  const defaultProjectId = useMemo(() => {
    if (filterProject !== "__all__") return filterProject;
    return visibleProjects[0]?.id ?? "";
  }, [filterProject, visibleProjects]);

  // ── Build milestone tasks ──
  const allTasks = useMemo((): GanttTask[] => {
    const now = new Date();
    const result: GanttTask[] = [];
    for (const proj of visibleProjects) {
      const leadStr = Array.isArray(proj.projectLead) ? proj.projectLead.join(", ") : (proj.projectLead || "");
      for (const collab of proj.collaborators || []) {
        for (const mission of collab.missions || []) {
          for (const ms of mission.milestones || []) {
            const start = getMsStart(ms);
            const end = getMsEnd(ms);
            const startDays = daysOffset(start);
            const endDays = daysOffset(end);
            const durationDays = Math.max(1, endDays - startDays);
            const isOverdue = ms.status !== "done" && !!ms.deadline && parseISO(ms.deadline) < now;
            result.push({
              key: `${proj.id}-${collab.name}-${mission.id}-${ms.id}`,
              projectId: proj.id,
              projectName: proj.name,
              projectColor: proj.color,
              projectLead: leadStr,
              collabName: collab.name,
              collabRole: collab.role || "",
              missionId: mission.id,
              missionTitle: mission.title || "Mission sans titre",
              ms, startDays, endDays, durationDays, isOverdue,
              hasDeliverables: (ms.deliverables || []).length > 0,
            });
          }
        }
      }
    }
    return result;
  }, [visibleProjects]);

  // ── Build direct gantt tasks ──
  const allDirectTasks = useMemo((): DirectTask[] => {
    const now = new Date();
    const result: DirectTask[] = [];
    for (const proj of visibleProjects) {
      for (const task of proj.ganttTasks || []) {
        const start = new Date(task.startDate + "T00:00:00");
        const end = new Date(task.deadline + "T00:00:00");
        const startDays = daysOffset(start);
        const endDays = daysOffset(end);
        const durationDays = Math.max(1, endDays - startDays);
        const isOverdue = task.status !== "done" && parseISO(task.deadline) < now;
        result.push({ task, projectId: proj.id, projectName: proj.name, projectColor: proj.color, startDays, endDays, durationDays, isOverdue });
      }
    }
    return result;
  }, [visibleProjects]);

  // ── Filter milestone tasks ──
  const filteredTasks = useMemo(() => allTasks.filter(t => {
    if (filterProject !== "__all__" && t.projectId !== filterProject) return false;
    if (filterCollab !== "__all__" && t.collabName !== filterCollab) return false;
    if (filterStatus !== "__all__" && t.ms.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.ms.title.toLowerCase().includes(q) && !t.missionTitle.toLowerCase().includes(q) &&
        !t.collabName.toLowerCase().includes(q) && !t.projectName.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [allTasks, filterProject, filterCollab, filterStatus, search]);

  // ── Filter direct tasks ──
  const filteredDirectTasks = useMemo(() => allDirectTasks.filter(dt => {
    if (filterProject !== "__all__" && dt.projectId !== filterProject) return false;
    if (filterStatus !== "__all__" && dt.task.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!dt.task.title.toLowerCase().includes(q) && !dt.projectName.toLowerCase().includes(q) &&
        !dt.task.assignees.some(a => a.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [allDirectTasks, filterProject, filterStatus, search]);

  // ── Group milestone tasks by project ──
  const grouped = useMemo(() => {
    const map = new Map<string, GanttTask[]>();
    for (const t of filteredTasks) {
      if (!map.has(t.projectId)) map.set(t.projectId, []);
      map.get(t.projectId)!.push(t);
    }
    return Array.from(map.entries());
  }, [filteredTasks]);

  // ── Group direct tasks by project ──
  const groupedDirect = useMemo(() => {
    const map = new Map<string, DirectTask[]>();
    for (const dt of filteredDirectTasks) {
      if (!map.has(dt.projectId)) map.set(dt.projectId, []);
      map.get(dt.projectId)!.push(dt);
    }
    return map;
  }, [filteredDirectTasks]);

  // ── All project IDs to display: tous les projets (filtrés si besoin) ──
  const allProjectIds = useMemo(() => {
    if (filterProject !== "__all__") return [filterProject];
    // Afficher uniquement les projets visibles par cet utilisateur
    return visibleProjects.map(p => p.id);
  }, [visibleProjects, filterProject]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const done = allTasks.filter(t => t.ms.status === "done").length;
    const inProgress = allTasks.filter(t => t.ms.status === "in-progress").length;
    const overdue = allTasks.filter(t => t.isOverdue).length;
    const total = allTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const directTotal = allDirectTasks.length;
    const directDone = allDirectTasks.filter(d => d.task.status === "done").length;
    return { total, done, inProgress, overdue, pct, directTotal, directDone };
  }, [allTasks, allDirectTasks]);

  const overdueItems = useMemo(() => allTasks.filter(t => t.isOverdue), [allTasks]);
  const todayOffset = daysOffset(new Date());
  const todayLeft = todayOffset * dayPx;

  // Seuls les projets visibles par cet utilisateur sont sélectionnables dans le filtre
  const projectOptions = visibleProjects;
  const collabOptions = useMemo(() => {
    const names = new Set<string>();
    allTasks.forEach(t => names.add(t.collabName));
    return Array.from(names).sort();
  }, [allTasks]);

  const toggleCollapse = useCallback((projectId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  const handleSave = useCallback((task: GanttTask, milestoneId: string, updates: Partial<MissionMilestone>) => {
    updateCollaboratorMilestone(task.projectId, task.collabName, task.missionId, milestoneId, updates);
    setSelectedTask(prev => prev ? { ...prev, ms: { ...prev.ms, ...updates } } : null);
  }, [updateCollaboratorMilestone]);

  const openTaskPanel = (mode: "create" | "edit" | "import", projId?: string, task?: ProjectGanttTask) => {
    setTaskPanel({ open: true, mode, projectId: projId ?? defaultProjectId, task });
  };

  const LEFT_W = 280;
  const ROW_H = 36;
  const HEADER_H = 56;

  // Afficher le Gantt dès qu'il y a au moins un projet visible pour cet utilisateur
  const hasAnything = visibleProjects.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <DataToolbar moduleType="gantt" />
      </div>

      {/* ═══ KPI row ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: BarChart3, color: "primary", label: "Jalons totaux", value: kpis.total },
          { icon: CheckCircle2, color: "accent", label: "Jalons terminés", value: `${kpis.done} (${kpis.pct}%)` },
          { icon: Clock, color: "primary", label: "En cours", value: kpis.inProgress },
          { icon: AlertTriangle, color: kpis.overdue > 0 ? "destructive" : "muted-foreground", label: "En retard", value: kpis.overdue },
          { icon: Layers, color: "accent", label: "Tâches directes", value: `${kpis.directDone}/${kpis.directTotal}` },
        ].map(({ icon: Icon, color, label, value }) => (
          <div key={label} className="bg-card rounded-xl border border-border shadow-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-${color}/10 flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 text-${color}`} />
            </div>
            <div>
              <p className={`text-xl font-display font-bold ${color === "destructive" && kpis.overdue > 0 ? "text-destructive" : ""}`}>
                {value}
              </p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Toolbar: nouvelle tâche + import ═══ */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 bg-card rounded-xl border border-border shadow-card px-4 py-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-2">Tâches directes :</p>
          <Button
            size="sm"
            className="h-8 gap-2 text-xs"
            onClick={() => openTaskPanel("create")}
          >
            <Plus className="w-3.5 h-3.5" />
            Nouvelle tâche
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-2 text-xs"
            onClick={() => openTaskPanel("import")}
          >
            <Upload className="w-3.5 h-3.5" />
            Importer Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-2 text-xs border-green-200 text-green-700 hover:bg-green-50"
            onClick={downloadTemplate}
          >
            <Download className="w-3.5 h-3.5" />
            Télécharger modèle
          </Button>
          <p className="text-[10px] text-muted-foreground ml-auto italic hidden md:block">
            Format Excel : Titre | Assignés (;) | Date début | Date fin | Statut | Description | Avancement%
          </p>
        </div>
      )}

      {/* ═══ Filter + Zoom bar ═══ */}
      <div className="bg-card rounded-xl border border-border shadow-card px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="relative w-44">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="pl-8 h-8 text-xs" />
        </div>

        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Tous les projets" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous les projets</SelectItem>
            {projectOptions.map(p => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCollab} onValueChange={setFilterCollab}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Tous" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous les collaborateurs</SelectItem>
            {collabOptions.map(n => <SelectItem key={n} value={n} className="text-xs">{n}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Tous statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous statuts</SelectItem>
            <SelectItem value="planned">Planifié</SelectItem>
            <SelectItem value="in-progress">En cours</SelectItem>
            <SelectItem value="done">Terminé</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-medium">Zoom :</span>
          {(["year", "quarter", "month"] as const).map(z => (
            <Button
              key={z}
              variant={zoom === z ? "default" : "outline"}
              size="sm"
              className="h-7 text-[11px] px-2.5"
              onClick={() => setZoom(z)}
            >
              {ZOOM_LABELS[z]}
            </Button>
          ))}
        </div>
      </div>

      {/* ═══ Gantt Chart ═══ */}
      {!hasAnything ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Aucune tâche à afficher</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Créez des tâches directes avec le bouton ci-dessus, ou assignez des collaborateurs avec des missions depuis la page Projets & Comités.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto" ref={scrollRef}>
            <div style={{ minWidth: LEFT_W + totalWidth + "px" }}>

              {/* ── Timeline header ── */}
              <div className="flex sticky top-0 z-20 bg-card border-b-2 border-border">
                <div
                  className="sticky left-0 z-30 bg-muted/60 border-r-2 border-border flex items-end px-3 pb-2 shrink-0 backdrop-blur-sm"
                  style={{ width: LEFT_W, minHeight: HEADER_H }}
                >
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {filteredTasks.length + filteredDirectTasks.length} tâche{(filteredTasks.length + filteredDirectTasks.length) !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="relative flex-1 bg-muted/30" style={{ minHeight: HEADER_H, minWidth: totalWidth }}>
                  {YEAR_GROUPS.map(yg => (
                    <div
                      key={yg.year}
                      className="absolute top-0 border-r border-border/60 flex items-center px-3"
                      style={{ left: yg.offsetDays * dayPx, width: yg.totalDays * dayPx, height: 24 }}
                    >
                      <span className="text-[10px] font-bold text-muted-foreground">{yg.year}</span>
                    </div>
                  ))}
                  {ALL_MONTHS.map(m => (
                    <div
                      key={`${m.year}-${m.month}`}
                      className="absolute bottom-0 border-r border-border/40 flex items-center justify-center"
                      style={{ left: m.offsetDays * dayPx, width: m.daysInMonth * dayPx, height: 32 }}
                    >
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase">
                        {zoom === "year" ? m.label.slice(0, 1) : m.label}
                      </span>
                    </div>
                  ))}
                  {todayLeft >= 0 && todayLeft <= totalWidth && (
                    <div className="absolute top-0 bottom-0 w-0.5 bg-destructive/60 z-10" style={{ left: todayLeft }} />
                  )}
                </div>
              </div>

              {/* ── Gantt rows per project ── */}
              {allProjectIds.length === 0 ? (
                <div className="flex">
                  <div className="sticky left-0 z-10 bg-card px-3 py-8 text-center" style={{ width: LEFT_W }}>
                    <p className="text-xs text-muted-foreground">Aucune tâche</p>
                  </div>
                </div>
              ) : (
                allProjectIds.map(projectId => {
                  const proj = visibleProjects.find(p => p.id === projectId);
                  if (!proj) return null;
                  const isCollapsed = collapsed.has(projectId);
                  const tasks = grouped.find(([id]) => id === projectId)?.[1] ?? [];
                  const directTasks = groupedDirect.get(projectId) ?? [];

                  // Project progress (milestones)
                  const projDone = tasks.filter(t => t.ms.status === "done").length;
                  const projPct = tasks.length > 0 ? Math.round((projDone / tasks.length) * 100) : 0;

                  const missionGroups = new Map<string, GanttTask[]>();
                  tasks.forEach(t => {
                    if (!missionGroups.has(t.missionId)) missionGroups.set(t.missionId, []);
                    missionGroups.get(t.missionId)!.push(t);
                  });

                  const allRowTasks = [...tasks, ...directTasks.map(d => ({ startDays: d.startDays, endDays: d.endDays }))];

                  return (
                    <div key={projectId}>
                      {/* Project header row */}
                      <div className="flex border-b border-border bg-muted/40 hover:bg-muted/60 transition-colors">
                        <div
                          className="sticky left-0 z-10 bg-muted/40 hover:bg-muted/60 border-r border-border flex items-center gap-2 px-3 py-2 cursor-pointer shrink-0"
                          style={{ width: LEFT_W }}
                          onClick={() => toggleCollapse(projectId)}
                        >
                          {isCollapsed
                            ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-display font-bold truncate">{proj.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Progress value={projPct} className="h-1 flex-1" />
                              <span className="text-[9px] text-muted-foreground font-mono shrink-0">{projPct}%</span>
                            </div>
                          </div>
                          {directTasks.length > 0 && (
                            <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                              {directTasks.length}T
                            </span>
                          )}
                        </div>

                        <div
                          className="relative border-b border-border/20"
                          style={{ minWidth: totalWidth, height: 40 }}
                          onClick={() => toggleCollapse(projectId)}
                        >
                          {ALL_MONTHS.map(m => (
                            <div key={`${m.year}-${m.month}`}
                              className="absolute top-0 bottom-0 border-r border-border/20"
                              style={{ left: m.offsetDays * dayPx }}
                            />
                          ))}
                          {allRowTasks.length > 0 && (() => {
                            const minStart = Math.min(...allRowTasks.map(t => t.startDays));
                            const maxEnd = Math.max(...allRowTasks.map(t => t.endDays));
                            const w = Math.max(4, (maxEnd - minStart) * dayPx);
                            return (
                              <div
                                className="absolute top-1/2 -translate-y-1/2 rounded-full opacity-30 h-2"
                                style={{ left: minStart * dayPx, width: w, backgroundColor: proj.color }}
                              />
                            );
                          })()}
                          {todayLeft >= 0 && todayLeft <= totalWidth && (
                            <div className="absolute top-0 bottom-0 w-0.5 bg-destructive/40 z-10" style={{ left: todayLeft }} />
                          )}
                        </div>
                      </div>

                      {/* Expanded rows */}
                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            {/* ── Mission/milestone rows ── */}
                            {Array.from(missionGroups.entries()).map(([missionId, mTasks]) => {
                              const missionTitle = mTasks[0].missionTitle;
                              const collabName = mTasks[0].collabName;
                              return (
                                <div key={missionId}>
                                  {/* Mission sub-header */}
                                  <div className="flex border-b border-border/50 bg-muted/15">
                                    <div
                                      className="sticky left-0 z-10 bg-muted/15 border-r border-border/50 flex items-center gap-2 px-3 py-1.5 shrink-0"
                                      style={{ width: LEFT_W }}
                                    >
                                      <div className="w-px h-4 bg-border ml-2 shrink-0" />
                                      <FolderKanban className="w-3 h-3 text-muted-foreground shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-semibold truncate">{missionTitle}</p>
                                        <p className="text-[9px] text-muted-foreground truncate">{collabName}</p>
                                      </div>
                                    </div>
                                    <div className="relative" style={{ minWidth: totalWidth, height: 30 }}>
                                      {ALL_MONTHS.map(m => (
                                        <div key={`${m.year}-${m.month}`}
                                          className="absolute top-0 bottom-0 border-r border-border/10"
                                          style={{ left: m.offsetDays * dayPx }}
                                        />
                                      ))}
                                      {(() => {
                                        const minStart = Math.min(...mTasks.map(t => t.startDays));
                                        const maxEnd = Math.max(...mTasks.map(t => t.endDays));
                                        const w = Math.max(4, (maxEnd - minStart) * dayPx);
                                        return (
                                          <div
                                            className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full opacity-40"
                                            style={{ left: minStart * dayPx, width: w, backgroundColor: proj.color }}
                                          />
                                        );
                                      })()}
                                      {todayLeft >= 0 && todayLeft <= totalWidth && (
                                        <div className="absolute top-0 bottom-0 w-0.5 bg-destructive/30 z-10" style={{ left: todayLeft }} />
                                      )}
                                    </div>
                                  </div>

                                  {/* Milestone rows */}
                                  {mTasks.map(task => {
                                    const barLeft = task.startDays * dayPx;
                                    const barWidth = Math.max(8, task.durationDays * dayPx);
                                    const isSelected = selectedTask?.key === task.key;
                                    const barColor = task.isOverdue ? "#ef4444" :
                                      task.ms.status === "done" ? "#10b981" :
                                      task.ms.status === "in-progress" ? proj.color : "#94a3b8";

                                    return (
                                      <div
                                        key={task.key}
                                        className={`flex border-b border-border/30 transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/20"}`}
                                        style={{ height: ROW_H }}
                                      >
                                        <div
                                          className="sticky left-0 z-10 border-r border-border/30 flex items-center gap-2 px-3 shrink-0 bg-card"
                                          style={{ width: LEFT_W }}
                                          onClick={() => setSelectedTask(isSelected ? null : task)}
                                        >
                                          <div className="w-px h-3 bg-border ml-4 shrink-0" />
                                          <span className={task.ms.status === "done" ? "text-emerald-500" : task.ms.status === "in-progress" ? "text-primary" : "text-muted-foreground/60"}>
                                            {STATUS_ICON[task.ms.status]}
                                          </span>
                                          <p className={`text-xs truncate flex-1 cursor-pointer ${task.ms.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                                            {task.ms.title}
                                          </p>
                                          {task.isOverdue && <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
                                          {task.hasDeliverables && <Link2 className="w-3 h-3 text-accent shrink-0" />}
                                        </div>

                                        <div
                                          className="relative cursor-pointer"
                                          style={{ minWidth: totalWidth }}
                                          onClick={() => setSelectedTask(isSelected ? null : task)}
                                        >
                                          {ALL_MONTHS.map(m => (
                                            <div key={`${m.year}-${m.month}`}
                                              className="absolute top-0 bottom-0 border-r border-border/10"
                                              style={{ left: m.offsetDays * dayPx }}
                                            />
                                          ))}
                                          <div
                                            className="absolute top-1/2 -translate-y-1/2 rounded flex items-center overflow-hidden transition-all"
                                            style={{
                                              left: barLeft, width: barWidth, height: 20,
                                              backgroundColor: barColor + "30",
                                              borderLeft: `3px solid ${barColor}`,
                                              outline: isSelected ? `2px solid ${barColor}` : "none",
                                              outlineOffset: "1px",
                                            }}
                                          >
                                            {task.ms.status === "in-progress" && (
                                              <div className="absolute left-0 top-0 bottom-0 rounded opacity-40" style={{ width: "40%", backgroundColor: barColor }} />
                                            )}
                                            {task.ms.status === "done" && (
                                              <div className="absolute left-0 top-0 bottom-0 right-0 rounded opacity-40" style={{ backgroundColor: barColor }} />
                                            )}
                                            {barWidth > 30 && (
                                              <span className="relative z-10 text-[8px] font-semibold px-1.5 truncate" style={{ color: barColor }}>
                                                {task.ms.title}
                                              </span>
                                            )}
                                          </div>
                                          {task.ms.deadline && (
                                            <div
                                              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 z-10"
                                              style={{ left: task.endDays * dayPx - 5, backgroundColor: task.isOverdue ? "#ef4444" : barColor }}
                                              title={fmtDate(task.ms.deadline)}
                                            />
                                          )}
                                          {todayLeft >= 0 && todayLeft <= totalWidth && (
                                            <div className="absolute top-0 bottom-0 w-0.5 bg-destructive/50 z-20" style={{ left: todayLeft }} />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}

                            {/* ── Empty-state quand aucune donnée pour ce projet ── */}
                            {missionGroups.size === 0 && directTasks.length === 0 && (
                              <div className="flex border-b border-border/20">
                                <div
                                  className="sticky left-0 z-10 border-r border-border/20 flex items-center gap-2 px-4 py-3 bg-card shrink-0"
                                  style={{ width: LEFT_W }}
                                >
                                  <span className="text-[10px] text-muted-foreground italic">Aucune tâche</span>
                                  {canEdit && (
                                    <button
                                      className="ml-auto flex items-center gap-1 text-[10px] text-primary hover:underline"
                                      onClick={() => openTaskPanel("create", projectId)}
                                    >
                                      <Plus className="w-3 h-3" /> Ajouter
                                    </button>
                                  )}
                                </div>
                                <div className="relative" style={{ minWidth: totalWidth, height: 36 }}>
                                  {ALL_MONTHS.map(m => (
                                    <div key={`${m.year}-${m.month}`}
                                      className="absolute top-0 bottom-0 border-r border-border/10"
                                      style={{ left: m.offsetDays * dayPx }}
                                    />
                                  ))}
                                  {todayLeft >= 0 && todayLeft <= totalWidth && (
                                    <div className="absolute top-0 bottom-0 w-0.5 bg-destructive/30" style={{ left: todayLeft }} />
                                  )}
                                </div>
                              </div>
                            )}

                            {/* ── Direct Gantt tasks section ── */}
                            {directTasks.length > 0 && (
                              <div>
                                {/* Direct tasks sub-header */}
                                <div className="flex border-b border-border/50 bg-accent/5">
                                  <div
                                    className="sticky left-0 z-10 bg-accent/5 border-r border-border/50 flex items-center gap-2 px-3 py-1.5 shrink-0"
                                    style={{ width: LEFT_W }}
                                  >
                                    <div className="w-px h-4 bg-border ml-2 shrink-0" />
                                    <Layers className="w-3 h-3 text-accent shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-semibold truncate text-accent">Tâches directes</p>
                                      <p className="text-[9px] text-muted-foreground">{directTasks.length} tâche{directTasks.length > 1 ? "s" : ""}</p>
                                    </div>
                                    {canEdit && (
                                      <button
                                        className="p-1 rounded hover:bg-accent/20 transition-colors"
                                        title="Ajouter une tâche"
                                        onClick={() => openTaskPanel("create", projectId)}
                                      >
                                        <Plus className="w-3 h-3 text-accent" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="relative" style={{ minWidth: totalWidth, height: 30 }}>
                                    {ALL_MONTHS.map(m => (
                                      <div key={`${m.year}-${m.month}`}
                                        className="absolute top-0 bottom-0 border-r border-border/10"
                                        style={{ left: m.offsetDays * dayPx }}
                                      />
                                    ))}
                                    {todayLeft >= 0 && todayLeft <= totalWidth && (
                                      <div className="absolute top-0 bottom-0 w-0.5 bg-destructive/30 z-10" style={{ left: todayLeft }} />
                                    )}
                                  </div>
                                </div>

                                {/* Direct task rows */}
                                {directTasks.map(({ task: dt, startDays, endDays, durationDays, isOverdue }) => {
                                  const barLeft = startDays * dayPx;
                                  const barWidth = Math.max(8, durationDays * dayPx);
                                  const barColor = isOverdue ? "#ef4444" :
                                    dt.status === "done" ? "#10b981" :
                                    dt.status === "in-progress" ? proj.color : "#94a3b8";
                                  const progress = dt.progress ?? 0;

                                  return (
                                    <div
                                      key={dt.id}
                                      className="flex border-b border-border/30 hover:bg-accent/5 transition-colors"
                                      style={{ height: ROW_H }}
                                    >
                                      {/* Left cell */}
                                      <div
                                        className="sticky left-0 z-10 border-r border-border/30 flex items-center gap-2 px-3 shrink-0 bg-card"
                                        style={{ width: LEFT_W }}
                                      >
                                        <div className="w-px h-3 bg-border ml-4 shrink-0" />
                                        <span className={dt.status === "done" ? "text-emerald-500" : dt.status === "in-progress" ? "text-primary" : "text-muted-foreground/60"}>
                                          {STATUS_ICON[dt.status]}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-xs truncate ${dt.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                                            {dt.title}
                                          </p>
                                          {dt.assignees.length > 0 && (
                                            <p className="text-[9px] text-muted-foreground truncate flex items-center gap-0.5">
                                              <Users className="w-2.5 h-2.5 inline shrink-0" />
                                              {dt.assignees.slice(0, 2).join(", ")}{dt.assignees.length > 2 ? ` +${dt.assignees.length - 2}` : ""}
                                            </p>
                                          )}
                                        </div>
                                        {isOverdue && <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
                                        {canEdit && (
                                          <div className="flex items-center gap-0.5 shrink-0">
                                            <button
                                              className="p-0.5 rounded hover:bg-primary/10 transition-colors"
                                              onClick={() => openTaskPanel("edit", projectId, dt)}
                                              title="Modifier"
                                            >
                                              <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
                                            </button>
                                            <button
                                              className="p-0.5 rounded hover:bg-destructive/10 transition-colors"
                                              onClick={() => removeGanttTask(projectId, dt.id)}
                                              title="Supprimer"
                                            >
                                              <Trash2 className="w-2.5 h-2.5 text-muted-foreground hover:text-destructive" />
                                            </button>
                                          </div>
                                        )}
                                      </div>

                                      {/* Timeline cell */}
                                      <div className="relative" style={{ minWidth: totalWidth }}>
                                        {ALL_MONTHS.map(m => (
                                          <div key={`${m.year}-${m.month}`}
                                            className="absolute top-0 bottom-0 border-r border-border/10"
                                            style={{ left: m.offsetDays * dayPx }}
                                          />
                                        ))}

                                        {/* Gantt bar */}
                                        <div
                                          className="absolute top-1/2 -translate-y-1/2 rounded flex items-center overflow-hidden"
                                          style={{
                                            left: barLeft, width: barWidth, height: 22,
                                            backgroundColor: barColor + "25",
                                            borderLeft: `3px solid ${barColor}`,
                                            borderTop: `1px solid ${barColor}40`,
                                            borderBottom: `1px solid ${barColor}40`,
                                          }}
                                        >
                                          {/* Progress fill */}
                                          {progress > 0 && (
                                            <div
                                              className="absolute left-0 top-0 bottom-0 rounded-r opacity-30"
                                              style={{ width: `${progress}%`, backgroundColor: barColor }}
                                            />
                                          )}
                                          {dt.status === "done" && (
                                            <div className="absolute left-0 top-0 bottom-0 right-0 opacity-35" style={{ backgroundColor: barColor }} />
                                          )}
                                          {barWidth > 40 && (
                                            <span className="relative z-10 text-[8px] font-bold px-2 truncate" style={{ color: barColor }}>
                                              {dt.title}{progress > 0 && dt.status !== "done" ? ` ${progress}%` : ""}
                                            </span>
                                          )}
                                        </div>

                                        {/* Deadline diamond */}
                                        <div
                                          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 z-10 border border-white/50"
                                          style={{ left: endDays * dayPx - 5, backgroundColor: isOverdue ? "#ef4444" : barColor }}
                                          title={`Deadline : ${fmtDate(dt.deadline)}`}
                                        />

                                        {todayLeft >= 0 && todayLeft <= totalWidth && (
                                          <div className="absolute top-0 bottom-0 w-0.5 bg-destructive/50 z-20" style={{ left: todayLeft }} />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}

              {/* Today marker label */}
              {todayLeft >= 0 && todayLeft <= totalWidth && (
                <div className="relative h-6 border-t border-border/30">
                  <div className="absolute top-0 bottom-0 w-0.5 bg-destructive/60" style={{ left: LEFT_W + todayLeft }} />
                  <div
                    className="absolute -top-0 -translate-x-1/2 text-[8px] font-bold text-destructive bg-destructive/10 px-1 rounded"
                    style={{ left: LEFT_W + todayLeft }}
                  >
                    Aujourd'hui
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Legend ═══ */}
      {hasAnything && (
        <div className="bg-card rounded-xl border border-border px-4 py-3 flex flex-wrap items-center gap-5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Légende :</span>
          {[
            { color: "#10b981", label: "Terminé" },
            { color: "hsl(var(--primary))", label: "En cours" },
            { color: "#94a3b8", label: "Planifié" },
            { color: "#ef4444", label: "En retard" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-6 h-3 rounded border-l-2" style={{ backgroundColor: color + "30", borderColor: color }} />
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rotate-45" style={{ backgroundColor: "#64748b" }} />
            <span className="text-[11px] text-muted-foreground">Deadline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-4 bg-destructive" />
            <span className="text-[11px] text-muted-foreground">Aujourd'hui</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-3 rounded border-l-2 border-accent bg-accent/20" />
            <span className="text-[11px] text-muted-foreground">Tâche directe (avec % progression)</span>
          </div>
          {canEdit && (
            <span className="text-[10px] text-muted-foreground ml-auto italic">
              Cliquez sur une tâche jalonnée pour modifier · Icônes crayon/poubelle pour les tâches directes
            </span>
          )}
        </div>
      )}

      {/* ═══ Rapport des retards ═══ */}
      {overdueItems.length > 0 && (
        <div className="bg-card rounded-2xl border-2 border-destructive/30 shadow-card overflow-hidden">
          <button
            className="w-full bg-destructive/10 px-4 py-3 flex items-center gap-2 border-b border-destructive/20 hover:bg-destructive/15 transition-colors"
            onClick={() => setShowOverdue(v => !v)}
          >
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <h3 className="font-display font-bold text-sm text-destructive flex-1 text-left">
              Livrables non respectés ({overdueItems.length})
            </h3>
            {showOverdue ? <ChevronDown className="w-4 h-4 text-destructive" /> : <ChevronRight className="w-4 h-4 text-destructive" />}
          </button>
          <AnimatePresence>
            {showOverdue && (
              <motion.div
                initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                transition={{ duration: 0.2 }} className="overflow-hidden"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Projet", "Responsable", "Collaborateur", "Mission", "Jalon", "Deadline", "Retard", "Livrable"].map(h => (
                          <th key={h} className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {overdueItems.map(t => (
                        <tr key={t.key} className="border-b border-border last:border-0 hover:bg-destructive/5 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.projectColor }} />
                              <span className="text-xs font-medium whitespace-nowrap">{t.projectName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{t.projectLead || "—"}</td>
                          <td className="px-4 py-2.5 text-xs whitespace-nowrap">{t.collabName}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{t.missionTitle}</td>
                          <td className="px-4 py-2.5 text-xs font-medium whitespace-nowrap">{t.ms.title}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="text-xs font-semibold text-destructive">
                              {t.ms.deadline ? fmtDate(t.ms.deadline) : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                              {differenceInDays(new Date(), parseISO(t.ms.deadline!))}j
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {t.hasDeliverables
                              ? <span className="text-xs text-accent flex items-center gap-1"><Link2 className="w-3 h-3" /> Déposé</span>
                              : <span className="text-xs text-destructive flex items-center gap-1 font-semibold"><XCircle className="w-3 h-3" /> Non déposé</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ═══ Detail Panel — milestones (slide-in) ═══ */}
      <AnimatePresence>
        {selectedTask && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setSelectedTask(null)}
            />
            <DetailPanel
              task={selectedTask}
              canEdit={canEdit}
              onClose={() => setSelectedTask(null)}
              onSave={(milestoneId, updates) => handleSave(selectedTask, milestoneId, updates)}
            />
          </>
        )}
      </AnimatePresence>

      {/* ═══ GanttTaskPanel — tâches directes (slide-in) ═══ */}
      <AnimatePresence>
        {taskPanel.open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setTaskPanel(p => ({ ...p, open: false }))}
            />
            <GanttTaskPanel
              mode={taskPanel.mode}
              projectId={taskPanel.projectId}
              task={taskPanel.task}
              onClose={() => setTaskPanel(p => ({ ...p, open: false }))}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GanttView;
