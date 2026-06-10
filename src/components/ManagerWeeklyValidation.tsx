import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useProfiles } from "@/hooks/useProfiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, CheckCircle2, XCircle, ChevronDown, ChevronRight, Clock, Users, History, RotateCcw, AlertTriangle, Plus, Trash2, Pencil, Save } from "lucide-react";
import { format, startOfWeek, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

const DAY_LABELS_5 = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const DAY_LABELS_7 = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface SubordinatePlanner {
  user_id: string;
  full_name: string;
  week_start: string;
  status: string;
  submitted_at: string | null;
  validated_at: string | null;
  manager_comment: string;
  planner_id: string;
  todos: {
    id: string;
    day_of_week: number;
    title: string;
    completed: boolean;
    has_deliverable: boolean;
    deliverable_name: string;
    deliverable_project_id: string | null;
    deliverable_linked_to_project: boolean;
  }[];
}

interface AuditEntry {
  id: string;
  action: string;
  actor_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

const rpcAudit = supabase.rpc as unknown as (fn: string, params: Record<string, unknown>) => Promise<{ error: Error | null }>;

const ManagerWeeklyValidation = ({ scrollToSelf, onScrolled }: { scrollToSelf?: boolean; onScrolled?: () => void } = {}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { user, profile, isAdmin } = useAuth();
  const { departments } = useDepartments();
  const allProfiles = useProfiles();
  const { toast } = useToast();
  const [planners, setPlanners] = useState<SubordinatePlanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, AuditEntry[]>>({});
  const [showAudit, setShowAudit] = useState<string | null>(null);
  const [editingPlanner, setEditingPlanner] = useState<string | null>(null);
  const [editTodos, setEditTodos] = useState<Record<string, { id?: string; day_of_week: number; title: string; toDelete?: boolean }[]>>({});
  const [newTaskDay, setNewTaskDay] = useState<Record<string, number>>({});
  const [newTaskTitle, setNewTaskTitle] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState(false);

  const canManage = isAdmin || !!profile?.is_manager;

  // Auto-scroll when navigated from Actions
  useEffect(() => {
    if (scrollToSelf && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        onScrolled?.();
      }, 300);
    }
  }, [scrollToSelf, onScrolled]);

  const fetchPlanners = useCallback(async () => {
    if (!user || !canManage) return;
    setLoading(true);

    // Get subordinates
    const { data: subordinates } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("hierarchy_user_id", user.id);

    if (!subordinates || subordinates.length === 0) {
      setPlanners([]);
      setLoading(false);
      return;
    }

    const subIds = subordinates.map(s => s.user_id);

    // Get submitted planners
    const { data: statuses } = await supabase
      .from("weekly_planner_status")
      .select("*")
      .in("user_id", subIds)
      .in("status", ["submitted", "validated", "rejected"])
      .order("week_start", { ascending: false });

    if (!statuses || statuses.length === 0) {
      setPlanners([]);
      setLoading(false);
      return;
    }

    // Get todos for these users/weeks
    const result: SubordinatePlanner[] = [];
    for (const st of statuses) {
      const sub = subordinates.find(s => s.user_id === st.user_id);
      const { data: todos } = await supabase
        .from("weekly_todos")
        .select("id, day_of_week, title, completed, has_deliverable, deliverable_name, deliverable_project_id, deliverable_linked_to_project")
        .eq("user_id", st.user_id)
        .eq("week_start", st.week_start)
        .order("day_of_week")
        .order("sort_order");

      result.push({
        user_id: st.user_id,
        full_name: sub?.full_name || "",
        week_start: st.week_start,
        status: st.status,
        submitted_at: st.submitted_at,
        validated_at: st.validated_at,
        manager_comment: st.manager_comment || "",
        planner_id: st.id,
        todos: (todos || []) as SubordinatePlanner["todos"],
      });
    }

    setPlanners(result);
    setLoading(false);
  }, [user, canManage]);

  useEffect(() => { fetchPlanners(); }, [fetchPlanners]);

  const handleValidate = async (planner: SubordinatePlanner) => {
    if (!user) return;
    const { error } = await supabase
      .from("weekly_planner_status")
      .update({
        status: "validated",
        validated_at: new Date().toISOString(),
        validated_by: user.id,
        manager_comment: comments[planner.planner_id] || "",
      })
      .eq("id", planner.planner_id);

    if (!error) {
      await rpcAudit("insert_weekly_planner_audit", {
        _action: "validated", _actor_id: user.id, _user_id: planner.user_id,
        _week_start: planner.week_start, _details: { comment: comments[planner.planner_id] || "" },
      });
      toast({ title: "✅ Planning validé", description: `Le planning de ${planner.full_name} a été validé avec succès.` });
      fetchPlanners();
    }
  };

  const handleReject = async (planner: SubordinatePlanner) => {
    if (!user) return;
    const comment = comments[planner.planner_id]?.trim();
    if (!comment) {
      toast({ title: "Commentaire requis", description: "Veuillez ajouter un commentaire pour expliquer le rejet.", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("weekly_planner_status")
      .update({
        status: "rejected",
        validated_by: user.id,
        manager_comment: comment,
      })
      .eq("id", planner.planner_id);

    if (!error) {
      await rpcAudit("insert_weekly_planner_audit", {
        _action: "rejected", _actor_id: user.id, _user_id: planner.user_id,
        _week_start: planner.week_start, _details: { comment },
      });
      toast({ title: "❌ Planning rejeté", description: `Le planning de ${planner.full_name} a été rejeté.` });
      fetchPlanners();
    }
  };

  const handleSendBack = async (planner: SubordinatePlanner) => {
    if (!user) return;
    const comment = comments[planner.planner_id]?.trim();
    if (!comment) {
      toast({ title: "Commentaire requis", description: "Veuillez indiquer les modifications à apporter.", variant: "destructive" });
      return;
    }
    // Reset to draft so the collaborator can modify and resubmit
    const { error } = await supabase
      .from("weekly_planner_status")
      .update({
        status: "draft",
        validated_by: null,
        validated_at: null,
        manager_comment: comment,
        submitted_at: null,
      })
      .eq("id", planner.planner_id);

    if (!error) {
      await rpcAudit("insert_weekly_planner_audit", {
        _action: "sent_back", _actor_id: user.id, _user_id: planner.user_id,
        _week_start: planner.week_start, _details: { comment },
      });
      toast({ title: "🔄 Renvoyé pour modification", description: `Le planning de ${planner.full_name} a été renvoyé pour correction.` });
      fetchPlanners();
    }
  };

  // Start editing mode: copy current todos into editable state
  const startEditing = (planner: SubordinatePlanner) => {
    setEditingPlanner(planner.planner_id);
    setEditTodos(prev => ({
      ...prev,
      [planner.planner_id]: planner.todos.map(t => ({ id: t.id, day_of_week: t.day_of_week, title: t.title, toDelete: false })),
    }));
  };

  const cancelEditing = (plannerId: string) => {
    setEditingPlanner(null);
    setEditTodos(prev => { const n = { ...prev }; delete n[plannerId]; return n; });
    setNewTaskDay(prev => { const n = { ...prev }; delete n[plannerId]; return n; });
    setNewTaskTitle(prev => { const n = { ...prev }; delete n[plannerId]; return n; });
  };

  const addEditTask = (plannerId: string) => {
    const day = newTaskDay[plannerId] ?? 1;
    const title = newTaskTitle[plannerId]?.trim();
    if (!title) { toast({ title: "Titre requis", variant: "destructive" }); return; }
    setEditTodos(prev => ({
      ...prev,
      [plannerId]: [...(prev[plannerId] || []), { day_of_week: day, title }],
    }));
    setNewTaskTitle(prev => ({ ...prev, [plannerId]: "" }));
  };

  const toggleDeleteTask = (plannerId: string, index: number) => {
    setEditTodos(prev => {
      const list = [...(prev[plannerId] || [])];
      const item = list[index];
      if (item.id) {
        // Existing task: mark/unmark for deletion
        list[index] = { ...item, toDelete: !item.toDelete };
      } else {
        // New task: just remove from list
        list.splice(index, 1);
      }
      return { ...prev, [plannerId]: list };
    });
  };

  const updateEditTaskTitle = (plannerId: string, index: number, title: string) => {
    setEditTodos(prev => {
      const list = [...(prev[plannerId] || [])];
      list[index] = { ...list[index], title };
      return { ...prev, [plannerId]: list };
    });
  };

  const saveEdits = async (planner: SubordinatePlanner) => {
    if (!user) return;
    const todos = editTodos[planner.planner_id] || [];
    const toDelete = todos.filter(t => t.id && t.toDelete);
    const toAdd = todos.filter(t => !t.id && !t.toDelete);
    const toUpdate = todos.filter(t => t.id && !t.toDelete);

    // Check for modified titles
    const modified = toUpdate.filter(t => {
      const original = planner.todos.find(o => o.id === t.id);
      return original && original.title !== t.title;
    });

    let hasError = false;

    // Delete tasks
    for (const t of toDelete) {
      const { error } = await supabase.from("weekly_todos").delete().eq("id", t.id!);
      if (error) { hasError = true; continue; }
      await rpcAudit("insert_weekly_planner_audit", {
        _action: "task_deleted", _actor_id: user.id, _user_id: planner.user_id,
        _week_start: planner.week_start, _details: { title: t.title, by_manager: true },
      });
    }

    // Add new tasks
    for (const t of toAdd) {
      const { error } = await supabase.from("weekly_todos").insert({
        user_id: planner.user_id, week_start: planner.week_start,
        day_of_week: t.day_of_week, title: t.title, sort_order: 99,
        completed: false, has_deliverable: false, deliverable_linked_to_project: false,
      });
      if (error) { hasError = true; continue; }
      await rpcAudit("insert_weekly_planner_audit", {
        _action: "task_added", _actor_id: user.id, _user_id: planner.user_id,
        _week_start: planner.week_start, _details: { title: t.title, day_of_week: t.day_of_week, by_manager: true },
      });
    }

    // Update modified tasks
    for (const t of modified) {
      const original = planner.todos.find(o => o.id === t.id);
      const { error } = await supabase.from("weekly_todos").update({ title: t.title }).eq("id", t.id!);
      if (error) { hasError = true; continue; }
      await rpcAudit("insert_weekly_planner_audit", {
        _action: "task_modified", _actor_id: user.id, _user_id: planner.user_id,
        _week_start: planner.week_start, _details: { old_title: original?.title, new_title: t.title, by_manager: true },
      });
    }

    if (hasError) {
      toast({ title: "Erreur partielle", description: "Certaines modifications n'ont pas pu être enregistrées.", variant: "destructive" });
    } else {
      const changes = toDelete.length + toAdd.length + modified.length;
      toast({ title: "✅ Modifications enregistrées", description: `${changes} modification(s) appliquée(s) au planning de ${planner.full_name}.` });
    }

    cancelEditing(planner.planner_id);
    fetchPlanners();
  };

  const loadAuditLog = async (userId: string, weekStart: string) => {
    const key = `${userId}-${weekStart}`;
    if (showAudit === key) {
      setShowAudit(null);
      return;
    }
    const { data } = await supabase
      .from("weekly_planner_audit_log")
      .select("*")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .order("created_at", { ascending: false });
    setAuditLogs(prev => ({ ...prev, [key]: (data || []) as unknown as AuditEntry[] }));
    setShowAudit(key);
  };

  const actionLabels: Record<string, string> = {
    submitted: "Soumis par le collaborateur",
    validated: "Validé par le manager",
    rejected: "Rejeté par le manager",
    sent_back: "Renvoyé pour modification",
    task_added: "Tâche ajoutée",
    task_deleted: "Tâche supprimée",
    task_modified: "Tâche modifiée",
  };

  if (!canManage) return null;

  // Only show submitted planners first, then others
  const submitted = planners.filter(p => p.status === "submitted");
  const others = planners.filter(p => p.status !== "submitted");

  return (
    <div ref={containerRef}>
    <Card className="border-2 border-primary/20 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setCollapsed(c => !c)}>
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          Validation des plannings — Équipe
          {submitted.length > 0 && (
            <Badge className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0 animate-pulse">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {submitted.length} en attente de validation
            </Badge>
          )}
          <span className="ml-auto">
            {collapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </span>
        </CardTitle>
      </CardHeader>
      {!collapsed && <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : planners.length === 0 ? (
          <div className="text-center py-6 space-y-1">
            <Users className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-xs text-muted-foreground">Aucun planning soumis par vos collaborateurs.</p>
          </div>
        ) : (
          <>
            {[...submitted, ...others].map(planner => {
              const monday = new Date(planner.week_start + "T00:00:00");
              const isExpanded = expandedUser === planner.planner_id;
              const auditKey = `${planner.user_id}-${planner.week_start}`;
              const isSubmitted = planner.status === "submitted";

              return (
                <div
                  key={planner.planner_id}
                  className={`rounded-lg border overflow-hidden transition-all ${
                    isSubmitted
                      ? "border-orange-300 dark:border-orange-600 bg-orange-50/30 dark:bg-orange-950/10"
                      : "border-border/50"
                  }`}
                >
                  {/* Header */}
                  <button
                    onClick={() => setExpandedUser(isExpanded ? null : planner.planner_id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm font-semibold">{planner.full_name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        Semaine du {format(monday, "dd MMM", { locale: fr })} au {format(addDays(monday, 4), "dd MMM yyyy", { locale: fr })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSubmitted && (
                        <Badge className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0">
                          <Clock className="w-3 h-3 mr-1" /> En attente
                        </Badge>
                      )}
                      {planner.status === "validated" && (
                        <Badge className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Validé
                        </Badge>
                      )}
                      {planner.status === "rejected" && (
                        <Badge className="text-[10px] px-2 py-0.5 bg-destructive/10 text-destructive border-0">
                          <XCircle className="w-3 h-3 mr-1" /> Rejeté
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground">{planner.todos.length} tâches</span>
                    </div>
                  </button>

                   {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/30">
                      {/* Edit mode toggle */}
                      {isSubmitted && editingPlanner !== planner.planner_id && (
                        <div className="flex justify-end pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5 border-primary/30 text-primary"
                            onClick={() => startEditing(planner)}
                          >
                            <Pencil className="w-3.5 h-3.5" /> Modifier le planning
                          </Button>
                        </div>
                      )}

                      {/* === VIEW MODE === */}
                      {editingPlanner !== planner.planner_id && (
                        <>
                          {(() => {
                            const subProfile = allProfiles.find(p => p.user_id === planner.user_id);
                            const subDept = subProfile?.department_id ? departments.find(d => d.id === subProfile.department_id) : null;
                            const is7Days = subDept && ["production", "maintenance"].some(name => subDept.name?.toLowerCase().includes(name));
                            const labels = is7Days ? DAY_LABELS_7 : DAY_LABELS_5;
                            return labels.map((dayLabel, idx) => {
                              const dayNum = idx < 5 ? idx + 1 : idx === 5 ? 6 : 0;
                              const dayTodos = planner.todos.filter(t => t.day_of_week === dayNum);
                              if (dayTodos.length === 0) return null;
                              const dayDate = addDays(monday, idx);
                              return (
                                <div key={dayNum} className="mt-2">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-[11px] font-bold text-foreground">{dayLabel}</span>
                                    <span className="text-[10px] text-muted-foreground">{format(dayDate, "dd/MM")}</span>
                                  </div>
                                  <div className="space-y-1.5 pl-3">
                                    {dayTodos.map(todo => (
                                      <div key={todo.id} className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                          <Checkbox checked={todo.completed} disabled className={`h-3.5 w-3.5 ${todo.completed ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}`} />
                                          <span className={`text-xs ${todo.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                            {todo.title}
                                          </span>
                                          {todo.has_deliverable && <Package className="w-3 h-3 text-primary/60" />}
                                        </div>
                                        {todo.has_deliverable && todo.deliverable_name && (
                                          <div className="ml-6">
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 border-primary/20 text-primary/70">
                                              <Package className="w-2.5 h-2.5" />
                                              {todo.deliverable_name}
                                            </Badge>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </>
                      )}

                      {/* === EDIT MODE === */}
                      {editingPlanner === planner.planner_id && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-primary/5 border border-primary/20">
                            <Pencil className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[11px] font-semibold text-primary">Mode édition — Modifiez, ajoutez ou supprimez des tâches puis enregistrez</span>
                          </div>

                          {(() => {
                            const subProfile = allProfiles.find(p => p.user_id === planner.user_id);
                            const subDept = subProfile?.department_id ? departments.find(d => d.id === subProfile.department_id) : null;
                            const is7Days = subDept && ["production", "maintenance"].some(name => subDept.name?.toLowerCase().includes(name));
                            const labels = is7Days ? DAY_LABELS_7 : DAY_LABELS_5;
                            const todos = editTodos[planner.planner_id] || [];
                            return labels.map((dayLabel, idx) => {
                              const dayNum = idx < 5 ? idx + 1 : idx === 5 ? 6 : 0;
                              const dayItems = todos.map((t, i) => ({ ...t, _index: i })).filter(t => t.day_of_week === dayNum);
                              const dayDate = addDays(monday, idx);
                              return (
                                <div key={dayNum} className="mt-2">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-[11px] font-bold text-foreground">{dayLabel}</span>
                                    <span className="text-[10px] text-muted-foreground">{format(dayDate, "dd/MM")}</span>
                                    <span className="text-[10px] text-muted-foreground">({dayItems.filter(t => !t.toDelete).length})</span>
                                  </div>
                                  <div className="space-y-1 pl-3">
                                    {dayItems.map(item => (
                                      <div key={item._index} className={`flex items-center gap-2 rounded px-1 py-0.5 transition-colors ${item.toDelete ? "bg-destructive/10 line-through" : "hover:bg-muted/30"}`}>
                                        <Input
                                          value={item.title}
                                          onChange={e => updateEditTaskTitle(planner.planner_id, item._index, e.target.value)}
                                          disabled={item.toDelete}
                                          className={`h-7 text-xs flex-1 ${item.toDelete ? "opacity-40" : ""}`}
                                        />
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className={`h-6 w-6 p-0 ${item.toDelete ? "text-primary" : "text-destructive/60 hover:text-destructive"}`}
                                          onClick={() => toggleDeleteTask(planner.planner_id, item._index)}
                                          title={item.toDelete ? "Restaurer" : "Supprimer"}
                                        >
                                          {item.toDelete ? <RotateCcw className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                                        </Button>
                                        {!item.id && (
                                          <Badge className="text-[8px] px-1 py-0 bg-primary/10 text-primary border-0">Nouveau</Badge>
                                        )}
                                      </div>
                                    ))}
                                    {dayItems.filter(t => !t.toDelete).length === 0 && (
                                      <p className="text-[10px] text-muted-foreground italic pl-1">Aucune tâche</p>
                                    )}
                                  </div>
                                </div>
                              );
                            });
                          })()}

                          {/* Add new task form */}
                          <div className="mt-3 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-2">
                            <p className="text-[11px] font-semibold text-primary flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5" /> Ajouter une tâche
                            </p>
                            <div className="flex items-center gap-2">
                              <select
                                value={newTaskDay[planner.planner_id] ?? 1}
                                onChange={e => setNewTaskDay(prev => ({ ...prev, [planner.planner_id]: Number(e.target.value) }))}
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                              >
                                {((() => {
                                  const subProfile = allProfiles.find(p => p.user_id === planner.user_id);
                                  const subDept = subProfile?.department_id ? departments.find(d => d.id === subProfile.department_id) : null;
                                  const is7Days = subDept && ["production", "maintenance"].some(name => subDept.name?.toLowerCase().includes(name));
                                  const labels = is7Days ? DAY_LABELS_7 : DAY_LABELS_5;
                                  return labels.map((l, idx) => {
                                    const dayNum = idx < 5 ? idx + 1 : idx === 5 ? 6 : 0;
                                    return <option key={dayNum} value={dayNum}>{l}</option>;
                                  });
                                })())}
                              </select>
                              <Input
                                value={newTaskTitle[planner.planner_id] || ""}
                                onChange={e => setNewTaskTitle(prev => ({ ...prev, [planner.planner_id]: e.target.value }))}
                                placeholder="Titre de la tâche..."
                                className="h-8 text-xs flex-1"
                                onKeyDown={e => { if (e.key === "Enter") addEditTask(planner.planner_id); }}
                              />
                              <Button size="sm" className="h-8 text-xs gap-1 px-3" onClick={() => addEditTask(planner.planner_id)}>
                                <Plus className="w-3 h-3" /> Ajouter
                              </Button>
                            </div>
                          </div>

                          {/* Save / Cancel buttons */}
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              className="h-9 text-xs gap-1.5 flex-1"
                              onClick={() => saveEdits(planner)}
                            >
                              <Save className="w-4 h-4" /> Enregistrer les modifications
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 text-xs gap-1.5"
                              onClick={() => cancelEditing(planner.planner_id)}
                            >
                              Annuler
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Existing manager comment display for validated/rejected */}
                      {planner.status !== "submitted" && planner.manager_comment && (
                        <div className="mt-3 p-2.5 rounded-md bg-muted/40 border border-border/30">
                          <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Commentaire du manager :</p>
                          <p className="text-xs text-foreground">{planner.manager_comment}</p>
                        </div>
                      )}

                      {/* Validation actions — only for submitted planners (not in edit mode) */}
                      {isSubmitted && editingPlanner !== planner.planner_id && (
                        <div className="mt-4 pt-4 border-t-2 border-primary/10 space-y-3">
                          <p className="text-[11px] font-semibold text-primary flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Action requise — Veuillez valider, modifier ou rejeter ce planning
                          </p>
                          <Textarea
                            value={comments[planner.planner_id] || ""}
                            onChange={e => setComments(prev => ({ ...prev, [planner.planner_id]: e.target.value }))}
                            placeholder="Commentaire (obligatoire pour modifier ou rejeter)..."
                            className="text-xs min-h-[70px] border-primary/20 focus:border-primary"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-9 text-xs gap-1.5 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleValidate(planner)}
                            >
                              <CheckCircle2 className="w-4 h-4" /> Valider le planning
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 text-xs gap-1.5 flex-1 border-orange-400 text-orange-700 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-400 dark:hover:bg-orange-950/20"
                              onClick={() => handleSendBack(planner)}
                            >
                              <RotateCcw className="w-4 h-4" /> Renvoyer pour modification
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-9 text-xs gap-1.5 flex-1"
                              onClick={() => handleReject(planner)}
                            >
                              <XCircle className="w-4 h-4" /> Rejeter
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Audit trail button */}
                      <div className="mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] gap-1 text-muted-foreground"
                          onClick={() => loadAuditLog(planner.user_id, planner.week_start)}
                        >
                          <History className="w-3 h-3" /> Historique
                        </Button>
                        {showAudit === auditKey && auditLogs[auditKey] && (
                          <ScrollArea className="max-h-32 mt-1">
                            <div className="space-y-1 pl-2">
                              {auditLogs[auditKey].length === 0 ? (
                                <p className="text-[9px] text-muted-foreground">Aucune entrée.</p>
                              ) : (
                                auditLogs[auditKey].map(log => (
                                  <div key={log.id} className="flex items-start gap-2 text-[9px] text-muted-foreground">
                                    <span className="shrink-0">{format(new Date(log.created_at), "dd/MM HH:mm", { locale: fr })}</span>
                                    <span>{actionLabels[log.action] || log.action}</span>
                                    {log.details?.title && <span className="text-foreground/60">« {log.details.title} »</span>}
                                    {log.details?.comment && <span className="italic">— {log.details.comment}</span>}
                                  </div>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </CardContent>}
    </Card>
    </div>
  );
};

export default ManagerWeeklyValidation;
