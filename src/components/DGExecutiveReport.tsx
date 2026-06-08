import { useMemo } from "react";
import { useProfiles } from "@/hooks/useProfiles";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useCommittees } from "@/contexts/CommitteesContext";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users, Building2, FolderKanban, Layers, Target, CheckCircle2,
  AlertTriangle, Clock, TrendingUp, XCircle, BarChart3, type LucideIcon
} from "lucide-react";
import { parseISO, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DGExecutiveReport = () => {
  const profiles = useProfiles();
  const { departments } = useDepartments();
  const { projects } = useProjects();
  const { committees } = useCommittees();
  const { entries: timeEntries } = useTimeTracking();

  // ── Effectifs ──
  const totalCollaborators = profiles.length;
  const cadres = profiles.filter(p => (p.category || "cadre") === "cadre").length;
  const ouvriers = profiles.filter(p => (p.category || "cadre") === "ouvrier").length;
  const managers = profiles.filter(p => p.is_manager).length;

  const deptStats = useMemo(() => {
    return departments.map(d => {
      const members = profiles.filter(p => p.department_id === d.id);
      return {
        id: d.id,
        name: d.name,
        icon: d.icon,
        color: d.color,
        effectif: members.length,
        cadres: members.filter(p => (p.category || "cadre") === "cadre").length,
        ouvriers: members.filter(p => (p.category || "cadre") === "ouvrier").length,
      };
    }).sort((a, b) => b.effectif - a.effectif);
  }, [departments, profiles]);

  // ── Projects & Milestones ──
  const projectStats = useMemo(() => {
    const now = new Date();
    let totalMilestones = 0, done = 0, inProgress = 0, planned = 0, overdue = 0;
    let totalMissions = 0;
    const overdueItems: {
      project: string; collaborator: string; mission: string;
      milestone: string; deadline: string; daysOverdue: number;
    }[] = [];

    const perProject = projects.map(p => {
      let pTotal = 0, pDone = 0, pOverdue = 0, pMissions = 0;
      (p.collaborators || []).forEach(c => {
        (c.missions || []).forEach(m => {
          pMissions++;
          totalMissions++;
          (m.milestones || []).forEach(ms => {
            pTotal++; totalMilestones++;
            if (ms.status === "done") { done++; pDone++; }
            else if (ms.status === "in-progress") inProgress++;
            else planned++;
            if (ms.deadline && ms.status !== "done" && parseISO(ms.deadline) < now) {
              overdue++; pOverdue++;
              const dl = parseISO(ms.deadline);
              overdueItems.push({
                project: p.name, collaborator: c.name,
                mission: m.title || "Sans titre", milestone: ms.title,
                deadline: ms.deadline,
                daysOverdue: Math.floor((now.getTime() - dl.getTime()) / 86400000),
              });
            }
          });
        });
      });
      return {
        name: p.name, color: p.color,
        lead: Array.isArray(p.projectLead) ? p.projectLead.join(", ") : p.projectLead,
        missions: pMissions, milestones: pTotal, done: pDone, overdue: pOverdue,
        progressPct: pTotal > 0 ? Math.round((pDone / pTotal) * 100) : 0,
      };
    });

    return {
      totalProjects: projects.length, totalMissions, totalMilestones,
      done, inProgress, planned, overdue,
      progressPct: totalMilestones > 0 ? Math.round((done / totalMilestones) * 100) : 0,
      perProject: perProject.sort((a, b) => b.overdue - a.overdue),
      overdueItems: overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue),
    };
  }, [projects]);

  // ── Committees ──
  const committeeStats = useMemo(() => {
    return {
      total: committees.length,
      totalMembers: new Set(committees.flatMap(c => (c.members || []).map(m => m.name))).size,
    };
  }, [committees]);

  // ── Department milestones ──
  const deptMilestoneStats = useMemo(() => {
    const all = departments.flatMap(d => [...d.milestones2026, ...d.milestones2027]);
    return {
      total: all.length,
      done: all.filter(m => m.status === "done").length,
      inProgress: all.filter(m => m.status === "in-progress").length,
      planned: all.filter(m => m.status === "planned").length,
    };
  }, [departments]);

  // ── Time tracking ──
  const timeStats = useMemo(() => {
    const totalHours = timeEntries.reduce((s, e) => s + (e.hoursWorked || 0), 0);
    const uniqueUsers = new Set(timeEntries.map(e => e.collaboratorName)).size;
    return { totalHours: Math.round(totalHours), uniqueUsers };
  }, [timeEntries]);

  // ── Per-department project breakdown ──
  const deptProjectBreakdown = useMemo(() => {
    return departments.map(d => {
      const deptMembers = new Set(profiles.filter(p => p.department_id === d.id).map(p => p.full_name));
      let milestones = 0, done = 0, overdue = 0;
      const now = new Date();
      projects.forEach(p => {
        (p.collaborators || []).filter(c => deptMembers.has(c.name)).forEach(c => {
          (c.missions || []).forEach(m => {
            (m.milestones || []).forEach(ms => {
              milestones++;
              if (ms.status === "done") done++;
              if (ms.deadline && ms.status !== "done" && parseISO(ms.deadline) < now) overdue++;
            });
          });
        });
      });
      return {
        name: d.name, icon: d.icon,
        milestones, done, overdue,
        progressPct: milestones > 0 ? Math.round((done / milestones) * 100) : 0,
      };
    }).filter(d => d.milestones > 0).sort((a, b) => b.overdue - a.overdue);
  }, [departments, profiles, projects]);

  const KpiCard = ({ icon: Icon, label, value, sub, color }: {
    icon: LucideIcon; label: string; value: string | number; sub?: string; color?: string;
  }) => (
    <Card className="shadow-[var(--shadow-card)] border-0">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color || "bg-primary/10")}>
          <Icon className={cn("w-5 h-5", color ? "text-white" : "text-primary")} />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Rapport de pilotage — Direction Générale</h2>
          <p className="text-xs text-muted-foreground">Vue consolidée de l'ensemble de l'organisation au {format(new Date(), "dd MMMM yyyy", { locale: fr })}</p>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard icon={Users} label="Collaborateurs" value={totalCollaborators} sub={`${cadres} cadres · ${ouvriers} ouvriers`} />
        <KpiCard icon={Building2} label="Départements" value={departments.length} sub={`${managers} managers`} />
        <KpiCard icon={FolderKanban} label="Projets" value={projectStats.totalProjects} sub={`${projectStats.totalMissions} missions`} />
        <KpiCard icon={Layers} label="Comités" value={committeeStats.total} sub={`${committeeStats.totalMembers} membres`} />
        <KpiCard icon={CheckCircle2} label="Avancement global" value={`${projectStats.progressPct}%`} sub={`${projectStats.done}/${projectStats.totalMilestones} tâches`} />
        <KpiCard icon={AlertTriangle} label="Retards" value={projectStats.overdue} sub={`tâches en retard`} color="bg-destructive" />
      </div>

      {/* Milestone breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="shadow-[var(--shadow-card)] border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Tâches projets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xl font-bold text-green-600">{projectStats.done}</p>
                <p className="text-[10px] text-muted-foreground">Terminées</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600">{projectStats.inProgress}</p>
                <p className="text-[10px] text-muted-foreground">En cours</p>
              </div>
              <div>
                <p className="text-xl font-bold text-muted-foreground">{projectStats.planned}</p>
                <p className="text-[10px] text-muted-foreground">Planifiées</p>
              </div>
              <div>
                <p className="text-xl font-bold text-destructive">{projectStats.overdue}</p>
                <p className="text-[10px] text-muted-foreground">En retard</p>
              </div>
            </div>
            <Progress value={projectStats.progressPct} className="h-2" />
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)] border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Jalons départementaux
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-bold text-green-600">{deptMilestoneStats.done}</p>
                <p className="text-[10px] text-muted-foreground">Terminés</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600">{deptMilestoneStats.inProgress}</p>
                <p className="text-[10px] text-muted-foreground">En cours</p>
              </div>
              <div>
                <p className="text-xl font-bold text-muted-foreground">{deptMilestoneStats.planned}</p>
                <p className="text-[10px] text-muted-foreground">Planifiés</p>
              </div>
            </div>
            <Progress value={deptMilestoneStats.total > 0 ? Math.round((deptMilestoneStats.done / deptMilestoneStats.total) * 100) : 0} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Per-project table */}
      <Card className="shadow-[var(--shadow-card)] border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-primary" /> Avancement par projet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Projet</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Chef de projet</TableHead>
                  <TableHead className="text-[10px] text-center">Missions</TableHead>
                  <TableHead className="text-[10px] text-center">Tâches</TableHead>
                  <TableHead className="text-[10px] text-center">Avancement</TableHead>
                  <TableHead className="text-[10px] text-center">Retards</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectStats.perProject.map(p => (
                  <TableRow key={p.name}>
                    <TableCell className="text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                        {p.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.lead}</TableCell>
                    <TableCell className="text-xs text-center">{p.missions}</TableCell>
                    <TableCell className="text-xs text-center">{p.done}/{p.milestones}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center gap-2">
                        <Progress value={p.progressPct} className="h-1.5 flex-1" />
                        <span className="text-[10px] font-medium w-8">{p.progressPct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {p.overdue > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">{p.overdue}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">0</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Per-department performance */}
      <Card className="shadow-[var(--shadow-card)] border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Performance par département
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {deptProjectBreakdown.map(d => (
              <div key={d.name} className="rounded-xl border border-border/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{d.icon} {d.name}</span>
                  <span className="text-xs font-bold">{d.progressPct}%</span>
                </div>
                <Progress value={d.progressPct} className="h-1.5" />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{d.done}/{d.milestones} tâches</span>
                  {d.overdue > 0 && (
                    <span className="text-destructive font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {d.overdue} retards
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Overdue items */}
      {projectStats.overdueItems.length > 0 && (
        <Card className="shadow-[var(--shadow-card)] border-0 border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Détail des retards ({projectStats.overdueItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Projet</TableHead>
                    <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Collaborateur</TableHead>
                    <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Mission</TableHead>
                    <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Tâche</TableHead>
                    <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Deadline</TableHead>
                    <TableHead className="text-[10px] text-right">Retard</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectStats.overdueItems.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{item.project}</TableCell>
                      <TableCell className="text-xs">{item.collaborator}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.mission}</TableCell>
                      <TableCell className="text-xs">{item.milestone}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(() => { try { return format(parseISO(item.deadline), "dd MMM yyyy", { locale: fr }); } catch { return item.deadline; } })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive" className="text-[10px]">{item.daysOverdue}j</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Effectifs par département */}
      <Card className="shadow-[var(--shadow-card)] border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Effectifs par département
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {deptStats.map(d => (
              <div key={d.id} className="rounded-xl border border-border/40 p-3 flex items-center justify-between">
                <span className="text-xs font-medium">{d.icon} {d.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{d.cadres} C</Badge>
                  <Badge variant="secondary" className="text-[10px]">{d.ouvriers} O</Badge>
                  <span className="text-xs font-bold">{d.effectif}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Time tracking summary */}
      <Card className="shadow-[var(--shadow-card)] border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Temps enregistrés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{timeStats.totalHours}h</p>
              <p className="text-xs text-muted-foreground">Total heures saisies</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{timeStats.uniqueUsers}</p>
              <p className="text-xs text-muted-foreground">Collaborateurs actifs</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DGExecutiveReport;
