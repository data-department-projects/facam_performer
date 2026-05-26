import { useState, useMemo, useEffect } from "react";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useCommittees } from "@/contexts/CommitteesContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Lock, Clock, Filter, CalendarIcon, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { DateRange } from "react-day-picker";

type PeriodMode = "range" | "month" | "year";

const TimeEntriesList = () => {
  const { entries, refreshEntries } = useTimeTracking();
  const { projects } = useProjects();
  const { committees } = useCommittees();
  const { user, profile, isAdmin } = useAuth();
  const collaboratorName = profile?.full_name || "";

  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [activityFilter, setActivityFilter] = useState<string>("all");

  // Range mode
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });

  // Month mode
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  // Year mode
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Compute effective date range
  const effectiveRange = useMemo(() => {
    if (periodMode === "range" && dateRange?.from) {
      return { start: dateRange.from, end: dateRange.to || dateRange.from };
    } else if (periodMode === "month") {
      return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
    } else {
      const yearDate = new Date(selectedYear, 0, 1);
      return { start: startOfYear(yearDate), end: endOfYear(yearDate) };
    }
  }, [periodMode, dateRange, selectedMonth, selectedYear]);

  useEffect(() => {
    if (user?.id) refreshEntries();
  }, [user?.id, refreshEntries]);

  // Filter entries by period
  const periodEntries = useMemo(() => {
    if (!user?.id) return [];
    return entries.filter(e => {
      const entryUserId = (e as any)._user_id;
      if (entryUserId ? entryUserId !== user.id : e.collaboratorName !== collaboratorName) return false;
      const d = new Date(e.date + "T00:00:00");
      if (periodMode === "range" && dateRange?.from && !dateRange?.to) {
        return isSameDay(d, dateRange.from!);
      }
      return isWithinInterval(d, { start: effectiveRange.start, end: effectiveRange.end });
    });
  }, [entries, user?.id, collaboratorName, periodMode, dateRange, effectiveRange]);

  // Activities present in the filtered period
  const periodActivities = useMemo(() => {
    const ids = new Set(periodEntries.map(e => e.projectId).filter(Boolean));
    const items: { id: string; name: string }[] = [];
    ids.forEach(id => {
      const p = projects.find(p => p.id === id);
      if (p) { items.push({ id: p.id, name: p.name }); return; }
      const c = committees.find(c => c.id === id);
      if (c) items.push({ id: c.id, name: c.name });
    });
    return items;
  }, [periodEntries, projects, committees]);

  // Apply activity filter
  const filteredEntries = useMemo(() => {
    let filtered = periodEntries;
    if (activityFilter !== "all") {
      filtered = filtered.filter(e => e.projectId === activityFilter);
    }
    filtered.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return a.startTime.localeCompare(b.startTime);
    });
    return filtered;
  }, [periodEntries, activityFilter]);

  const handlePeriodChange = (mode: PeriodMode) => {
    setPeriodMode(mode);
    setActivityFilter("all");
  };

  const totalHours = filteredEntries.reduce((s, e) => s + e.hoursWorked, 0);

  const handleDeleteEntry = async (entryId: string) => {
    const { error } = await supabase.from("app_time_entries").delete().eq("id", entryId);
    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer cette saisie.", variant: "destructive" });
    } else {
      toast({ title: "Saisie supprimée" });
      refreshEntries();
    }
  };

  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof filteredEntries> = {};
    filteredEntries.forEach(e => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredEntries]);

  const getItemName = (entry: typeof filteredEntries[0]) =>
    [...projects, ...committees].find(p => p.id === entry.projectId)?.name
    || entry.taskTitle
    || entry.projectId
    || "Tâche";

  const getPeriodLabel = () => {
    if (periodMode === "range") {
      if (dateRange?.from && dateRange?.to) return `${format(dateRange.from, "dd MMM", { locale: fr })} — ${format(dateRange.to, "dd MMM yyyy", { locale: fr })}`;
      if (dateRange?.from) return format(dateRange.from, "dd MMMM yyyy", { locale: fr });
      return "Sélectionnez une période";
    }
    if (periodMode === "month") return format(selectedMonth, "MMMM yyyy", { locale: fr });
    return String(selectedYear);
  };

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            Mes saisies
          </CardTitle>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            {totalHours.toFixed(1)}h
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Filter className="w-3 h-3 text-muted-foreground shrink-0" />

          {/* Period mode selector */}
          <div className="flex rounded-lg border border-border/50 overflow-hidden">
            {(["range", "month", "year"] as PeriodMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => handlePeriodChange(mode)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium transition-colors",
                  periodMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted/50"
                )}
              >
                {mode === "range" ? "Période" : mode === "month" ? "Mois" : "Année"}
              </button>
            ))}
          </div>

          {/* Date picker depending on mode */}
          {periodMode === "range" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1.5 px-2">
                  <CalendarIcon className="w-3 h-3" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "dd MMM", { locale: fr })} — {format(dateRange.to, "dd MMM yyyy", { locale: fr })}</>
                    ) : format(dateRange.from, "dd MMM yyyy", { locale: fr })
                  ) : "Choisir dates"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => { setDateRange(range); setActivityFilter("all"); }}
                  numberOfMonths={2}
                  locale={fr}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          )}

          {periodMode === "month" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1.5 px-2">
                  <CalendarIcon className="w-3 h-3" />
                  {format(selectedMonth, "MMMM yyyy", { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(d) => { if (d) { setSelectedMonth(d); setActivityFilter("all"); } }}
                  locale={fr}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          )}

          {periodMode === "year" && (
            <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(Number(v)); setActivityFilter("all"); }}>
              <SelectTrigger className="h-7 text-[10px] w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Activity filter */}
          <Select value={activityFilter} onValueChange={setActivityFilter}>
            <SelectTrigger className="h-7 text-[10px] flex-1 min-w-[120px] max-w-[200px]">
              <SelectValue placeholder="Toutes activités" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes activités ({periodActivities.length})</SelectItem>
              {periodActivities.map(item => (
                <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-2">
        {filteredEntries.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-4">
            Aucune saisie pour {getPeriodLabel()}.
          </p>
        ) : (
          <div className="space-y-3">
            {groupedByDate.map(([dateStr, dateEntries]) => {
              const dayTotal = dateEntries.reduce((s, e) => s + e.hoursWorked, 0);
              return (
                <div key={dateStr} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      {format(new Date(dateStr + "T00:00:00"), "EEEE dd MMM", { locale: fr })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-foreground">{dayTotal.toFixed(1)}h</span>
                      <Badge variant="outline" className="text-[8px] px-1 py-0 gap-0.5 border-border text-muted-foreground">
                        <Lock className="w-2 h-2" /> Validée
                      </Badge>
                    </div>
                  </div>
                  {dateEntries.map((entry, idx) => (
                    <div key={entry.id || idx} className="flex items-center gap-3 rounded-lg bg-muted/30 border border-border/30 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{getItemName(entry)}</p>
                        {entry.comment && <p className="text-[10px] text-muted-foreground truncate">{entry.comment}</p>}
                      </div>
                      <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {entry.startTime} — {entry.endTime}
                      </div>
                      <div className="text-xs font-semibold text-primary whitespace-nowrap">
                        {entry.hoursWorked.toFixed(1)}h
                      </div>
                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer cette saisie ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. La saisie de {getItemName(entry)} sera définitivement supprimée.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteEntry(entry.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TimeEntriesList;
