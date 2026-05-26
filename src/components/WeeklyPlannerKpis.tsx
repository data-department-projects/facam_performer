import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useCommittees } from "@/contexts/CommitteesContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, Package, FolderKanban, CheckCircle2, ListTodo, TrendingUp, Eye, X } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays } from "date-fns";
import { fr } from "date-fns/locale";

const TeamPlannerKpis = lazy(() => import("@/components/TeamPlannerKpis"));

type KpiFilter = "week" | "month" | "year";
type DetailView = "deliverables" | "projects" | "tasks" | "completion" | null;

interface KpiTodo {
  id: string;
  title: string;
  has_deliverable: boolean;
  deliverable_project_id: string | null;
  deliverable_name: string | null;
  completed: boolean;
  day_of_week: number;
  week_start: string;
}

const FILTER_LABELS: Record<KpiFilter, string> = {
  week: "Cette semaine",
  month: "Ce mois",
  year: "Cette année",
};

const WeeklyPlannerKpis = () => {
  const { user } = useAuth();
  const { projects } = useProjects();
  const { committees } = useCommittees();
  const [filter, setFilter] = useState<KpiFilter>("week");
  const [kpiTodos, setKpiTodos] = useState<KpiTodo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailView, setDetailView] = useState<DetailView>(null);

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

  const fetchKpiData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { from, to } = getDateRange(filter);
    const { data } = await supabase
      .from("weekly_todos")
      .select("id, title, has_deliverable, deliverable_project_id, deliverable_name, completed, day_of_week, week_start")
      .eq("user_id", user.id)
      .gte("week_start", from)
      .lte("week_start", to);
    setKpiTodos((data || []) as KpiTodo[]);
    setLoading(false);
  }, [user, filter, getDateRange]);

  useEffect(() => { fetchKpiData(); }, [fetchKpiData]);
  useEffect(() => { setDetailView(null); }, [filter]);

  const totalTasks = kpiTodos.length;
  const completedTasks = kpiTodos.filter(t => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const deliverableTodos = kpiTodos.filter(t => t.has_deliverable);
  const deliverablesCount = deliverableTodos.length;
  const projectIds = new Set(kpiTodos.filter(t => t.deliverable_project_id).map(t => t.deliverable_project_id));
  const involvedProjectsCount = projectIds.size;

  const getActivityName = (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (proj) return proj.name;
    const com = committees.find(c => c.id === projectId);
    if (com) return com.name;
    return projectId;
  };

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

  const toggleDetail = (view: DetailView) => {
    setDetailView(prev => prev === view ? null : view);
  };

  const renderDetailList = () => {
    if (!detailView) return null;

    let title = "";
    let items: { label: string; sub?: string; done?: boolean }[] = [];

    switch (detailView) {
      case "deliverables":
        title = "Livrables";
        items = deliverableTodos.map(t => ({
          label: t.deliverable_name || t.title,
          sub: t.deliverable_project_id ? getActivityName(t.deliverable_project_id) : undefined,
          done: t.completed,
        }));
        break;
      case "projects":
        title = "Projets / Comités";
        items = Array.from(projectIds).map(pid => {
          const count = kpiTodos.filter(t => t.deliverable_project_id === pid).length;
          return { label: getActivityName(pid!), sub: `${count} tâche(s)` };
        });
        break;
      case "tasks":
        title = "Toutes les tâches";
        items = kpiTodos.map(t => ({
          label: t.title,
          sub: t.has_deliverable ? `📦 ${t.deliverable_name || "Livrable"}` : undefined,
          done: t.completed,
        }));
        break;
      case "completion": {
        title = "Tâches complétées";
        const completed = kpiTodos.filter(t => t.completed);
        const pending = kpiTodos.filter(t => !t.completed);
        items = [
          ...completed.map(t => ({ label: t.title, done: true })),
          ...pending.map(t => ({ label: t.title, done: false })),
        ];
        break;
      }
    }

    return (
      <div className="mt-2 rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/30">
          <span className="text-[10px] font-semibold text-foreground">{title}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setDetailView(null)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
        <ScrollArea className="max-h-40">
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

  const DetailBtn = ({ view }: { view: DetailView }) => (
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
    <>
    <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {filter === "year" ? "MA PERFORMANCE CETTE ANNÉE" : filter === "month" ? "MA PERFORMANCE CE MOIS" : "MA PERFORMANCE CETTE SEMAINE"}
          </span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal capitalize">
            {periodLabel}
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

      <div className="grid grid-cols-4 gap-2">
        <div className="relative flex flex-col items-center p-2 rounded-xl bg-primary/5 border border-primary/10">
          <Package className="w-3.5 h-3.5 text-primary/60 mb-0.5" />
          <span className="text-lg font-bold text-primary">{deliverablesCount}</span>
          <span className="text-[8px] text-muted-foreground text-center leading-tight">Livrable(s)</span>
          <DetailBtn view="deliverables" />
        </div>
        <div className="relative flex flex-col items-center p-2 rounded-xl bg-accent/10 border border-accent/10">
          <FolderKanban className="w-3.5 h-3.5 text-accent-foreground/60 mb-0.5" />
          <span className="text-lg font-bold text-accent-foreground">{involvedProjectsCount}</span>
          <span className="text-[8px] text-muted-foreground text-center leading-tight">Projet(s) / Comité(s)</span>
          <DetailBtn view="projects" />
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
      </div>

      {renderDetailList()}

      {loading && (
        <div className="flex justify-center py-1">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
    <Suspense fallback={null}><TeamPlannerKpis /></Suspense>
    </>
  );
};

export default WeeklyPlannerKpis;
