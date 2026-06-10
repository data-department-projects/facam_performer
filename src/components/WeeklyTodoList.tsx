import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useCommittees } from "@/contexts/CommitteesContext";
import { useProfiles } from "@/hooks/useProfiles";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { Department } from "@/data/departments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ListChecks, ChevronDown, ChevronRight, ChevronLeft, ChevronUp, Lock, Trash2, Package, Send, CheckCircle2, XCircle, Clock, Users } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isBefore, isAfter } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const DAY_LABELS_5 = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const DAY_LABELS_7 = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const PRODUCTION_MAINTENANCE_DEPTS = ["production", "maintenance"];

interface OpMeeting {
  id: string;
  title: string;
  day_of_week: number;
  time_start?: string | null;
  time_end?: string | null;
  participant_ids?: string[];
  animator_ids?: string[];
}

const isProductionOrMaintenanceDept = (departmentId: string | null | undefined, departments: Department[]): boolean => {
  if (!departmentId) return false;
  const dept = departments.find((d) => d.id === departmentId);
  if (!dept) return false;
  return PRODUCTION_MAINTENANCE_DEPTS.some(name => dept.name?.toLowerCase().includes(name));
};

interface Todo {
  id: string;
  user_id: string;
  week_start: string;
  day_of_week: number;
  title: string;
  completed: boolean;
  sort_order: number;
  has_deliverable: boolean;
  deliverable_linked_to_project: boolean;
  deliverable_project_id: string | null;
  deliverable_name: string;
}

interface PlannerStatus {
  id: string;
  user_id: string;
  week_start: string;
  status: "draft" | "submitted" | "validated" | "rejected";
  submitted_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
  manager_comment: string;
}

const getWeekStart = (date: Date = new Date()): string => {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, "yyyy-MM-dd");
};

// Deadline: vendredi de la semaine précédente à 16h00
const getSubmissionDeadline = (weekStartStr: string): Date => {
  const monday = new Date(weekStartStr + "T00:00:00");
  // Friday of previous week = monday - 3 days
  const friday = addDays(monday, -3);
  friday.setHours(16, 0, 0, 0);
  return friday;
};

type UntypedRpc = (fn: string, params: Record<string, unknown>) => Promise<{ error: Error | null }>;

const WeeklyTodoList = ({ onTodosChanged, refreshKey = 0 }: { onTodosChanged?: () => void; refreshKey?: number }) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { projects } = useProjects();
  const { committees } = useCommittees();
  const { departments } = useDepartments();
  const { organization } = useOrganization();
  const profiles = useProfiles();
  const fridayDeadlineEnabled = organization.fridayDeadlineEnabled ?? false;
  const is7Days = isProductionOrMaintenanceDept(profile?.department_id, departments);
  const DAY_LABELS = is7Days ? DAY_LABELS_7 : DAY_LABELS_5;
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [opMeetings, setOpMeetings] = useState<OpMeeting[]>([]);
  const [newTitles, setNewTitles] = useState<Record<number, string>>({});
  const [collapsedDays, setCollapsedDays] = useState<Record<number, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date());
  const [plannerStatus, setPlannerStatus] = useState<PlannerStatus | null>(null);

  const [newDeliverable, setNewDeliverable] = useState<Record<number, {
    has: boolean;
    linkedToProject: boolean;
    projectId: string;
    name: string;
  }>>({});

  const weekStart = getWeekStart(selectedWeekDate);
  const currentWeekStart = getWeekStart(new Date());
  const mondayDate = startOfWeek(selectedWeekDate, { weekStartsOn: 1 });
  const endDate = addDays(mondayDate, is7Days ? 6 : 4);

  const isOldWeek = isBefore(new Date(weekStart + "T23:59:59"), startOfWeek(new Date(), { weekStartsOn: 1 }));
  const isCurrentWeek = weekStart === currentWeekStart;
  const submissionDeadline = getSubmissionDeadline(weekStart);
  const now = new Date();
  const isBeforeDeadline = isBefore(now, submissionDeadline);

  // Status helpers
  const status = plannerStatus?.status || "draft";
  const isSubmitted = status === "submitted";
  const isValidatedByManager = status === "validated";
  const isRejected = status === "rejected";

  // Can the user modify/delete existing tasks?
  // - If validated: NO modification
  // - If submitted: NO modification (waiting for manager)
  // - Past days: NO modification
  const canModifyTask = (todo: Todo) => {
    if (isValidatedByManager || isSubmitted) return false;
    if (isOldWeek) return false;
    const todayDow = new Date().getDay();
    if (isCurrentWeek) {
      if (is7Days) {
        const dayOffset = todo.day_of_week === 0 ? 6 : todo.day_of_week - 1;
        const todayOffset = todayDow === 0 ? 6 : todayDow - 1;
        if (dayOffset < todayOffset) return false;
      } else {
        if (todo.day_of_week < todayDow) return false;
      }
    }
    return true;
  };

  // Can the user toggle task completion (check/uncheck)?
  // - Allowed ONLY on the task's specific day (today), not future days
  // - Allowed even when planner is validated/submitted (checking completion is independent)
  // - Blocked for past days and old weeks
  const canToggleComplete = (todo: Todo) => {
    if (isOldWeek) return false;
    if (!isCurrentWeek) return false;
    const todayDow = new Date().getDay();
    if (is7Days) {
      const dayOffset = todo.day_of_week === 0 ? 6 : todo.day_of_week - 1;
      const todayOffset = todayDow === 0 ? 6 : todayDow - 1;
      return dayOffset === todayOffset;
    } else {
      return todo.day_of_week === todayDow;
    }
  };

  // Can the user add new tasks to a day?
  // - Always allowed (even after validation, user can add)
  // - EXCEPT past days
  // - Production/maintenance: 7/7, others: Mon-Fri only
  const canAddToDay = (dayOfWeek: number) => {
    if (isOldWeek) return false;
    if (!is7Days && (dayOfWeek === 0 || dayOfWeek === 6)) return false;
    const todayDow = new Date().getDay();
    // For 7-day mode, Sunday=0 needs special handling
    if (isCurrentWeek) {
      if (is7Days) {
        // Compare using date offset from Monday
        const dayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const todayOffset = todayDow === 0 ? 6 : todayDow - 1;
        if (dayOffset < todayOffset) return false;
      } else {
        if (dayOfWeek < todayDow) return false;
      }
    }
    return true;
  };

  // Can submit?
  const canSubmit = status === "draft" || status === "rejected";

  // Get projects/committees where the user is a collaborator
  const userActivities = useMemo(() => {
    const userName = profile?.full_name || "";
    const userProjects = projects.filter(p =>
      p.collaborators?.some(c => c.name === userName) ||
      p.projectLead?.includes(userName) ||
      p.responsibles?.includes(userName)
    );
    const userCommittees = committees.filter(c =>
      c.members?.some(m => m.name === userName) ||
      c.responsible === userName
    );
    return [
      ...userProjects.map(p => ({ id: p.id, name: p.name, type: "projet" as const })),
      ...userCommittees.map(c => ({ id: c.id, name: c.name, type: "comité" as const })),
    ];
  }, [projects, committees, profile]);

  // Virtual read-only tasks from committee meetings that fall within the displayed week
  const committeeMeetingTodos = useMemo(() => {
    if (!user || !profile) return [];
    const userName = profile.full_name || "";
    const userId = user.id;
    const weekMonday = new Date(weekStart + "T00:00:00");
    const weekEnd = addDays(weekMonday, is7Days ? 6 : 4);
    weekEnd.setHours(23, 59, 59, 999);

    const virtualTodos: (Todo & { isCommitteeMeeting?: boolean; committeeIcon?: string; meetingTime?: string })[] = [];

    committees.forEach(c => {
      // Check if user is participant or responsible
      const isParticipant = c.members?.some(m => m.name === userName);
      const isResponsible = (c.responsibleIds || []).includes(userId) ||
        (c.responsible?.includes(userName));
      const isGuest = (c.guests || []).some(g => {
        if (g.startsWith("ext:")) return false;
        const guestProfile = profiles.find(p => p.user_id === g);
        return g === userId || (guestProfile && guestProfile.full_name === userName);
      });

      if (!isParticipant && !isResponsible && !isGuest) return;

      (c.meetings || []).forEach(meeting => {
        const meetingDate = new Date(meeting.date);
        if (meetingDate >= weekMonday && meetingDate <= weekEnd) {
          const dayOfWeek = meetingDate.getDay(); // 0=Sun, 1=Mon...
          if (is7Days || (dayOfWeek >= 1 && dayOfWeek <= 5)) {
            virtualTodos.push({
              id: `committee-meeting-${c.id}-${meeting.id}`,
              user_id: userId,
              week_start: weekStart,
              day_of_week: dayOfWeek,
              title: `${c.icon} ${c.name}${meeting.time ? ` ${meeting.time}${meeting.time_end ? `-${meeting.time_end}` : ""}` : ""}${meeting.institution ? ` — 🏦 ${meeting.institution}` : ""}`,
              completed: false,
              sort_order: -1,
              has_deliverable: false,
              deliverable_linked_to_project: false,
              deliverable_project_id: null,
              deliverable_name: "",
              isCommitteeMeeting: true,
              committeeIcon: c.icon,
              meetingTime: meeting.time,
            });
          }
        }
      });
    });

    return virtualTodos;
  }, [committees, profiles, user, profile, weekStart, is7Days]);

  // Virtual read-only tasks from operational meetings (recurring weekly on fixed day)
  const operationalMeetingTodos = useMemo(() => {
    if (!user || !opMeetings.length) return [];
    const userId = user.id;

    const virtualTodos: (Todo & { isCommitteeMeeting?: boolean; committeeIcon?: string; meetingTime?: string })[] = [];

    opMeetings.forEach(m => {
      const isParticipant = (m.participant_ids || []).includes(userId);
      const isAnimator = (m.animator_ids || []).includes(userId);
      if (!isParticipant && !isAnimator) return;

      const dayOfWeek = m.day_of_week; // 0=Sun, 1=Mon...
      if (is7Days || (dayOfWeek >= 1 && dayOfWeek <= 5)) {
        virtualTodos.push({
          id: `op-meeting-${m.id}`,
          user_id: userId,
          week_start: weekStart,
          day_of_week: dayOfWeek,
          title: `📋 ${m.title}${m.time_start ? ` ${m.time_start}${m.time_end ? `-${m.time_end}` : ""}` : ""}`,
          completed: false,
          sort_order: -2,
          has_deliverable: false,
          deliverable_linked_to_project: false,
          deliverable_project_id: null,
          deliverable_name: "",
          isCommitteeMeeting: true,
          committeeIcon: "📋",
          meetingTime: m.time_start || undefined,
        });
      }
    });

    return virtualTodos;
  }, [opMeetings, user, weekStart, is7Days]);

  const getMilestonesForProject = useCallback((projectId: string) => {
    const userName = profile?.full_name || "";
    const project = projects.find(p => p.id === projectId);
    if (!project) return [];
    const collaborator = project.collaborators?.find(c => c.name === userName);
    const milestones: { id: string; title: string; missionTitle: string }[] = [];
    if (collaborator?.missions) {
      collaborator.missions.forEach(mission => {
        mission.milestones?.forEach(ms => {
          milestones.push({ id: ms.id, title: ms.title, missionTitle: mission.title });
        });
      });
    }
    if (project.projectLead?.includes(userName) || project.responsibles?.includes(userName)) {
      project.milestones?.forEach(ms => {
        if (!milestones.some(m => m.id === ms.id)) {
          milestones.push({ id: ms.id, title: ms.title, missionTitle: "Projet" });
        }
      });
    }
    return milestones;
  }, [projects, profile]);

  const fetchTodos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("weekly_todos")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .order("day_of_week")
      .order("sort_order");
    if (data) setTodos(data as unknown as Todo[]);
    setLoading(false);
  }, [user, weekStart]);

  const fetchPlannerStatus = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("weekly_planner_status")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .maybeSingle();
    setPlannerStatus(data as unknown as PlannerStatus | null);
  }, [user, weekStart]);

  useEffect(() => { fetchTodos(); fetchPlannerStatus(); }, [fetchTodos, fetchPlannerStatus]);
  useEffect(() => { if (refreshKey > 0) fetchTodos(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch operational meetings
  useEffect(() => {
    const loadOpMeetings = async () => {
      const { data } = await supabase.from("operational_meetings").select("*");
      if (data) setOpMeetings(data);
    };
    loadOpMeetings();
  }, []);

  const goToPrevWeek = () => setSelectedWeekDate(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setSelectedWeekDate(prev => addWeeks(prev, 1));
  const goToCurrentWeek = () => setSelectedWeekDate(new Date());

  const getNewDeliverable = (day: number) => newDeliverable[day] || { has: false, linkedToProject: false, projectId: "", name: "" };
  const setNewDeliverableField = (day: number, field: string, value: string | boolean) => {
    setNewDeliverable(prev => ({
      ...prev,
      [day]: { ...getNewDeliverable(day), ...prev[day], [field]: value },
    }));
  };

  const addTodo = async (dayOfWeek: number) => {
    const title = newTitles[dayOfWeek]?.trim();
    if (!title || !user) return;
    if (!canAddToDay(dayOfWeek)) {
      toast({ title: "Jour passé", description: "Impossible d'ajouter une tâche à un jour déjà passé.", variant: "destructive" });
      return;
    }
    const del = getNewDeliverable(dayOfWeek);
    const maxOrder = todos.filter(t => t.day_of_week === dayOfWeek).length;
    const { error } = await supabase.from("weekly_todos").insert({
      user_id: user.id,
      week_start: weekStart,
      day_of_week: dayOfWeek,
      title,
      sort_order: maxOrder,
      has_deliverable: del.has,
      deliverable_linked_to_project: del.has && del.linkedToProject,
      deliverable_project_id: del.has && del.linkedToProject ? del.projectId || null : null,
      deliverable_name: del.has ? del.name : "",
    });
    if (!error) {
      // Log audit
      await (supabase.rpc as unknown as UntypedRpc)("insert_weekly_planner_audit", {
        _action: "task_added", _actor_id: user.id, _user_id: user.id,
        _week_start: weekStart, _details: { title, day_of_week: dayOfWeek },
      });
      setNewTitles(prev => ({ ...prev, [dayOfWeek]: "" }));
      setNewDeliverable(prev => ({ ...prev, [dayOfWeek]: { has: false, linkedToProject: false, projectId: "", name: "" } }));
      fetchTodos();
      onTodosChanged?.();
    }
  };

  const toggleTodo = async (todo: Todo) => {
    if (!canToggleComplete(todo)) {
      toast({ title: "Modification impossible", description: "Vous ne pouvez cocher une tâche que le jour même.", variant: "destructive" });
      return;
    }
    await supabase.from("weekly_todos")
      .update({ completed: !todo.completed, updated_at: new Date().toISOString() })
      .eq("id", todo.id);
    fetchTodos();
    onTodosChanged?.();
  };

  const deleteTodo = async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (todo && !canModifyTask(todo)) {
      toast({ title: "Suppression impossible", description: "Cette tâche ne peut plus être supprimée.", variant: "destructive" });
      return;
    }
    await supabase.from("weekly_todos").delete().eq("id", id);
    if (user) {
      await (supabase.rpc as unknown as UntypedRpc)("insert_weekly_planner_audit", {
        _action: "task_deleted", _actor_id: user.id, _user_id: user.id,
        _week_start: weekStart, _details: { title: todo?.title },
      });
    }
    fetchTodos();
    onTodosChanged?.();
  };

  const submitPlanner = async () => {
    if (!user || !canSubmit) return;
    if (todos.length === 0) {
      toast({ title: "Aucune tâche", description: "Ajoutez au moins une tâche avant de soumettre.", variant: "destructive" });
      return;
    }
    // Upsert planner status
    const { error } = await supabase.from("weekly_planner_status").upsert({
      user_id: user.id,
      week_start: weekStart,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      manager_comment: "",
    }, { onConflict: "user_id,week_start" });
    if (!error) {
      await (supabase.rpc as unknown as UntypedRpc)("insert_weekly_planner_audit", {
        _action: "submitted", _actor_id: user.id, _user_id: user.id,
        _week_start: weekStart, _details: { task_count: todos.length },
      });
      // Notify manager via email (fire & forget)
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          if (!session) return;
          return fetch("/api/notify-planning", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ user_id: user.id, week_start: weekStart }),
          });
        })
        .catch(() => {});
      toast({ title: "Planner envoyé", description: "Votre planning a été envoyé à votre manager pour validation." });
      fetchPlannerStatus();
    }
  };

  const toggleDay = (day: number) => {
    setCollapsedDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

  const todayDayOfWeek = new Date().getDay();
  const todayLabel = (() => {
    if (is7Days) {
      // 0=Sun mapped to index 6, 1-6 mapped to index 0-5
      const idx = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;
      return DAY_LABELS[idx] || null;
    }
    return todayDayOfWeek >= 1 && todayDayOfWeek <= 5 ? DAY_LABELS[todayDayOfWeek - 1] : null;
  })();
  const todayTodos = isCurrentWeek ? todos.filter(t => t.day_of_week === todayDayOfWeek) : [];
  const todayCommitteeTodos = isCurrentWeek ? [...committeeMeetingTodos.filter(t => t.day_of_week === todayDayOfWeek), ...operationalMeetingTodos.filter(t => t.day_of_week === todayDayOfWeek)] : [];

  const totalTodos = todos.length;
  const completedTodos = todos.filter(t => t.completed).length;
  const progressPct = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;


  const getActivityName = (projectId: string | null) => {
    if (!projectId) return null;
    const act = userActivities.find(a => a.id === projectId);
    return act ? act.name : projectId;
  };

  const statusBadge = () => {
    switch (status) {
      case "draft": return <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1 border-muted-foreground/30"><Clock className="w-2.5 h-2.5" /> Brouillon</Badge>;
      case "submitted": return <Badge className="text-[9px] px-1.5 py-0 gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0"><Send className="w-2.5 h-2.5" /> En attente de validation</Badge>;
      case "validated": return <Badge className="text-[9px] px-1.5 py-0 gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0"><CheckCircle2 className="w-2.5 h-2.5" /> Validé</Badge>;
      case "rejected": return <Badge className="text-[9px] px-1.5 py-0 gap-1 bg-destructive/10 text-destructive border-0"><XCircle className="w-2.5 h-2.5" /> Rejeté</Badge>;
    }
  };

  return (
    <Card className="border-0 shadow-[var(--shadow-card)] sticky top-6">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center">
              <ListChecks className="w-4 h-4 text-accent-foreground" />
            </div>
            Week Planner
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>

        {!collapsed && (
          <>
            <div className="flex items-center justify-between mt-2">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={goToPrevWeek}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <button onClick={goToCurrentWeek} className="text-[10px] font-medium text-foreground hover:text-primary transition-colors">
                {format(mondayDate, "dd MMM", { locale: fr })} — {format(endDate, "dd MMM yyyy", { locale: fr })}
              </button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={goToNextWeek}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>


            {/* Status badges */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {isCurrentWeek && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary">Semaine en cours</Badge>
              )}
              {statusBadge()}
              {isOldWeek && (
                <Badge className="text-[9px] px-1.5 py-0 bg-muted text-muted-foreground border-0 gap-1">
                  <Lock className="w-2.5 h-2.5" /> Semaine passée
                </Badge>
              )}
            </div>

            {/* Manager rejection comment */}
            {isRejected && plannerStatus?.manager_comment && (
              <div className="mt-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                <p className="text-[10px] text-destructive font-medium">Commentaire du manager :</p>
                <p className="text-[10px] text-destructive/80">{plannerStatus.manager_comment}</p>
              </div>
            )}

            {/* Validation notification */}
            {isValidatedByManager && (
              <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                  ✅ Votre Week Planner du {format(mondayDate, "dd MMM", { locale: fr })} au {format(endDate, "dd MMM yyyy", { locale: fr })} a été validé.
                </p>
                {plannerStatus?.manager_comment && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-0.5">Commentaire : {plannerStatus.manager_comment}</p>
                )}
              </div>
            )}

            {/* Deadline info */}
            {fridayDeadlineEnabled && canSubmit && !isOldWeek && (
              <div className="mt-1.5">
                <p className="text-[9px] text-muted-foreground">
                  📅 Date limite de soumission : <span className="font-semibold">{format(submissionDeadline, "EEEE dd MMM à HH:mm", { locale: fr })}</span>
                  {!isBeforeDeadline && <span className="text-destructive ml-1">(dépassée)</span>}
                </p>
              </div>
            )}

            {/* Progress */}
            {totalTodos > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{completedTodos}/{totalTodos} tâches</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}
          </>
        )}
      </CardHeader>

      {!collapsed && (
        <CardContent className="px-4 pb-4 space-y-1">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {DAY_LABELS.map((dayLabel, idx) => {
                // Mon=1, Tue=2, ..., Fri=5, Sat=6, Sun=0
                const dayNum = idx < 5 ? idx + 1 : idx === 5 ? 6 : 0;
                const dayTodos = todos.filter(t => t.day_of_week === dayNum);
                const dayCommitteeTodos = [...committeeMeetingTodos.filter(t => t.day_of_week === dayNum), ...operationalMeetingTodos.filter(t => t.day_of_week === dayNum)];
                const allDayTodos = [...dayCommitteeTodos, ...dayTodos];
                const dayCompleted = dayTodos.filter(t => t.completed).length;
                const isToday = isCurrentWeek && todayDayOfWeek === dayNum;
                const dayDate = addDays(mondayDate, idx);
                const dayCollapsed = collapsedDays[dayNum];
                const dayOffset = dayNum === 0 ? 6 : dayNum - 1;
                const todayOffset = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;
                const isDayPast = isCurrentWeek && dayOffset < todayOffset;
                const canAdd = canAddToDay(dayNum);
                const del = getNewDeliverable(dayNum);

                return (
                  <div key={dayNum} className={`rounded-lg border ${isToday ? "border-primary/30 bg-primary/5" : isDayPast ? "border-border/20 bg-muted/20" : "border-border/30 bg-card"} overflow-hidden`}>
                    <button
                      onClick={() => toggleDay(dayNum)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {dayCollapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                        <span className={`text-xs font-semibold ${isToday ? "text-primary" : isDayPast ? "text-muted-foreground" : "text-foreground"}`}>{dayLabel}</span>
                        <span className="text-[10px] text-muted-foreground">{format(dayDate, "dd/MM")}</span>
                        {isDayPast && <Lock className="w-2.5 h-2.5 text-muted-foreground/50" />}
                      </div>
                      {allDayTodos.length > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${dayCompleted === dayTodos.length && dayTodos.length > 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {dayCommitteeTodos.length > 0 ? `${dayCompleted}/${dayTodos.length} + ${dayCommitteeTodos.length} 📅` : `${dayCompleted}/${dayTodos.length}`}
                        </span>
                      )}
                    </button>

                    {!dayCollapsed && (
                      <div className="px-3 pb-2 space-y-1.5">
                        {/* Committee meeting tasks (read-only) */}
                        {dayCommitteeTodos.map(ct => (
                          <div key={ct.id} className="flex items-center gap-2 rounded-md bg-accent/10 px-2 py-1.5 border border-accent/20">
                            <Users className="w-3 h-3 text-accent-foreground shrink-0" />
                            <span className="text-xs font-medium text-foreground flex-1">{ct.title}</span>
                            <Lock className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />
                          </div>
                        ))}
                        {dayTodos.map(todo => (
                          <TodoItem
                            key={todo.id}
                            todo={todo}
                            canModify={canModifyTask(todo)}
                            canToggle={canToggleComplete(todo)}
                            onToggle={() => toggleTodo(todo)}
                            onDelete={() => deleteTodo(todo.id)}
                            getActivityName={getActivityName}
                          />
                        ))}

                        {/* New task form - can always add unless past day */}
                        {canAdd && (
                          <div className="space-y-1.5 mt-2 pt-2 border-t border-border/20">
                            <div className="flex items-center gap-1">
                              <Input
                                value={newTitles[dayNum] || ""}
                                onChange={e => setNewTitles(prev => ({ ...prev, [dayNum]: e.target.value }))}
                                onKeyDown={e => { if (e.key === "Enter") addTodo(dayNum); }}
                                placeholder="Ajouter une tâche..."
                                className="h-6 text-[10px] border-dashed bg-transparent px-2"
                              />
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-primary" onClick={() => addTodo(dayNum)} disabled={!newTitles[dayNum]?.trim()}>
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>

                            {/* Deliverable fields */}
                            <div className="space-y-1 pl-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Jalon (livrable) :</span>
                                <Select value={del.has ? "oui" : "non"} onValueChange={v => setNewDeliverableField(dayNum, "has", v === "oui")}>
                                  <SelectTrigger className="h-5 text-[10px] w-16 px-1.5"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="non">Non</SelectItem>
                                    <SelectItem value="oui">Oui</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {del.has && (
                                <>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Rattaché à un projet :</span>
                                    <Select value={del.linkedToProject ? "oui" : "non"} onValueChange={v => setNewDeliverableField(dayNum, "linkedToProject", v === "oui")}>
                                      <SelectTrigger className="h-5 text-[10px] w-16 px-1.5"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="non">Non</SelectItem>
                                        <SelectItem value="oui">Oui</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {del.linkedToProject ? (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Projet/Comité :</span>
                                        <Select value={del.projectId} onValueChange={v => {
                                          setNewDeliverableField(dayNum, "projectId", v);
                                          setNewDeliverableField(dayNum, "name", "");
                                        }}>
                                          <SelectTrigger className="h-5 text-[10px] flex-1 px-1.5"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                          <SelectContent>
                                            {userActivities.map(a => (
                                              <SelectItem key={a.id} value={a.id}>
                                                <span className="text-[10px]">{a.name} <span className="text-muted-foreground">({a.type})</span></span>
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      {del.projectId && (() => {
                                        const milestones = getMilestonesForProject(del.projectId);
                                        return milestones.length > 0 ? (
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Jalon (livrable) :</span>
                                            <Select value={del.name} onValueChange={v => setNewDeliverableField(dayNum, "name", v)}>
                                              <SelectTrigger className="h-5 text-[10px] flex-1 px-1.5"><SelectValue placeholder="Choisir un jalon..." /></SelectTrigger>
                                              <SelectContent>
                                                {milestones.map(ms => (
                                                  <SelectItem key={ms.id} value={ms.title}>
                                                    <span className="text-[10px]">{ms.title} <span className="text-muted-foreground">({ms.missionTitle})</span></span>
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Jalon (livrable) :</span>
                                            <Input
                                              value={del.name}
                                              onChange={e => setNewDeliverableField(dayNum, "name", e.target.value)}
                                              placeholder="Aucun jalon trouvé, saisir manuellement..."
                                              className="h-5 text-[10px] px-1.5 flex-1"
                                            />
                                          </div>
                                        );
                                      })()}
                                    </>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Nom du jalon (livrable) :</span>
                                      <Input
                                        value={del.name}
                                        onChange={e => setNewDeliverableField(dayNum, "name", e.target.value)}
                                        placeholder="Nom du jalon..."
                                        className="h-5 text-[10px] px-1.5 flex-1"
                                      />
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Submit button - orange, always visible when applicable */}
              {canSubmit && !isOldWeek && (
                <div className="pt-4 pb-1">
                  <Button
                    type="button"
                    onClick={submitPlanner}
                    className="text-xs gap-1.5 w-full rounded-xl h-9"
                    size="sm"
                    disabled={todos.length === 0}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Envoyer au manager pour validation
                  </Button>
                  {todos.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center mt-1">Ajoutez au moins une tâche pour soumettre</p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      )}

      {/* Today's tasks summary when collapsed */}
      {collapsed && (todayTodos.length > 0 || todayCommitteeTodos.length > 0) && todayLabel && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-primary">{todayLabel} — Aujourd'hui</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {todayTodos.filter(t => t.completed).length}/{todayTodos.length}{todayCommitteeTodos.length > 0 ? ` + ${todayCommitteeTodos.length} 📅` : ""}
              </span>
            </div>
            <div className="space-y-1">
              {todayCommitteeTodos.map(ct => (
                <div key={ct.id} className="flex items-center gap-2">
                  <Users className="w-3 h-3 text-accent-foreground" />
                  <span className="text-xs font-medium text-foreground">{ct.title}</span>
                  <Lock className="w-2.5 h-2.5 text-muted-foreground/50" />
                </div>
              ))}
              {todayTodos.map(todo => (
                <div key={todo.id} className="flex items-center gap-2">
                  <Checkbox checked={todo.completed} onCheckedChange={() => toggleTodo(todo)} className={`h-3.5 w-3.5 ${todo.completed ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}`} disabled={!canToggleComplete(todo)} />
                  <span className={`text-xs ${todo.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{todo.title}</span>
                  {todo.has_deliverable && <Package className="w-2.5 h-2.5 text-primary/60" />}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

const TodoItem = ({ todo, canModify, canToggle, onToggle, onDelete, getActivityName }: {
  todo: Todo;
  canModify: boolean;
  canToggle: boolean;
  onToggle: () => void;
  onDelete: () => void;
  getActivityName: (id: string | null) => string | null;
}) => (
  <div className="space-y-0.5">
    <div className="flex items-center gap-2 group">
      <Checkbox checked={todo.completed} onCheckedChange={onToggle} className={`h-3.5 w-3.5 ${todo.completed ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}`} disabled={!canToggle} />
      <span className={`text-xs flex-1 ${todo.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{todo.title}</span>
      {todo.has_deliverable && <Package className="w-2.5 h-2.5 text-primary/60 shrink-0" />}
      {canModify && (
        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={onDelete}>
          <Trash2 className="w-2.5 h-2.5" />
        </Button>
      )}
      {!canModify && <Lock className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />}
    </div>
    {todo.has_deliverable && (
      <div className="ml-6 flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1 border-primary/20 text-primary/80">
          <Package className="w-2 h-2" />
          {todo.deliverable_name || "Jalon"}
        </Badge>
        {todo.deliverable_linked_to_project && todo.deliverable_project_id && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
            {getActivityName(todo.deliverable_project_id)}
          </Badge>
        )}
      </div>
    )}
  </div>
);

export default WeeklyTodoList;
