import { useMemo, useState, useEffect } from "react";
import { useProfiles } from "@/hooks/useProfiles";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useCommittees } from "@/contexts/CommitteesContext";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, Building2, Layers, TrendingUp, CheckCircle2, Clock, AlertCircle,
  FolderKanban, CalendarDays, AlertTriangle, XCircle, Link2, User, DollarSign
} from "lucide-react";
import DataToolbar from "@/components/DataToolbar";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { parseISO, format } from "date-fns";
import { fr } from "date-fns/locale";
import WeeklyAnalysisCard from "@/components/WeeklyAnalysisCard";
import PersonalDashboard from "@/components/PersonalDashboard";

const DashboardView = () => {
  const { departments } = useDepartments();
  const { projects } = useProjects();
  const { committees } = useCommittees();
  const { entries: timeEntries } = useTimeTracking();
  const { isAdmin, allowedModules } = useAuth();

  // Salary data + expenses for cost dashboard
  const [salaryMap, setSalaryMap] = useState<Record<string, number | null>>({});
  const [expensesByProject, setExpensesByProject] = useState<Record<string, number>>({});
  const [expenseDetails, setExpenseDetails] = useState<any[]>([]);
  const [costDetailProject, setCostDetailProject] = useState<string | null>(null);

  const hasCostAccess = isAdmin || allowedModules.includes("project_costs") || allowedModules.includes("weekly_analysis");

  useEffect(() => {
    if (!hasCostAccess) return;
    const load = async () => {
      const [salaryRes, expenseRes, expenseDetailRes] = await Promise.all([
        supabase.from("profiles").select("full_name, salary") as any,
        supabase.from("project_expenses").select("project_id, amount"),
        supabase.from("project_expenses").select("project_id, description, amount, expense_date, created_by"),
      ]);
      if (salaryRes.data) {
        const map: Record<string, number | null> = {};
        (salaryRes.data as any[]).forEach((p: any) => { map[p.full_name] = p.salary ?? null; });
        setSalaryMap(map);
      }
      if (expenseRes.data) {
        const map: Record<string, number> = {};
        (expenseRes.data as any[]).forEach((e: any) => {
          map[e.project_id] = (map[e.project_id] || 0) + (e.amount || 0);
        });
        setExpensesByProject(map);
      }
      if (expenseDetailRes.data) {
        setExpenseDetails(expenseDetailRes.data);
      }
    };
    load();
  }, [isAdmin]);

  // ── Department stats ──
  const totalToday = departments.reduce((a, d) => a + d.compositionToday.length, 0);
  const totalTomorrow = departments.reduce((a, d) => a + d.compositionTomorrow.length, 0);
  const totalServices = departments.reduce((a, d) => a + d.services.length, 0);

  // ── Department milestones ──
  const deptMilestones = departments.flatMap(d => [...d.milestones2026, ...d.milestones2027]);
  const deptDone = deptMilestones.filter(m => m.status === "done").length;
  const deptInProgress = deptMilestones.filter(m => m.status === "in-progress").length;
  const deptPlanned = deptMilestones.filter(m => m.status === "planned").length;

  // ── Project stats ──
  const totalCollaborators = useMemo(() => {
    const names = new Set<string>();
    projects.forEach(p => p.collaborators?.forEach(c => { if (c.name) names.add(c.name); }));
    return names.size;
  }, [projects]);

  const totalMissions = useMemo(() => {
    let count = 0;
    projects.forEach(p => p.collaborators?.forEach(c => { count += (c.missions || []).length; }));
    return count;
  }, [projects]);

  // ── Mission milestones (from project collaborators) ──
  const missionMilestoneStats = useMemo(() => {
    let done = 0, inProgress = 0, planned = 0, overdue = 0, total = 0;
    const now = new Date();
    projects.forEach(p => {
      p.collaborators?.forEach(c => {
        (c.missions || []).forEach(m => {
          (m.milestones || []).forEach(ms => {
            total++;
            if (ms.status === "done") done++;
            else if (ms.status === "in-progress") inProgress++;
            else planned++;
            if (ms.deadline && ms.status !== "done" && parseISO(ms.deadline) < now) overdue++;
          });
        });
      });
    });
    return { done, inProgress, planned, overdue, total };
  }, [projects]);

  const globalTotal = deptMilestones.length + missionMilestoneStats.total;
  const globalDone = deptDone + missionMilestoneStats.done;
  const globalProgressPct = globalTotal > 0 ? Math.round((globalDone / globalTotal) * 100) : 0;

  // ── Time tracking ──
  const totalHoursLogged = useMemo(() => {
    return timeEntries.reduce((a, e) => a + (e.hoursWorked || 0), 0);
  }, [timeEntries]);

  // ── Overdue milestones detail ──
  const overdueItems = useMemo(() => {
    const now = new Date();
    const items: {
      projectName: string; projectColor: string; projectLead: string;
      collaborator: string; mission: string; milestone: string;
      deadline: string; daysOverdue: number; hasDeliverables: boolean;
    }[] = [];
    projects.forEach(proj => {
      const lead = Array.isArray(proj.projectLead) ? proj.projectLead.join(", ") : proj.projectLead;
      (proj.collaborators || []).forEach(c => {
        (c.missions || []).forEach(m => {
          (m.milestones || []).forEach(ms => {
            if (!ms.deadline || ms.status === "done") return;
            const dl = parseISO(ms.deadline);
            if (dl >= now) return;
            items.push({
              projectName: proj.name, projectColor: proj.color, projectLead: lead,
              collaborator: c.name, mission: m.title || "Mission sans titre",
              milestone: ms.title, deadline: ms.deadline,
              daysOverdue: Math.floor((now.getTime() - dl.getTime()) / 86400000),
              hasDeliverables: (ms.deliverables || []).length > 0,
            });
          });
        });
      });
    });
    return items.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [projects]);

  // ── Charts ──
  const profiles = useProfiles();
  const staffData = departments.map(d => ({
    name: d.icon + " " + d.name.replace(/^Département\s+/, "").substring(0, 12),
    effectif: profiles.filter(p => p.department_id === d.id).length,
  }));

  const allStatusData = [
    { name: "Terminé", value: globalDone, fill: "hsl(var(--accent))" },
    { name: "En cours", value: deptInProgress + missionMilestoneStats.inProgress, fill: "hsl(var(--secondary))" },
    { name: "Planifié", value: deptPlanned + missionMilestoneStats.planned, fill: "hsl(var(--muted))" },
  ].filter(d => d.value > 0);

  const staffChartConfig: ChartConfig = {
    effectif: { label: "Effectif", color: "hsl(var(--primary))" },
  };

  // Project progress
  const projectProgress = useMemo(() => {
    return projects.map(p => {
      let total = 0, done = 0;
      (p.collaborators || []).forEach(c => {
        (c.missions || []).forEach(m => {
          (m.milestones || []).forEach(ms => {
            total++;
            if (ms.status === "done") done++;
          });
        });
      });
      return { name: p.name, color: p.color, total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
    });
  }, [projects]);

  const formatDeadline = (d: string) => {
    try { return format(parseISO(d), "dd MMM yyyy", { locale: fr }); } catch { return d; }
  };

  // Non-admin users get a personalized dashboard
  if (!isAdmin) {
    return <PersonalDashboard />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <DataToolbar moduleType="dashboard" />
      </div>

      {/* ═══ KPI CARDS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{departments.length}</p>
                <p className="text-[11px] text-muted-foreground">Départements</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{profiles.length}</p>
                <p className="text-[11px] text-muted-foreground">Collaborateurs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
                <FolderKanban className="w-4 h-4 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{projects.length}</p>
                <p className="text-[11px] text-muted-foreground">Projets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{committees.length}</p>
                <p className="text-[11px] text-muted-foreground">Comités</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{globalProgressPct}%</p>
                <p className="text-[11px] text-muted-foreground">Avancement</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-destructive">{missionMilestoneStats.overdue}</p>
                <p className="text-[11px] text-muted-foreground">En retard</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ SUMMARY METRICS ROW ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-card border-l-4 border-l-primary">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Missions actives</p>
            <p className="text-xl font-display font-bold mt-1">{totalMissions}</p>
            <p className="text-[10px] text-muted-foreground">{totalCollaborators} collaborateur(s) impliqué(s)</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-l-4 border-l-accent">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Jalons missions</p>
            <p className="text-xl font-display font-bold mt-1">{missionMilestoneStats.done} / {missionMilestoneStats.total}</p>
            <p className="text-[10px] text-muted-foreground">terminés</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-l-4 border-l-secondary">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Heures saisies</p>
            <p className="text-xl font-display font-bold mt-1">{totalHoursLogged.toFixed(1)}h</p>
            <p className="text-[10px] text-muted-foreground">{timeEntries.length} entrée(s)</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-l-4 border-l-muted-foreground">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Services</p>
            <p className="text-xl font-display font-bold mt-1">{totalServices}</p>
            <p className="text-[10px] text-muted-foreground">dans {departments.length} département(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ CHARTS ═══ */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Staffing chart */}
        <Card className="shadow-card bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Effectifs par département</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={staffChartConfig} className="h-[220px] w-full">
              <BarChart data={staffData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="effectif" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Global milestones status */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Statut global des jalons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="h-[180px] w-[180px]">
                {allStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allStatusData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} strokeWidth={2}>
                        {allStatusData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} stroke="hsl(var(--card))" />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Aucun jalon</div>
                )}
              </div>
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span className="text-sm flex-1">Terminé</span>
                  <span className="font-display font-bold">{globalDone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-secondary-foreground" />
                  <span className="text-sm flex-1">En cours</span>
                  <span className="font-display font-bold">{deptInProgress + missionMilestoneStats.inProgress}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1">Planifié</span>
                  <span className="font-display font-bold">{deptPlanned + missionMilestoneStats.planned}</span>
                </div>
                {missionMilestoneStats.overdue > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-sm flex-1 text-destructive font-medium">En retard</span>
                    <span className="font-display font-bold text-destructive">{missionMilestoneStats.overdue}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ AVANCEMENT PAR PROJET ═══ */}
      {projectProgress.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Avancement par projet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {projectProgress.map(p => (
              <div key={p.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="font-medium">{p.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{p.done}/{p.total} — {p.pct}%</span>
                </div>
                <Progress value={p.pct} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ═══ COÛT PROJET (module project_costs) ═══ */}
      {(isAdmin || allowedModules.includes("project_costs")) && (() => {
        const MONTHLY_HOURS = 173.33;
        const projectCosts = projects.map(proj => {
          const projEntries = timeEntries.filter(e => e.projectId === proj.id);
          const byCollab: Record<string, { hours: number; salary: number | null }> = {};
          for (const entry of projEntries) {
            if (!byCollab[entry.collaboratorName]) {
              byCollab[entry.collaboratorName] = { hours: 0, salary: salaryMap[entry.collaboratorName] ?? null };
            }
            byCollab[entry.collaboratorName].hours += entry.hoursWorked;
          }
          const collabs = Object.entries(byCollab).map(([name, d]) => ({
            name, hours: d.hours,
            hourlyRate: d.salary ? d.salary / MONTHLY_HOURS : null,
            cost: d.salary ? (d.salary / MONTHLY_HOURS) * d.hours : null,
          }));
          const humanCost = collabs.reduce((s, c) => s + (c.cost ?? 0), 0);
          const totalHours = collabs.reduce((s, c) => s + c.hours, 0);
          const expenses = expensesByProject[proj.id] || 0;
          const totalCost = humanCost + expenses;
          return { id: proj.id, name: proj.name, color: proj.color, humanCost, expenses, totalCost, totalHours, collabs };
        });

        const grandHumanCost = projectCosts.reduce((s, p) => s + p.humanCost, 0);
        const grandExpenses = projectCosts.reduce((s, p) => s + p.expenses, 0);
        const grandTotal = grandHumanCost + grandExpenses;
        const detailProject = projectCosts.find(p => p.id === costDetailProject);

        return (
          <>
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  Coût des projets
                </CardTitle>
                <div className="flex flex-wrap gap-3 mt-1">
                  <p className="text-[10px] text-muted-foreground">
                    Coût total : <span className="font-bold text-foreground">{Math.round(grandTotal).toLocaleString("fr-FR")} Fr CFA</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Coût humain : <span className="font-semibold text-foreground">{Math.round(grandHumanCost).toLocaleString("fr-FR")} Fr CFA</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Dépenses : <span className="font-semibold text-foreground">{Math.round(grandExpenses).toLocaleString("fr-FR")} Fr CFA</span>
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Projet</TableHead>
                      <TableHead className="text-[10px] text-right">Heures</TableHead>
                      <TableHead className="text-[10px] text-right">Coût humain</TableHead>
                      <TableHead className="text-[10px] text-right">Dépenses</TableHead>
                      <TableHead className="text-[10px] text-right">Coût total</TableHead>
                      <TableHead className="text-[10px] text-right">Détail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectCosts.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                            <span className="font-medium truncate max-w-[180px]">{p.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-right">{p.totalHours > 0 ? `${p.totalHours.toFixed(1)}h` : "—"}</TableCell>
                        <TableCell className="text-xs text-right">{p.humanCost > 0 ? `${Math.round(p.humanCost).toLocaleString("fr-FR")}` : "—"}</TableCell>
                        <TableCell className="text-xs text-right">{p.expenses > 0 ? `${Math.round(p.expenses).toLocaleString("fr-FR")}` : "—"}</TableCell>
                        <TableCell className="text-xs text-right font-bold">{p.totalCost > 0 ? `${Math.round(p.totalCost).toLocaleString("fr-FR")}` : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setCostDetailProject(p.id)} disabled={p.totalHours === 0 && p.expenses === 0}>
                            Détail
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {projectCosts.length > 0 && (
                      <TableRow className="font-semibold border-t-2 bg-muted/30">
                        <TableCell className="text-xs">Total</TableCell>
                        <TableCell className="text-xs text-right">{projectCosts.reduce((s, p) => s + p.totalHours, 0).toFixed(1)}h</TableCell>
                        <TableCell className="text-xs text-right">{Math.round(grandHumanCost).toLocaleString("fr-FR")}</TableCell>
                        <TableCell className="text-xs text-right">{Math.round(grandExpenses).toLocaleString("fr-FR")}</TableCell>
                        <TableCell className="text-xs text-right">{Math.round(grandTotal).toLocaleString("fr-FR")}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    )}
                    {projectCosts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">Aucun projet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Dialog open={!!costDetailProject} onOpenChange={o => { if (!o) setCostDetailProject(null); }}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4" /> Coût détaillé — {detailProject?.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Human cost table */}
                  {(detailProject?.collabs || []).length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Coût humain</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Collaborateur</TableHead>
                            <TableHead className="text-[10px] text-right">Heures</TableHead>
                            <TableHead className="text-[10px] text-right">Taux horaire</TableHead>
                            <TableHead className="text-[10px] text-right">Coût</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(detailProject?.collabs || []).map(c => (
                            <TableRow key={c.name}>
                              <TableCell className="text-xs">{c.name}</TableCell>
                              <TableCell className="text-xs text-right">{c.hours.toFixed(1)}h</TableCell>
                              <TableCell className="text-xs text-right">
{c.hourlyRate != null ? `${Math.round(c.hourlyRate).toLocaleString("fr-FR")} Fr CFA` : <span className="text-muted-foreground italic">Non défini</span>}
                              </TableCell>
                              <TableCell className="text-xs text-right font-medium">
                                {c.cost != null ? `${Math.round(c.cost).toLocaleString("fr-FR")} Fr CFA` : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold border-t-2">
                            <TableCell className="text-xs">Sous-total humain</TableCell>
                            <TableCell className="text-xs text-right">{detailProject?.totalHours.toFixed(1)}h</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-xs text-right">{Math.round(detailProject?.humanCost ?? 0).toLocaleString("fr-FR")} Fr CFA</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 border border-border/30">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Coût humain</span>
                      <span className="font-medium">{Math.round(detailProject?.humanCost ?? 0).toLocaleString("fr-FR")} Fr CFA</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Dépenses projet</span>
                      <span className="font-medium">{Math.round(detailProject?.expenses ?? 0).toLocaleString("fr-FR")} Fr CFA</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-border pt-1.5 mt-1.5">
                      <span>Coût total</span>
                      <span>{Math.round(detailProject?.totalCost ?? 0).toLocaleString("fr-FR")} Fr CFA</span>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        );
      })()}

      {/* ═══ ANALYSE HEBDOMADAIRE IA (module weekly_analysis) ═══ */}
      {(isAdmin || allowedModules.includes("weekly_analysis")) && (() => {
        const MONTHLY_HOURS_AI = 173.33;
        const analysisData = projects.map(proj => {
          const projEntries = timeEntries.filter(e => e.projectId === proj.id);
          const byCollab: Record<string, { hours: number; salary: number | null }> = {};
          for (const entry of projEntries) {
            if (!byCollab[entry.collaboratorName]) {
              byCollab[entry.collaboratorName] = { hours: 0, salary: salaryMap[entry.collaboratorName] ?? null };
            }
            byCollab[entry.collaboratorName].hours += entry.hoursWorked;
          }
          const collabs = Object.entries(byCollab).map(([name, d]) => ({
            name, hours: d.hours,
            hourlyRate: d.salary ? d.salary / MONTHLY_HOURS_AI : null,
            cost: d.salary ? (d.salary / MONTHLY_HOURS_AI) * d.hours : null,
          }));
          const humanCost = collabs.reduce((s, c) => s + (c.cost ?? 0), 0);
          const totalHours = collabs.reduce((s, c) => s + c.hours, 0);
          const expenses = expensesByProject[proj.id] || 0;

          // Milestones from collaborators
          const milestones = proj.collaborators.flatMap(c =>
            (c.missions || []).flatMap(m =>
              (m.milestones || []).map(ms => ({
                title: ms.title,
                status: ms.status,
                deadline: ms.deadline,
                deliverables: (ms.deliverables || []).map(d => ({ submittedAt: d.submittedAt, link: d.link })),
              }))
            )
          );

          // Expense details for this project
          const projExpenseDetails = expenseDetails
            .filter((e: any) => e.project_id === proj.id)
            .map((e: any) => ({
              description: e.description,
              amount: e.amount,
              date: e.expense_date,
              createdBy: e.created_by,
            }));

          return {
            name: proj.name,
            totalHours,
            humanCost,
            expenses,
            totalCost: humanCost + expenses,
            collaborators: collabs,
            milestones,
            expenseDetails: projExpenseDetails,
          };
        });

        return <WeeklyAnalysisCard projectData={analysisData} />;
      })()}

      {/* ═══ RAPPORT LIVRABLES EN RETARD ═══ */}
      <Card className={`shadow-card ${overdueItems.length > 0 ? "border-2 border-destructive/30" : ""}`}>
        <CardHeader className={`pb-2 ${overdueItems.length > 0 ? "bg-destructive/5" : ""}`}>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${overdueItems.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <span className={overdueItems.length > 0 ? "text-destructive" : ""}>
              Livrables en retard {overdueItems.length > 0 ? `(${overdueItems.length})` : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overdueItems.length === 0 ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              <span className="text-sm text-muted-foreground">Aucun livrable en retard — tout est à jour !</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Projet</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Chef de projet</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Collaborateur</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Mission</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Jalon</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Deadline</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Retard</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Livrable</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-border last:border-b-0 hover:bg-destructive/5">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.projectColor }} />
                          <span className="text-xs font-medium">{item.projectName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{item.projectLead || "—"}</td>
                      <td className="px-3 py-2 text-xs">{item.collaborator}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{item.mission}</td>
                      <td className="px-3 py-2 text-xs font-medium">{item.milestone}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-semibold text-destructive">{formatDeadline(item.deadline)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                          {item.daysOverdue}j
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {item.hasDeliverables ? (
                          <span className="text-xs text-accent flex items-center gap-1"><Link2 className="w-3 h-3" />Déposé</span>
                        ) : (
                          <span className="text-xs text-destructive flex items-center gap-1 font-semibold"><XCircle className="w-3 h-3" />Non déposé</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardView;
