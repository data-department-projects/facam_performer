import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/useProfiles";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useCommittees } from "@/contexts/CommitteesContext";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2, Users, FolderKanban, Layers, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp, Link2, XCircle,
  Briefcase, Target, Star
} from "lucide-react";
import { parseISO, format } from "date-fns";
import { fr } from "date-fns/locale";
import DataToolbar from "@/components/DataToolbar";

const PersonalDashboard = () => {
  const { profile } = useAuth();
  const profiles = useProfiles();
  const { departments } = useDepartments();
  const { projects } = useProjects();
  const { committees } = useCommittees();
  const { entries: timeEntries } = useTimeTracking();
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null);

  const isManager = profile?.is_manager ?? false;
  const userName = profile?.full_name ?? "";
  const userDeptId = profile?.department_id ?? null;
  const userId = profile?.user_id ?? "";

  // Department name
  const departmentName = useMemo(() => {
    if (!userDeptId) return "Non rattaché";
    const dept = departments.find(d => d.id === userDeptId);
    return dept ? `${dept.icon} ${dept.name}` : "Non rattaché";
  }, [userDeptId, departments]);

  // Subordinates (for managers)
  const subordinates = useMemo(() => {
    if (!isManager) return [];
    return profiles.filter(p => p.hierarchy_user_id === userId);
  }, [isManager, profiles, userId]);

  const teamNames = useMemo(() => {
    const names = new Set<string>();
    names.add(userName);
    if (isManager) {
      subordinates.forEach(s => names.add(s.full_name));
    }
    return names;
  }, [userName, isManager, subordinates]);

  // Only user's own name set
  const selfNames = useMemo(() => new Set([userName]), [userName]);

  const relevantNames = isManager ? teamNames : selfNames;

  // Projects where user (or team) is a collaborator or project lead
  const myProjects = useMemo(() => {
    return projects.filter(p => {
      const isCollab = (p.collaborators || []).some(c => relevantNames.has(c.name));
      const isLead = Array.isArray(p.projectLead)
        ? p.projectLead.some(l => relevantNames.has(l))
        : relevantNames.has(p.projectLead);
      return isCollab || isLead;
    });
  }, [projects, relevantNames]);

  // Committees where user (or team) is member
  const myCommittees = useMemo(() => {
    return committees.filter(c =>
      (c.members || []).some(m => relevantNames.has(m.name)) ||
      relevantNames.has(c.responsible)
    );
  }, [committees, relevantNames]);

  // Milestones for relevant collaborators
  const milestoneStats = useMemo(() => {
    let done = 0, inProgress = 0, planned = 0, overdue = 0, total = 0;
    const now = new Date();
    myProjects.forEach(p => {
      (p.collaborators || []).filter(c => relevantNames.has(c.name)).forEach(c => {
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
  }, [myProjects, relevantNames]);

  const progressPct = milestoneStats.total > 0 ? Math.round((milestoneStats.done / milestoneStats.total) * 100) : 0;

  // Active missions
  const activeMissions = useMemo(() => {
    const missions: { projectName: string; projectColor: string; collaborator: string; missionTitle: string; milestonesTotal: number; milestonesDone: number }[] = [];
    myProjects.forEach(p => {
      (p.collaborators || []).filter(c => relevantNames.has(c.name)).forEach(c => {
        (c.missions || []).forEach(m => {
          const total = (m.milestones || []).length;
          const done = (m.milestones || []).filter(ms => ms.status === "done").length;
          if (done < total || total === 0) {
            missions.push({
              projectName: p.name, projectColor: p.color,
              collaborator: c.name, missionTitle: m.title || "Mission sans titre",
              milestonesTotal: total, milestonesDone: done,
            });
          }
        });
      });
    });
    return missions;
  }, [myProjects, relevantNames]);

  // Time entries for relevant users
  const myTimeEntries = useMemo(() => {
    return timeEntries.filter(e => relevantNames.has(e.collaboratorName));
  }, [timeEntries, relevantNames]);

  const totalHours = useMemo(() => {
    return myTimeEntries.reduce((s, e) => s + (e.hoursWorked || 0), 0);
  }, [myTimeEntries]);

  // Overdue items
  const overdueItems = useMemo(() => {
    const now = new Date();
    const items: {
      projectName: string; projectColor: string; collaborator: string;
      mission: string; milestone: string; deadline: string;
      daysOverdue: number; hasDeliverables: boolean;
    }[] = [];
    myProjects.forEach(proj => {
      (proj.collaborators || []).filter(c => relevantNames.has(c.name)).forEach(c => {
        (c.missions || []).forEach(m => {
          (m.milestones || []).forEach(ms => {
            if (!ms.deadline || ms.status === "done") return;
            const dl = parseISO(ms.deadline);
            if (dl >= now) return;
            items.push({
              projectName: proj.name, projectColor: proj.color,
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
  }, [myProjects, relevantNames]);

  // Milestone detail list
  const milestoneDetails = useMemo(() => {
    const items: { projectName: string; projectColor: string; collaborator: string; mission: string; title: string; status: string; deadline?: string }[] = [];
    myProjects.forEach(p => {
      (p.collaborators || []).filter(c => relevantNames.has(c.name)).forEach(c => {
        (c.missions || []).forEach(m => {
          (m.milestones || []).forEach(ms => {
            items.push({
              projectName: p.name, projectColor: p.color,
              collaborator: c.name, mission: m.title || "Mission sans titre",
              title: ms.title, status: ms.status, deadline: ms.deadline,
            });
          });
        });
      });
    });
    return items;
  }, [myProjects, relevantNames]);

  const formatDeadline = (d: string) => {
    try { return format(parseISO(d), "dd MMM yyyy", { locale: fr }); } catch { return d; }
  };

  const toggleExpand = (key: string) => setExpandedKpi(prev => prev === key ? null : key);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  })();

  const firstName = profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "";

  const ExpandButton = ({ kpiKey, label }: { kpiKey: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-[10px] gap-1 mt-1"
      onClick={() => toggleExpand(kpiKey)}
    >
      {expandedKpi === kpiKey ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      {expandedKpi === kpiKey ? "Réduire" : label}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <DataToolbar moduleType="dashboard" />
      </div>

      {/* ═══ WELCOME BANNER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="shadow-card overflow-hidden relative bg-secondary border-0">
          {/* Decorative SVG background */}
          <svg
            className="absolute right-0 top-0 h-full w-40 opacity-[0.07] pointer-events-none"
            viewBox="0 0 160 120"
            fill="none"
            preserveAspectRatio="xMaxYMid slice"
          >
            <circle cx="140" cy="100" r="80" fill="white" />
            <circle cx="115" cy="75" r="56" fill="white" />
            <circle cx="145" cy="45" r="38" fill="white" />
            <circle cx="120" cy="95" r="22" fill="#ffae03" />
          </svg>

          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Greeting */}
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary mb-0.5">
                  {greeting}
                </p>
                <h2 className="font-display text-xl font-bold text-white leading-tight truncate">
                  {firstName || userName}
                </h2>

                {/* Badges */}
                <div className="flex items-center flex-wrap gap-2 mt-2.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-semibold text-white/80">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[160px]">{departmentName}</span>
                  </span>
                  {isManager ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/25 text-[10px] font-bold text-primary">
                      <Star className="w-3 h-3 shrink-0" />
                      Manager
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-semibold text-white/70">
                      <Users className="w-3 h-3 shrink-0" />
                      Collaborateur
                    </span>
                  )}
                </div>
              </div>

              {/* Right: KPI summary pill */}
              <div className="shrink-0 hidden sm:flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span className="text-white font-display font-bold text-lg leading-none">{progressPct}%</span>
                </div>
                <p className="text-[9px] text-white/50 uppercase tracking-wider font-semibold">Avancement</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ KPI CARDS ═══ */}
      <div className={`grid grid-cols-2 ${isManager ? "md:grid-cols-3 lg:grid-cols-5" : "md:grid-cols-2 lg:grid-cols-4"} gap-3`}>
        {/* Subordinates (manager only) */}
        {isManager && (
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-display font-bold">{subordinates.length}</p>
                  <p className="text-[11px] text-muted-foreground">Collaborateurs rattachés</p>
                </div>
              </div>
              <ExpandButton kpiKey="subordinates" label="Voir détail" />
            </CardContent>
          </Card>
        )}

        {/* Projects */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
                <FolderKanban className="w-4 h-4 text-secondary" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-display font-bold">{myProjects.length}</p>
                <p className="text-[11px] text-muted-foreground">Projet(s)</p>
              </div>
            </div>
            <ExpandButton kpiKey="projects" label="Voir détail" />
          </CardContent>
        </Card>

        {/* Committees */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-display font-bold">{myCommittees.length}</p>
                <p className="text-[11px] text-muted-foreground">Comité(s)</p>
              </div>
            </div>
            <ExpandButton kpiKey="committees" label="Voir détail" />
          </CardContent>
        </Card>

        {/* Progress */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-display font-bold">{progressPct}%</p>
                <p className="text-[11px] text-muted-foreground">Avancement</p>
              </div>
            </div>
            <ExpandButton kpiKey="progress" label="Voir détail" />
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-display font-bold text-destructive">{milestoneStats.overdue}</p>
                <p className="text-[11px] text-muted-foreground">En retard</p>
              </div>
            </div>
            <ExpandButton kpiKey="overdue" label="Voir détail" />
          </CardContent>
        </Card>
      </div>

      {/* ═══ SUMMARY METRICS ═══ */}
      <div className={`grid grid-cols-2 ${isManager ? "md:grid-cols-4" : "md:grid-cols-3"} gap-3`}>
        {/* Active missions */}
        <Card className="shadow-card border-l-4 border-l-primary">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Missions actives</p>
            <p className="text-xl font-display font-bold mt-1">{activeMissions.length}</p>
            {isManager && (
              <p className="text-[10px] text-muted-foreground">
                {subordinates.length} collaborateur(s) / {profiles.length} total
              </p>
            )}
            <ExpandButton kpiKey="missions" label="Voir détail" />
          </CardContent>
        </Card>

        {/* Milestones */}
        <Card className="shadow-card border-l-4 border-l-accent">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Jalons</p>
            <p className="text-xl font-display font-bold mt-1">{milestoneStats.done} / {milestoneStats.total}</p>
            <p className="text-[10px] text-muted-foreground">terminés</p>
            <ExpandButton kpiKey="milestones" label="Voir détail" />
          </CardContent>
        </Card>

        {/* Time entries (manager only) */}
        {isManager && (
          <Card className="shadow-card border-l-4 border-l-secondary">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Heures saisies (équipe)</p>
              <p className="text-xl font-display font-bold mt-1">{totalHours.toFixed(1)}h</p>
              <p className="text-[10px] text-muted-foreground">{myTimeEntries.length} entrée(s)</p>
            </CardContent>
          </Card>
        )}

        {/* Progress bar */}
        <Card className="shadow-card border-l-4 border-l-muted-foreground">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Avancement global</p>
            <div className="mt-2 space-y-1">
              <Progress value={progressPct} className="h-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{milestoneStats.done} terminé(s)</span>
                <span>{milestoneStats.inProgress} en cours</span>
                <span>{milestoneStats.planned} planifié(s)</span>
              </div>
            </div>
            <ExpandButton kpiKey="progress" label="Voir détail" />
          </CardContent>
        </Card>
      </div>

      {/* ═══ EXPANDED: Subordinates ═══ */}
      {expandedKpi === "subordinates" && isManager && (
        <Card className="shadow-card animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" />
              Collaborateurs rattachés ({subordinates.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subordinates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun collaborateur rattaché</p>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {subordinates.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/30">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {s.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{s.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.email}</p>
                      </div>
                      {s.poste && <Badge variant="outline" className="text-[9px] shrink-0">{s.poste}</Badge>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ EXPANDED: Projects ═══ */}
      {expandedKpi === "projects" && (
        <Card className="shadow-card animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-secondary-foreground" />
              Projets ({myProjects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun projet</p>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {myProjects.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/30">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{(p.collaborators || []).length} collaborateur(s)</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0">{p.status || "actif"}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ EXPANDED: Committees ═══ */}
      {expandedKpi === "committees" && (
        <Card className="shadow-card animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Comités ({myCommittees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myCommittees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun comité</p>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {myCommittees.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/30">
                      <div className="w-3 h-3 rounded-full shrink-0 bg-primary/30" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.responsible || "—"}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0">{(c.members || []).length} membre(s)</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ EXPANDED: Overdue ═══ */}
      {expandedKpi === "overdue" && (
        <Card className="shadow-card animate-in fade-in-0 slide-in-from-top-2 duration-200 border-2 border-destructive/30">
          <CardHeader className="pb-2 bg-destructive/5">
            <CardTitle className="text-sm font-display flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Éléments en retard ({overdueItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueItems.length === 0 ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <span className="text-sm text-muted-foreground">Aucun élément en retard</span>
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {overdueItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.projectColor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.milestone}</p>
                        <p className="text-[10px] text-muted-foreground">{item.projectName} — {item.mission}</p>
                      </div>
                      <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full shrink-0">
                        {item.daysOverdue}j
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ EXPANDED KPI DETAILS ═══ */}
      {expandedKpi === "missions" && (
        <Card className="shadow-card animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Missions actives ({activeMissions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeMissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune mission active</p>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {activeMissions.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/30">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.projectColor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{m.missionTitle}</p>
                        <p className="text-[10px] text-muted-foreground">{m.projectName} — {m.collaborator}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {m.milestonesDone}/{m.milestonesTotal}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {expandedKpi === "milestones" && (
        <Card className="shadow-card animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-accent" />
              Détail des jalons ({milestoneDetails.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {milestoneDetails.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun jalon</p>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">Projet</th>
                        {isManager && <th className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">Collaborateur</th>}
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">Mission</th>
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">Jalon</th>
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">Statut</th>
                        <th className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">Deadline</th>
                      </tr>
                    </thead>
                    <tbody>
                      {milestoneDetails.map((ms, i) => (
                        <tr key={i} className="border-b border-border/30 last:border-0">
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ms.projectColor }} />
                              <span className="text-xs truncate max-w-[120px]">{ms.projectName}</span>
                            </div>
                          </td>
                          {isManager && <td className="px-2 py-1.5 text-xs">{ms.collaborator}</td>}
                          <td className="px-2 py-1.5 text-xs text-muted-foreground">{ms.mission}</td>
                          <td className="px-2 py-1.5 text-xs font-medium">{ms.title}</td>
                          <td className="px-2 py-1.5">
                            <Badge
                              variant={ms.status === "done" ? "default" : "outline"}
                              className={`text-[9px] ${ms.status === "done" ? "bg-accent text-accent-foreground" : ms.status === "in-progress" ? "border-secondary text-secondary-foreground" : ""}`}
                            >
                              {ms.status === "done" ? "Terminé" : ms.status === "in-progress" ? "En cours" : "Planifié"}
                            </Badge>
                          </td>
                          <td className="px-2 py-1.5 text-xs text-muted-foreground">
                            {ms.deadline ? formatDeadline(ms.deadline) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {expandedKpi === "progress" && (
        <Card className="shadow-card animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Avancement par projet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {myProjects.map(p => {
              let total = 0, done = 0;
              (p.collaborators || []).filter(c => relevantNames.has(c.name)).forEach(c => {
                (c.missions || []).forEach(m => {
                  (m.milestones || []).forEach(ms => {
                    total++;
                    if (ms.status === "done") done++;
                  });
                });
              });
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div key={p.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-medium">{p.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{done}/{total} — {pct}%</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
            {myProjects.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun projet</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ LIVRABLES EN RETARD ═══ */}
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
                    {isManager && <th className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Collaborateur</th>}
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
                      {isManager && <td className="px-3 py-2 text-xs">{item.collaborator}</td>}
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

export default PersonalDashboard;
