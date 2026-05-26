import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, ChevronLeft, ChevronRight, Save, CalendarDays } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0]; // Mon=1..Sat=6, Sun=0

interface TeamSchedule {
  id?: string;
  manager_id: string;
  week_start: string;
  team_name: string;
  work_days: number[];
  notes: string;
}

const getWeekStart = (date: Date): string => {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, "yyyy-MM-dd");
};

const ProductionTeamSchedule = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date());
  const [schedules, setSchedules] = useState<TeamSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  const weekStart = getWeekStart(selectedWeekDate);
  const mondayDate = startOfWeek(selectedWeekDate, { weekStartsOn: 1 });

  const fetchSchedules = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("team_work_schedules")
      .select("*")
      .eq("manager_id", user.id)
      .eq("week_start", weekStart);

    if (!error && data) {
      setSchedules(data.map((d: any) => ({
        id: d.id,
        manager_id: d.manager_id,
        week_start: d.week_start,
        team_name: d.team_name,
        work_days: d.work_days || [],
        notes: d.notes || "",
      })));
    }
    setLoading(false);
  }, [user, weekStart]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const toggleDay = (teamIdx: number, dayValue: number) => {
    setSchedules(prev => {
      const updated = [...prev];
      const team = { ...updated[teamIdx] };
      if (team.work_days.includes(dayValue)) {
        team.work_days = team.work_days.filter(d => d !== dayValue);
      } else {
        team.work_days = [...team.work_days, dayValue];
      }
      updated[teamIdx] = team;
      return updated;
    });
  };

  const addTeam = () => {
    if (!newTeamName.trim() || !user) return;
    if (schedules.some(s => s.team_name.toLowerCase() === newTeamName.trim().toLowerCase())) {
      toast({ title: "Équipe déjà existante", variant: "destructive" });
      return;
    }
    setSchedules(prev => [...prev, {
      manager_id: user.id,
      week_start: weekStart,
      team_name: newTeamName.trim(),
      work_days: [1, 2, 3, 4, 5], // Default Mon-Fri
      notes: "",
    }]);
    setNewTeamName("");
  };

  const removeTeam = async (idx: number) => {
    const team = schedules[idx];
    if (team.id) {
      await supabase.from("team_work_schedules").delete().eq("id", team.id);
    }
    setSchedules(prev => prev.filter((_, i) => i !== idx));
    toast({ title: "Équipe supprimée" });
  };

  const saveAll = async () => {
    if (!user) return;
    setSaving(true);
    try {
      for (const schedule of schedules) {
        if (schedule.id) {
          await supabase.from("team_work_schedules")
            .update({ work_days: schedule.work_days, notes: schedule.notes, updated_at: new Date().toISOString() } as any)
            .eq("id", schedule.id);
        } else {
          const { data } = await supabase.from("team_work_schedules")
            .insert({
              manager_id: user.id,
              week_start: weekStart,
              team_name: schedule.team_name,
              work_days: schedule.work_days,
              notes: schedule.notes,
            } as any)
            .select()
            .single();
          if (data) schedule.id = (data as any).id;
        }
      }
      toast({ title: "Planning des équipes sauvegardé ✓" });
      fetchSchedules();
    } catch {
      toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" });
    }
    setSaving(false);
  };

  const updateNotes = (idx: number, notes: string) => {
    setSchedules(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], notes };
      return updated;
    });
  };

  return (
    <Card className="border-border bg-card shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="w-5 h-5 text-primary" />
            Planning des équipes — Production
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedWeekDate(subWeeks(selectedWeekDate, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground min-w-[180px] text-center">
              {format(mondayDate, "dd MMM", { locale: fr })} — {format(addDays(mondayDate, 6), "dd MMM yyyy", { locale: fr })}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedWeekDate(addWeeks(selectedWeekDate, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add team */}
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Nom de l'équipe (ex: Équipe A, Équipe Nuit...)"
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTeam()}
            className="h-8 text-sm flex-1"
          />
          <Button size="sm" variant="outline" onClick={addTeam} disabled={!newTeamName.trim()}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune équipe planifiée pour cette semaine. Ajoutez une équipe ci-dessus.
          </p>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule, idx) => (
              <div key={schedule.id || idx} className="border border-border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {schedule.team_name}
                  </span>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {schedule.work_days.length}j / 7
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeTeam(idx)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                
                {/* Day selector grid */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAY_LABELS.map((label, dayIdx) => {
                    const dayValue = DAY_VALUES[dayIdx];
                    const isActive = schedule.work_days.includes(dayValue);
                    const dayDate = addDays(mondayDate, dayIdx);
                    return (
                      <button
                        key={dayValue}
                        onClick={() => toggleDay(idx, dayValue)}
                        className={cn(
                          "flex flex-col items-center rounded-md py-2 px-1 text-xs transition-all border",
                          isActive
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50"
                        )}
                      >
                        <span className="font-semibold">{label}</span>
                        <span className="text-[10px] opacity-80">{format(dayDate, "dd/MM")}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Notes */}
                <Input
                  placeholder="Notes (optionnel)..."
                  value={schedule.notes}
                  onChange={e => updateNotes(idx, e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            ))}
          </div>
        )}

        {schedules.length > 0 && (
          <div className="flex justify-end">
            <Button size="sm" onClick={saveAll} disabled={saving}>
              <Save className="w-3.5 h-3.5 mr-1" />
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductionTeamSchedule;
