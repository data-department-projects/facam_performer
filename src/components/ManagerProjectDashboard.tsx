import { useMemo, useState } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderKanban, CheckCircle2, Clock, AlertTriangle, TrendingUp,
  Search, ChevronDown, ChevronUp, CalendarDays, GitBranch, User,
} from "lucide-react";
import { parseISO, format } from "date-fns";
import { fr } from "date-fns/locale";
import type { MissionMilestone } from "@/data/projects";

interface ManagerProjectDashboardProps {
  onNavigateToGantt?: () => void;
}

const STATUS_LABELS: Record<MissionMilestone["status"], string> = {
  "done": "Terminé",
  "in-progress": "En cours",
  "planned": "Planifié",
};

const STATUS_COLORS: Record<MissionMilestone["status"], string> = {
  "done": "text-emerald-600 bg-emerald-50",
  "in-progress": "text-blue-600 bg-blue-50",
  "planned": "text-slate-500 bg-slate-50",
};

const cycleStatus = (s: MissionMilestone["status"]): MissionMilestone["status"] => {
  if (s === "planned") return "in-progress";
  if (s === "in-progress") return "done";
  return "planned";
};

const fmtDate = (d: string) => {
  try { return format(parseISO(d), "dd MMM yyyy", { locale: fr }); } catch { return d; }
};

const isOverdueMs = (ms: MissionMilestone) => {
  if (ms.status === "done" || !ms.deadline) return false;
  return parseISO(ms.deadline) < new Date();
};

const ManagerProjectDashboard = ({ onNavigateToGantt }: ManagerProjectDashboardProps) => {
  const { projects, updateCollaboratorMilestoneStatus } = useProjects();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const kpis = useMemo(() => {
    let totalMs = 0, doneMs = 0, overdue = 0;
    projects.forEach(p =>
      p.collaborators?.forEach(c =>
        (c.missions || []).forEach(m =>
          (m.milestones || []).forEach(ms => {
            totalMs++;
            if (ms.status === "done") doneMs++;
            if (isOverdueMs(ms)) overdue++;
          })
        )
      )
    );
    return {
      totalProjects: projects.length,
      totalMs, doneMs, overdue,
      globalPct: totalMs > 0 ? Math.round((doneMs / totalMs) * 100) : 0,
    };
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return projects.filter(p =>
      !q || p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)
    );
  }, [projects, search]);

  const withProgress = useMemo(() => filtered.map(p => {
    let total = 0, done = 0, overdue = 0;
    p.collaborators?.forEach(c =>
      (c.missions || []).forEach(m =>
        (m.milestones || []).forEach(ms => {
          total++;
          if (ms.status === "done") done++;
          if (isOverdueMs(ms)) overdue++;
        })
      )
    );
    return { ...p, total, done, overdue, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }), [filtered]);

  return (
    <div className="space-y-6">
      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: FolderKanban, color: "primary", label: "Projets", value: kpis.totalProjects },
          { icon: CheckCircle2, color: "accent", label: "Jalons terminés", value: `${kpis.doneMs}/${kpis.totalMs}` },
          { icon: TrendingUp, color: "primary", label: "Avancement global", value: `${kpis.globalPct}%` },
          { icon: AlertTriangle, color: kpis.overdue > 0 ? "destructive" : "muted-foreground", label: "En retard", value: kpis.overdue },
        ].map(({ icon: Icon, color, label, value }) => (
          <Card key={label} className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg bg-${color}/10 flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 text-${color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-display font-bold ${color === "destructive" && kpis.overdue > 0 ? "text-destructive" : ""}`}>
                    {value}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher un projet…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        {onNavigateToGantt && (
          <Button variant="outline" size="sm" onClick={onNavigateToGantt} className="h-8 gap-2 text-xs">
            <CalendarDays className="w-3.5 h-3.5" />
            Voir Gantt
          </Button>
        )}
      </div>

      {/* ── Project list ── */}
      <div className="space-y-3">
        {withProgress.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">Aucun projet trouvé</div>
        )}
        {withProgress.map(proj => {
          const isExpanded = expandedId === proj.id;
          return (
            <Card key={proj.id} className="shadow-card overflow-hidden">
              <CardContent className="p-0">
                {/* ── Project header row ── */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => setExpandedId(isExpanded ? null : proj.id)}
                >
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
                  <span className="font-medium text-sm flex-1 truncate">{proj.name}</span>
                  {proj.overdue > 0 && (
                    <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full shrink-0">
                      {proj.overdue} retard{proj.overdue > 1 ? "s" : ""}
                    </span>
                  )}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-20 hidden sm:block">
                      <Progress value={proj.pct} className="h-1.5" />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono w-10 text-right">{proj.pct}%</span>
                    <span className="text-xs text-muted-foreground">{proj.done}/{proj.total}</span>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* ── Milestone validation area ── */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/50 px-4 py-3 space-y-4 bg-muted/20">
                        {(proj.collaborators || []).length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">Aucun collaborateur assigné</p>
                        ) : (
                          proj.collaborators.map(collab => (
                            <div key={collab.name} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs font-semibold">{collab.name}</span>
                                {collab.role && (
                                  <span className="text-[10px] text-muted-foreground">— {collab.role}</span>
                                )}
                              </div>
                              {(collab.missions || []).length === 0 ? (
                                <p className="text-[11px] text-muted-foreground ml-5">Aucune mission définie</p>
                              ) : (
                                (collab.missions || []).map(mission => (
                                  <div key={mission.id} className="ml-5 space-y-1">
                                    <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 py-0.5">
                                      <GitBranch className="w-3 h-3" />
                                      {mission.title}
                                    </p>
                                    {(mission.milestones || []).length === 0 ? (
                                      <p className="text-[11px] text-muted-foreground ml-5">Aucun jalon</p>
                                    ) : (
                                      <div className="ml-5 space-y-0.5">
                                        {mission.milestones.map(ms => {
                                          const overdue = isOverdueMs(ms);
                                          return (
                                            <div
                                              key={ms.id}
                                              className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group"
                                            >
                                              {/* Status toggle button */}
                                              <button
                                                onClick={() => updateCollaboratorMilestoneStatus(
                                                  proj.id, collab.name, mission.id, ms.id,
                                                  cycleStatus(ms.status)
                                                )}
                                                className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                                                  ms.status === "done"
                                                    ? "border-emerald-500 bg-emerald-500"
                                                    : ms.status === "in-progress"
                                                    ? "border-blue-400 bg-blue-100"
                                                    : "border-border bg-background group-hover:border-primary/60"
                                                }`}
                                                title={`${STATUS_LABELS[ms.status]} — cliquer pour changer`}
                                              >
                                                {ms.status === "done" && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                                                {ms.status === "in-progress" && <Clock className="w-2.5 h-2.5 text-blue-600" />}
                                              </button>

                                              <span className={`text-xs flex-1 truncate ${ms.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                                                {ms.title}
                                              </span>

                                              {ms.deadline && (
                                                <span className={`text-[10px] shrink-0 ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                                                  {fmtDate(ms.deadline)}{overdue && " ⚠"}
                                                </span>
                                              )}

                                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium ${STATUS_COLORS[ms.status]}`}>
                                                {STATUS_LABELS[ms.status]}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          ))
                        )}
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

export default ManagerProjectDashboard;
