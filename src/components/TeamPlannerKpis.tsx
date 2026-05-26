import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/useProfiles";
import { useProjects } from "@/contexts/ProjectsContext";
import { useCommittees } from "@/contexts/CommitteesContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, Package, FolderKanban, CheckCircle2, ListTodo, TrendingUp, Eye, X, Users, UserCheck, AlertTriangle } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays } from "date-fns";
import { fr } from "date-fns/locale";

type KpiFilter = "week" | "month" | "year";
type TeamDetailView = "members" | "deliverables" | "tasks" | "completion" | "late" | null;

interface TeamTodo {
  id: string;
  title: string;
  has_deliverable: boolean;
  deliverable_project_id: string | null;
  deliverable_name: string | null;
  completed: boolean;
  day_of_week: number;
  week_start: string;
  user_id: string;
}

const FILTER_LABELS: Record<KpiFilter, string> = {
  week: "Cette semaine",
  month: "Ce mois",
  year: "Cette année",
};

const TeamPlannerKpis = () => {
  const { user, profile } = useAuth();
  const profiles = useProfiles();
  const { projects } = useProjects();
  const { committees } = useCommittees();
  const [filter, setFilter] = useState<KpiFilter>("week");
  const [teamTodos, setTeamTodos] = useState<TeamTodo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailView, setDetailView] = useState<TeamDetailView>(null);

  // Get direct subordinates
  const subordinates = useMemo(() => {
    if (!user) return [];
    return profiles.filter(p => p.hierarchy_user_id === user.id);
  }, [profiles, user]);

  const subordinateIds = useMemo(() => subordinates.map(s => s.user_id), [subordinates]);

  const isManager = profile?.is_manager === true;

  const getDateRange = useCallback((f: KpiFilter): { from: string; to: string } => {
    const now = new Date();
    switch (f) {
      case "week": {
        const mon = startOfWeek(now, { weekStartsOn: 1 });
        return { from: format(mon, "yyyy-MM-dd"), to: format(addDays(mon, 6), "yyyy-MM-dd") };
      }
      case "month":
        return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
      case "year":
        return { from: format(startOfYear(now), "yyyy-MM-dd"), to: format(endOfYear(now), "yyyy-MM-dd") };
    }
  }, []);

  const fetchTeamData = useCallback(async () => {
    if (!user || subordinateIds.length === 0) return;
    setLoading(true);
    const { from, to } = getDateRange(filter);
    const { data } = await supabase
      .from("weekly_todos")
      .select("id, title, has_deliverable, deliverable_project_id, deliverable_name, completed, day_of_week, week_start, user_id")
      .in("user_id", subordinateIds)
      .gte("week_start", from)
      .lte("week_start", to);
    setTeamTodos((data || []) as TeamTodo[]);
    setLoading(false);
  }, [user, subordinateIds, filter, getDateRange]);

  useEffect(() => { fetchTeamData(); }, [fetchTeamData]);
  useEffect(() => { setDetailView(null); }, [filter]);

  const getActivityName = useCallback((projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (proj) return proj.name;
    const com = committees.find(c => c.id === projectId);
    if (com) return com.name;
    return projectId;
  }, [projects, committees]);

  const periodLabel = useMemo(() => {
    const now = new Date();
    switch (filter) {
      case "week": {
        const mon = startOfWeek(now, { weekStartsOn: 1 });
        return `${format(mon, "dd MMM", { locale: fr })} — ${format(addDays(mon, 4), "dd MMM", { locale: fr })}`;
      }
      case "month": return format(now, "MMMM yyyy", { locale: fr });
      case "year": return format(now, "yyyy");
    }
  }, [filter]);

  if (!isManager || subordinates.length === 0) return null;

  const totalTasks = teamTodos.length;
  const completedTasks = teamTodos.filter(t => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const deliverableTodos = teamTodos.filter(t => t.has_deliverable);
  const deliverablesCount = deliverableTodos.length;
  const pendingTasks = teamTodos.filter(t => !t.completed);

  // Members with tasks
  const memberStats = subordinates.map(sub => {
    const todos = teamTodos.filter(t => t.user_id === sub.user_id);
    const completed = todos.filter(t => t.completed).length;
    const total = todos.length;
    const deliverables = todos.filter(t => t.has_deliverable).length;
    return { ...sub, total, completed, deliverables, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  });

  // Late = tasks not completed where the week_start is in the past
  const now = new Date();
  const currentWeekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const lateTasks = teamTodos.filter(t => !t.completed && t.week_start < currentWeekStart);

  const getSubName = (userId: string) => {
    const p = subordinates.find(s => s.user_id === userId);
    return p?.full_name || "—";
  };

  const toggleDetail = (view: TeamDetailView) => {
    setDetailView(prev => prev === view ? null : view);
  };

  const renderDetailList = () => {
    if (!detailView) return null;

    let title = "";
    let items: { label: string; sub?: string; done?: boolean }[] = [];

    switch (detailView) {
      case "members":
        title = "Suivi par collaborateur";
        items = memberStats.map(m => ({
          label: m.full_name,
          sub: `${m.completed}/${m.total} tâches (${m.rate}%) — ${m.deliverables} livrable(s)`,
        }));
        break;
      case "deliverables":
        title = "Livrables de l'équipe";
        items = deliverableTodos.map(t => ({
          label: t.deliverable_name || t.title,
          sub: `${getSubName(t.user_id)}${t.deliverable_project_id ? ` • ${getActivityName(t.deliverable_project_id)}` : ""}`,
          done: t.completed,
        }));
        break;
      case "tasks":
        title = "Toutes les tâches de l'équipe";
        items = teamTodos.map(t => ({
          label: t.title,
          sub: `${getSubName(t.user_id)}${t.has_deliverable ? ` • 📦 ${t.deliverable_name || "Livrable"}` : ""}`,
          done: t.completed,
        }));
        break;
      case "completion":
        title = "Complétion par collaborateur";
        items = memberStats
          .sort((a, b) => a.rate - b.rate)
          .map(m => ({
            label: m.full_name,
            sub: `${m.rate}% — ${m.completed}/${m.total}`,
            done: m.rate >= 100,
          }));
        break;
      case "late":
        title = "Tâches en retard";
        items = lateTasks.map(t => ({
          label: t.title,
          sub: `${getSubName(t.user_id)} • Semaine du ${format(new Date(t.week_start + "T00:00:00"), "dd/MM", { locale: fr })}`,
          done: false,
        }));
        break;
    }

    return (
      <div className="mt-2 rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/30">
          <span className="text-[10px] font-semibold text-foreground">{title}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setDetailView(null)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
        <ScrollArea className="max-h-48">
          <div className="p-2 space-y-1">
            {items.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-2">Aucun élément</p>
            ) : (
              items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] py-0.5">
                  {item.done !== undefined && (
                    <span className={item.done ? "text-primary" : "text-muted-foreground"}>
                      {item.done ? "✅" : "⬜"}
                    </span>
                  )}
                  <span className={`flex-1 ${item.done === false ? "text-muted-foreground" : "text-foreground"}`}>
                    {item.label}
                  </span>
                  {item.sub && (
                    <span className="text-[9px] text-muted-foreground shrink-0">{item.sub}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const DetailBtn = ({ view }: { view: TeamDetailView }) => (
    <button
      onClick={() => toggleDetail(view)}
      className={`absolute bottom-1 right-1 p-0.5 rounded transition-colors ${
        detailView === view ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
      }`}
    >
      <Eye className="w-3 h-3" />
    </button>
  );

  return (
    <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {filter === "year" ? "PERFORMANCE ÉQUIPE — ANNÉE" : filter === "month" ? "PERFORMANCE ÉQUIPE — MOIS" : "PERFORMANCE ÉQUIPE — SEMAINE"}
          </span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal capitalize">
            {periodLabel}
          </Badge>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-normal">
            {subordinates.length} collaborateur{subordinates.length > 1 ? "s" : ""}
          </Badge>
        </div>
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Filter className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="end">
            <div className="space-y-0.5">
              {(Object.keys(FILTER_LABELS) as KpiFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setFilterOpen(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                    filter === f
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <div className="relative flex flex-col items-center p-2 rounded-xl bg-primary/5 border border-primary/10">
          <UserCheck className="w-3.5 h-3.5 text-primary/60 mb-0.5" />
          <span className="text-lg font-bold text-primary">{subordinates.length}</span>
          <span className="text-[8px] text-muted-foreground text-center leading-tight">Collaborateurs</span>
          <DetailBtn view="members" />
        </div>
        <div className="relative flex flex-col items-center p-2 rounded-xl bg-accent/10 border border-accent/10">
          <Package className="w-3.5 h-3.5 text-accent-foreground/60 mb-0.5" />
          <span className="text-lg font-bold text-accent-foreground">{deliverablesCount}</span>
          <span className="text-[8px] text-muted-foreground text-center leading-tight">Livrables</span>
          <DetailBtn view="deliverables" />
        </div>
        <div className="relative flex flex-col items-center p-2 rounded-xl bg-secondary/50 border border-secondary">
          <ListTodo className="w-3.5 h-3.5 text-secondary-foreground/60 mb-0.5" />
          <span className="text-lg font-bold text-secondary-foreground">{totalTasks}</span>
          <span className="text-[8px] text-muted-foreground text-center leading-tight">Tâches totales</span>
          <DetailBtn view="tasks" />
        </div>
        <div className="relative flex flex-col items-center p-2 rounded-xl bg-muted border border-border/50">
          <TrendingUp className="w-3.5 h-3.5 text-foreground/60 mb-0.5" />
          <span className="text-lg font-bold text-foreground">{completionRate}%</span>
          <span className="text-[8px] text-muted-foreground text-center leading-tight">Complétion</span>
          <DetailBtn view="completion" />
        </div>
        <div className="relative flex flex-col items-center p-2 rounded-xl bg-destructive/5 border border-destructive/10">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive/60 mb-0.5" />
          <span className="text-lg font-bold text-destructive">{lateTasks.length}</span>
          <span className="text-[8px] text-muted-foreground text-center leading-tight">En retard</span>
          <DetailBtn view="late" />
        </div>
      </div>

      {renderDetailList()}

      {loading && (
        <div className="flex justify-center py-1">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default TeamPlannerKpis;
