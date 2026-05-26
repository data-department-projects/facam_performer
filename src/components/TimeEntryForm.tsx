import { useState, useEffect, useMemo, useCallback } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useProjects } from "@/contexts/ProjectsContext";
import { useCommittees } from "@/contexts/CommitteesContext";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/useProfiles";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, Send, AlertTriangle, ShieldCheck, Sun, Moon, Plus, Trash2, ListChecks, Lock, CheckCircle2, Users, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const isBusinessDay = (date: Date) => {
  const day = date.getDay();
  return day >= 1 && day <= 5;
};

const getFridayCutoff = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = 5 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(17, 0, 0, 0);
  return d;
};

const canEnterTimeForDate = (dateStr: string, is247: boolean = false, fridayDeadlineEnabled: boolean = true): { allowed: boolean; reason?: string } => {
  const entryDate = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (entryDate > today) {
    return { allowed: false, reason: "Impossible de saisir du temps pour une date future." };
  }
  if (!is247 && !isBusinessDay(entryDate)) {
    return { allowed: false, reason: "La saisie n'est possible que pour les jours ouvrés (lundi-vendredi)." };
  }
  const entryDateStr = format(entryDate, "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");
  if (!is247 && entryDateStr === todayStr && (now.getHours() > 18 || (now.getHours() === 18 && now.getMinutes() >= 30))) {
    return { allowed: false, reason: "La saisie pour aujourd'hui est fermée (après 18h30)." };
  }
  if (fridayDeadlineEnabled) {
    const fridayCutoff = getFridayCutoff(entryDate);
    if (!is247 && now > fridayCutoff) {
      return { allowed: false, reason: `La semaine est clôturée depuis vendredi 17h. Saisie impossible pour le ${format(entryDate, "dd/MM/yyyy")}.` };
    }
  }
  const startOfWeek = new Date(today);
  const dayOfWeek = startOfWeek.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(startOfWeek.getDate() + mondayOffset);
  startOfWeek.setHours(0, 0, 0, 0);
  if (entryDate < startOfWeek) {
    return { allowed: false, reason: "Saisie uniquement possible pour la semaine en cours." };
  }
  return { allowed: true };
};

// Generate time options - standard (08:00-18:30) and 24h versions
const TIME_OPTIONS_STANDARD: string[] = [];
for (let h = 8; h <= 18; h++) {
  for (const m of [0, 15, 30, 45]) {
    const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (t <= "18:30") TIME_OPTIONS_STANDARD.push(t);
  }
}

const TIME_OPTIONS_24H: string[] = [];
for (let h = 0; h <= 23; h++) {
  for (const m of [0, 15, 30, 45]) {
    TIME_OPTIONS_24H.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

const VALID_TIMES_STANDARD = TIME_OPTIONS_STANDARD.filter(t => t <= "18:30");

interface DayTodo {
  id: string;
  title: string;
  completed: boolean;
}

interface TimeSlot {
  projectId: string;
  taskId: string;
  startTime: string;
  endTime: string;
  comment: string;
  meetingName: string;
}

const REUNION_ID = "__reunion__";

const createSlot = (startTime: string, endTime: string): TimeSlot => ({
  projectId: "",
  taskId: "",
  startTime,
  endTime,
  comment: "",
  meetingName: "",
});

const TimeEntryForm = ({ todoRefreshKey = 0, onTodoCompleted }: { todoRefreshKey?: number; onTodoCompleted?: () => void }) => {
  const { projects } = useProjects();
  const { committees } = useCommittees();
  const { addEntry, entries } = useTimeTracking();
  const { user, profile } = useAuth();
  const profiles = useProfiles();
  const { departments } = useDepartments();
  const { organization } = useOrganization();
  const { toast } = useToast();

  // Check if user is in production/maintenance dept (24/7 access)
  const is247 = useMemo(() => {
    if (!profile?.department_id) return false;
    const dept = departments.find(d => d.id === profile.department_id);
    return dept ? ["production", "maintenance"].some(name => dept.name?.toLowerCase().includes(name)) : false;
  }, [profile, departments]);

  const VALID_TIMES = is247 ? TIME_OPTIONS_24H : VALID_TIMES_STANDARD;
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [slots, setSlots] = useState<TimeSlot[]>([createSlot("08:00", "18:30")]);
  const [isExempt, setIsExempt] = useState(false);
  const [exemptLoading, setExemptLoading] = useState(true);
  const [dayTodos, setDayTodos] = useState<DayTodo[]>([]);
  const [meetingAttendance, setMeetingAttendance] = useState<Record<string, { attended: string; reason: string }>>({});
  const [opMeetings, setOpMeetings] = useState<any[]>([]);

  const collaboratorName = profile?.full_name || "";

  // Committee meetings scheduled for the selected date
  const committeeMeetingsForDate = useMemo(() => {
    if (!user || !profile) return [];
    const userName = profile.full_name || "";
    const userId = user.id;
    const selectedDate = new Date(date + "T00:00:00");
    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

    const meetings: { id: string; committeeId: string; committeeName: string; committeeIcon: string; time?: string; time_end?: string; institution?: string; link?: string }[] = [];

    committees.forEach(c => {
      const isParticipant = c.members?.some(m => m.name === userName);
      const isResponsible = (c.responsibleIds || []).includes(userId) || (c.responsible?.includes(userName));
      const isGuest = (c.guests || []).some(g => {
        if (g.startsWith("ext:")) return false;
        const guestProfile = profiles.find(p => p.user_id === g);
        return g === userId || (guestProfile && guestProfile.full_name === userName);
      });

      if (!isParticipant && !isResponsible && !isGuest) return;

      (c.meetings || []).forEach(meeting => {
        const meetingDate = new Date(meeting.date);
        const meetingDateStr = format(meetingDate, "yyyy-MM-dd");
        if (meetingDateStr === selectedDateStr) {
          meetings.push({
            id: meeting.id,
            committeeId: c.id,
            committeeName: c.name,
            committeeIcon: c.icon,
            time: meeting.time,
            time_end: meeting.time_end,
            institution: meeting.institution,
            link: meeting.link,
          });
        }
      });
    });

    return meetings;
  }, [committees, profiles, user, profile, date]);

  // Entries for the selected date by current user
  const dayEntries = useMemo(() => {
    if (!collaboratorName) return [];
    return entries.filter(e => e.date === date && e.collaboratorName === collaboratorName);
  }, [entries, date, collaboratorName]);

  // Compute day_of_week (1=Mon..5=Fri) from selected date
  const selectedDayOfWeek = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    const day = d.getDay(); // 0=Sun
    return day === 0 ? 7 : day; // 1=Mon..7=Sun
  }, [date]);

  // Fetch todos for the selected date's day
  const fetchDayTodos = useCallback(async () => {
    if (!user || selectedDayOfWeek > 5) { setDayTodos([]); return; }
    const selectedDate = new Date(date + "T00:00:00");
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekStartStr = format(monday, "yyyy-MM-dd");
    const { data } = await supabase
      .from("weekly_todos")
      .select("id, title, completed")
      .eq("user_id", user.id)
      .eq("week_start", weekStartStr)
      .eq("day_of_week", selectedDayOfWeek)
      .order("sort_order");
    if (data) setDayTodos(data as unknown as DayTodo[]);
    else setDayTodos([]);
  }, [user, date, selectedDayOfWeek, todoRefreshKey]);

  useEffect(() => { fetchDayTodos(); }, [fetchDayTodos]);

  // Fetch operational meetings
  useEffect(() => {
    const loadOpMeetings = async () => {
      const { data } = await supabase.from("operational_meetings").select("*");
      if (data) setOpMeetings(data);
    };
    loadOpMeetings();
  }, []);

  // Operational meetings for selected date (recurring weekly on fixed day)
  const opMeetingsForDate = useMemo(() => {
    if (!user) return [];
    const userId = user.id;
    const selectedDate = new Date(date + "T00:00:00");
    const dayOfWeek = selectedDate.getDay(); // 0=Sun, 1=Mon...

    return opMeetings
      .filter(m => m.day_of_week === dayOfWeek && ((m.participant_ids || []).includes(userId) || (m.animator_ids || []).includes(userId)))
      .map(m => ({
        id: `op-${m.id}`,
        meetingId: m.id,
        committeeName: m.title,
        committeeIcon: "📋",
        committeeId: `op-meeting-${m.id}`,
        time: m.time_start ? `${m.time_start}${m.time_end ? ` - ${m.time_end}` : ""}` : undefined,
        connectionLink: m.connection_link || undefined,
      }));
  }, [opMeetings, user, date]);

  const selectableItems = useMemo(() => {
    const normalizedName = collaboratorName.toLowerCase().trim();
    if (!normalizedName) return [];

    const projectItems = projects
      .filter(p => {
        const leads = Array.isArray(p.projectLead) ? p.projectLead : (p.projectLead ? [p.projectLead] : []);
        if (leads.some(l => l.toLowerCase().trim() === normalizedName)) return true;
        return p.collaborators.some(c => c.name?.toLowerCase().trim() === normalizedName);
      })
      .map(p => ({
        id: p.id,
        name: p.name,
        color: p.color || "hsl(var(--primary))",
        type: "project" as const,
      }));

    const committeeItems = committees
      .filter(c => {
        if (c.responsible?.toLowerCase().trim() === normalizedName) return true;
        return c.members?.some(m => m.name?.toLowerCase().trim() === normalizedName);
      })
      .map(c => ({
        id: c.id,
        name: c.name,
        color: "hsl(var(--accent))",
        type: "committee" as const,
      }));

    return [...projectItems, ...committeeItems];
  }, [projects, committees, collaboratorName]);

  useEffect(() => {
    const checkExemption = async () => {
      if (!user) { setExemptLoading(false); return; }
      const { data } = await supabase
        .from("time_entry_exemptions" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsExempt(!!data);
      setExemptLoading(false);
    };
    checkExemption();
  }, [user]);

  const timeCheck = canEnterTimeForDate(date, is247, organization.fridayDeadlineEnabled ?? false);
  const blocked = !isExempt && !timeCheck.allowed;

  const submitSlot = async (slot: TimeSlot, label: string) => {
    if ((!slot.projectId && !slot.taskId) || !collaboratorName || !date || !slot.startTime || !slot.endTime) {
      toast({ title: "Erreur", description: `Veuillez sélectionner une activité pour ${label}.`, variant: "destructive" });
      return false;
    }
    if (slot.projectId === REUNION_ID && !slot.meetingName?.trim()) {
      toast({ title: "Erreur", description: `Veuillez saisir le nom de la réunion pour ${label}.`, variant: "destructive" });
      return false;
    }
    if (!slot.comment?.trim()) {
      toast({ title: "Erreur", description: `Le commentaire est obligatoire pour ${label}.`, variant: "destructive" });
      return false;
    }
    if (slot.startTime >= slot.endTime) {
      toast({ title: "Erreur", description: `L'heure de fin doit être après l'heure de début (${label}).`, variant: "destructive" });
      return false;
    }
    if (blocked) {
      toast({ title: "Saisie bloquée", description: timeCheck.reason, variant: "destructive" });
      return false;
    }

    const matchedTodo = dayTodos.find(t => t.id === slot.taskId);
    const isReunion = slot.projectId === REUNION_ID;
    const commentText = isReunion
      ? `[Réunion: ${slot.meetingName?.trim()}] ${slot.comment}`
      : slot.comment;

    const result = await addEntry({
      projectId: isReunion ? REUNION_ID : slot.projectId,
      taskId: slot.taskId || undefined,
      taskTitle: isReunion ? `Réunion: ${slot.meetingName?.trim()}` : (matchedTodo?.title || undefined),
      collaboratorName,
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      comment: commentText || undefined,
    }, user!.id);

    if (!result.success) {
      toast({ title: "Erreur", description: result.error || `Impossible d'enregistrer ${label}.`, variant: "destructive" });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    const allMeetings = [...committeeMeetingsForDate, ...opMeetingsForDate];
    for (const meeting of allMeetings) {
      const att = meetingAttendance[meeting.id];
      if (!att || !att.attended) {
        toast({ title: "Erreur", description: `Veuillez indiquer si vous avez assisté à la réunion "${meeting.committeeName}".`, variant: "destructive" });
        return;
      }
      if (att.attended === "non" && !att.reason?.trim()) {
        toast({ title: "Erreur", description: `Veuillez expliquer pourquoi vous n'avez pas assisté à la réunion "${meeting.committeeName}".`, variant: "destructive" });
        return;
      }
    }

    let submitted = 0;
    const completedTodoIds: string[] = [];
    const allSlots = [
      ...slots.filter(s => s.projectId || s.taskId).map((s, i) => ({ slot: s, label: `créneau #${i + 1}` })),
    ];

    for (const meeting of allMeetings) {
      const att = meetingAttendance[meeting.id];
      const attended = att?.attended === "oui";
      const isOp = meeting.id.startsWith("op-");
      const prefix = isOp ? "Réunion op." : "Comité";
      const commentText = attended
        ? `[${prefix}: ${meeting.committeeName}] Présent${meeting.time ? ` ${meeting.time}${(meeting as any).time_end ? `-${(meeting as any).time_end}` : ""}` : ""}${(meeting as any).institution ? ` — ${(meeting as any).institution}` : ""}`
        : `[${prefix}: ${meeting.committeeName}] Absent — Raison : ${att?.reason?.trim()}`;

      const meetingEndTime = (meeting as any).time_end || (meeting.time ? (() => {
        const [h, m] = meeting.time.split(":").map(Number);
        return `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      })() : "10:00");

      const result = await addEntry({
        projectId: meeting.committeeId,
        collaboratorName,
        date,
        startTime: meeting.time || "09:00",
        endTime: meetingEndTime,
        comment: commentText,
      }, user!.id);

      if (!result.success) {
        toast({ title: "Erreur", description: result.error || `Impossible d'enregistrer la réunion "${meeting.committeeName}".`, variant: "destructive" });
        return;
      }

      submitted++;
    }

    if (allSlots.length === 0 && allMeetings.length === 0) {
      toast({ title: "Erreur", description: "Veuillez sélectionner au moins un projet.", variant: "destructive" });
      return;
    }

    for (const { slot, label } of allSlots) {
      if (!await submitSlot(slot, label)) return;
      submitted++;
      if (slot.taskId) completedTodoIds.push(slot.taskId);
    }

    if (completedTodoIds.length > 0) {
      setDayTodos(prev => prev.map(t => completedTodoIds.includes(t.id) ? { ...t, completed: true } : t));
      onTodoCompleted?.();
    }

    toast({ title: "Temps enregistré ✓", description: `${submitted} créneau(x) enregistré(s) pour le ${format(new Date(date), "dd/MM/yyyy")}` });
    setSlots([createSlot("08:00", "18:30")]);
    setMeetingAttendance({});
  };

  const updateSlot = (
    setSlots: React.Dispatch<React.SetStateAction<TimeSlot[]>>,
    index: number,
    field: keyof TimeSlot,
    value: string
  ) => {
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const addSlot = (setSlots: React.Dispatch<React.SetStateAction<TimeSlot[]>>, defaultStart: string, defaultEnd: string) => {
    setSlots(prev => [...prev, createSlot(defaultStart, defaultEnd)]);
  };

  const removeSlot = (setSlots: React.Dispatch<React.SetStateAction<TimeSlot[]>>, index: number) => {
    setSlots(prev => prev.filter((_, i) => i !== index));
  };

  // Unified select: projects + committees + day todos in one dropdown
  const renderActivitySelect = (projectId: string, taskId: string, onChangeProject: (v: string) => void, onChangeTask: (v: string) => void) => {
    const currentValue = taskId ? `todo::${taskId}` : projectId || "";
    const handleChange = (v: string) => {
      if (v.startsWith("todo::")) {
        const todoId = v.replace("todo::", "");
        onChangeTask(todoId);
        onChangeProject("");
      } else {
        onChangeProject(v);
        onChangeTask("");
      }
    };
    return (
      <Select value={currentValue} onValueChange={handleChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner une activité..." /></SelectTrigger>
        <SelectContent>
          {/* Réunion - always available */}
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Général</div>
          <SelectItem value={REUNION_ID}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0 bg-amber-500" />
              <span>Réunion</span>
            </div>
          </SelectItem>
          {/* Projects */}
          {selectableItems.filter(i => i.type === "project").length > 0 && (
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Projets</div>
          )}
          {selectableItems.filter(i => i.type === "project").map(item => (
            <SelectItem key={item.id} value={item.id}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.name}</span>
              </div>
            </SelectItem>
          ))}
          {/* Committees */}
          {selectableItems.filter(i => i.type === "committee").length > 0 && (
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Comités</div>
          )}
          {selectableItems.filter(i => i.type === "committee").map(item => (
            <SelectItem key={item.id} value={item.id}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.name}</span>
              </div>
            </SelectItem>
          ))}
          {/* Day todos - only show uncompleted ones */}
          {dayTodos.filter(t => !t.completed).length > 0 && (
            <>
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                <ListChecks className="w-3 h-3 inline mr-1" />Tâches du jour
              </div>
                {dayTodos.filter(t => !t.completed).map(todo => (
                  <SelectItem key={`todo::${todo.id}`} value={`todo::${todo.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0 bg-accent" />
                      <span>{todo.title}</span>
                    </div>
                  </SelectItem>
                ))}
            </>
          )}
        </SelectContent>
      </Select>
    );
  };

  const renderTimeSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        {VALID_TIMES.map(t => (
          <SelectItem key={t} value={t}>{t}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const renderSlotGroup = (
    label: string,
    icon: React.ReactNode,
    slots: TimeSlot[],
    setSlots: React.Dispatch<React.SetStateAction<TimeSlot[]>>,
    defaultStart: string,
    defaultEnd: string,
    bgClass: string,
  ) => (
    <div className={`rounded-xl border border-border/40 bg-card p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-lg ${bgClass} flex items-center justify-center`}>
            {icon}
          </div>
          <span className="text-xs font-display font-semibold text-foreground">{label}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] gap-1 text-primary"
          onClick={() => addSlot(setSlots, defaultStart, defaultEnd)}
        >
          <Plus className="w-3 h-3" /> Ajouter
        </Button>
      </div>
      {slots.map((slot, idx) => (
        <div key={idx} className="space-y-2">
          <div className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-[10px]">Activité</Label>
              {renderActivitySelect(
                slot.projectId,
                slot.taskId,
                v => updateSlot(setSlots, idx, "projectId", v),
                v => updateSlot(setSlots, idx, "taskId", v)
              )}
            </div>
            <div className="space-y-1">
              {slot.projectId === REUNION_ID ? (
                <>
                  <Label className="text-[10px]">Nom de la réunion <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Nom de la réunion..."
                    value={slot.meetingName}
                    onChange={e => updateSlot(setSlots, idx, "meetingName", e.target.value)}
                    className="text-xs h-8 bg-muted/20 border-border/30"
                  />
                </>
              ) : (
                <>
                  <Label className="text-[10px]">Commentaire <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Commentaire obligatoire..."
                    value={slot.comment}
                    onChange={e => updateSlot(setSlots, idx, "comment", e.target.value)}
                    className="text-xs h-8 bg-muted/20 border-border/30"
                  />
                </>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Début</Label>
              {renderTimeSelect(slot.startTime, v => updateSlot(setSlots, idx, "startTime", v))}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Fin</Label>
              {renderTimeSelect(slot.endTime, v => updateSlot(setSlots, idx, "endTime", v))}
            </div>
            {slots.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive"
                onClick={() => removeSlot(setSlots, idx)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          {/* Comment field for meetings (shown below the meeting name) */}
          {slot.projectId === REUNION_ID && (
            <div className="pl-0 space-y-1">
              <Label className="text-[10px]">Commentaire <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Commentaire obligatoire..."
                value={slot.comment}
                onChange={e => updateSlot(setSlots, idx, "comment", e.target.value)}
                className="text-xs h-8 bg-muted/20 border-border/30"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Collapsible defaultOpen>
    <Card className="shadow-[var(--shadow-card)] border-0">
      <CardHeader className="pb-3">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              Saisie du temps quotidien
            </CardTitle>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
          </button>
        </CollapsibleTrigger>
      </CardHeader>
      <CollapsibleContent>
      <CardContent className="space-y-4">
        {/* Rules */}
        <div className="bg-muted/30 rounded-xl p-3 space-y-1 border border-border/30">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Règles de saisie</p>
          <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
            <li>Saisie au jour le jour, avant 18h30 (jours ouvrés uniquement)</li>
            <li>Horaires autorisés : 08h00 — 18h30</li>
            <li>Clôture hebdomadaire : vendredi à 16h</li>
          </ul>
          {isExempt && (
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-3 h-3 text-primary" />
              <span className="text-[10px] text-primary font-medium">Profil exempté des contraintes horaires</span>
            </div>
          )}
        </div>

        {blocked && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-[11px] text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{timeCheck.reason}</span>
          </div>
        )}

        {/* Collaborator + Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px]">Collaborateur</Label>
            <Input value={collaboratorName} readOnly className="text-xs h-8 bg-muted/30 border-border/30" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-xs h-8" />
          </div>
        </div>

        {selectableItems.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-2">Aucun projet ou comité ne vous est attribué.</p>
        )}

        {/* Committee + Operational meetings auto-entries */}
        {(committeeMeetingsForDate.length > 0 || opMeetingsForDate.length > 0) && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-accent-foreground" />
              </div>
              <span className="text-xs font-display font-semibold text-foreground">Réunions planifiées</span>
              <Lock className="w-3 h-3 text-muted-foreground" />
            </div>
            {[...committeeMeetingsForDate, ...opMeetingsForDate].map(meeting => {
              const att = meetingAttendance[meeting.id] || { attended: "", reason: "" };
              const isOp = meeting.id.startsWith("op-");
              return (
                <div key={meeting.id} className="rounded-lg border border-border/40 bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{meeting.committeeIcon}</span>
                      <div>
                        <span className="text-xs font-semibold text-foreground">{meeting.committeeName}</span>
                        {meeting.time && <span className="text-[10px] text-muted-foreground ml-2">{meeting.time}{(meeting as any).time_end ? ` - ${(meeting as any).time_end}` : ""}</span>}
                        {(meeting as any).connectionLink && (
                          <a href={(meeting as any).connectionLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline ml-2">
                            🔗 Rejoindre
                          </a>
                        )}
                        {!isOp && (meeting as any).institution && (
                          <Badge variant="secondary" className="text-[9px] ml-2">🏦 {(meeting as any).institution}</Badge>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] gap-1">
                      <Lock className="w-2.5 h-2.5" /> {isOp ? "Réunion op." : "Comité"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-[10px] whitespace-nowrap">Avez-vous assisté à cette réunion ? <span className="text-destructive">*</span></Label>
                    <Select
                      value={att.attended}
                      onValueChange={v => setMeetingAttendance(prev => ({
                        ...prev,
                        [meeting.id]: { ...prev[meeting.id], attended: v, reason: v === "oui" ? "" : (prev[meeting.id]?.reason || "") }
                      }))}
                    >
                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oui">✅ Oui</SelectItem>
                        <SelectItem value="non">❌ Non</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {att.attended === "non" && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-destructive">Raison de l'absence <span className="text-destructive">*</span></Label>
                      <Textarea
                        placeholder="Expliquez pourquoi vous n'avez pas assisté à cette réunion..."
                        value={att.reason}
                        onChange={e => setMeetingAttendance(prev => ({
                          ...prev,
                          [meeting.id]: { ...prev[meeting.id], reason: e.target.value }
                        }))}
                        className="text-xs min-h-[60px] border-destructive/30"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Time slots */}
        {renderSlotGroup(
          "Créneaux",
          <Clock className="w-3.5 h-3.5 text-primary" />,
          slots,
          setSlots,
          "08:00", "18:30",
          "bg-primary/10"
        )}

        <Button size="sm" className="text-xs gap-1.5 w-full rounded-xl h-9" onClick={handleSubmit} disabled={blocked}>
          <Send className="w-3.5 h-3.5" /> Enregistrer mon temps
        </Button>

      </CardContent>
      </CollapsibleContent>
    </Card>
    </Collapsible>
  );
};

export default TimeEntryForm;
