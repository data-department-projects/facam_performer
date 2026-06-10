import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles } from "@/hooks/useProfiles";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Download, UserCheck, Clock, Filter, AlertTriangle, Info, Link2, Link2Off } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import type { DateRange } from "react-day-picker";

type PeriodMode = "range" | "month";

interface BadgeEntry {
  id: string;
  user_id: string;
  badge_date: string;
  swipe_1: string | null;
  swipe_2: string | null;
  swipe_3: string | null;
  swipe_4: string | null;
}

const SWIPE_LABELS_OUVRIER = ["Arrivée", "Sortie pause", "Reprise", "Fin de journée"];
const SWIPE_LABELS_CADRE = ["Arrivée", "Fin de journée"];
const SWIPE_FIELDS_OUVRIER = ["swipe_1", "swipe_2", "swipe_3", "swipe_4"] as const;
const SWIPE_FIELDS_CADRE = ["swipe_1", "swipe_4"] as const;

const getSwipeConfig = (category: string) => {
  const isCadre = (category || "cadre") === "cadre";
  return {
    labels: isCadre ? SWIPE_LABELS_CADRE : SWIPE_LABELS_OUVRIER,
    fields: isCadre ? SWIPE_FIELDS_CADRE : SWIPE_FIELDS_OUVRIER,
    max: isCadre ? 2 : 4,
  };
};

const BadgeManagement = () => {
  const profiles = useProfiles();
  const { departments } = useDepartments();
  const [entries, setEntries] = useState<BadgeEntry[]>([]);
  const [timeEntries, setTimeEntries] = useState<Array<{ id: string; user_id: string; data: unknown }>>([]);
  const [weekPlannerLink, setWeekPlannerLink] = useState(false);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("range");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  });
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [alertsOpen, setAlertsOpen] = useState(true);

  const effectiveRange = useMemo(() => {
    if (periodMode === "range" && dateRange?.from) {
      return { start: dateRange.from, end: dateRange.to || dateRange.from };
    } else {
      return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
    }
  }, [periodMode, dateRange, selectedMonth]);

  // Days per category: Cadres Mon-Sat, Ouvriers Mon-Sun (handled in getWeekDaysForCategory)

  // Helper: check if profile is in Production or Maintenance dept
  const isProductionOrMaintenance = useCallback((departmentId: string | null | undefined) => {
    if (!departmentId) return false;
    const dept = departments.find((d) => d.id === departmentId);
    return dept && ["production", "maintenance"].some(name => dept.name?.toLowerCase().includes(name));
  }, [departments]);

  // Both tabs include all days; weekend filtering per profile happens at render
  const getWeekDaysForCategory = useCallback((_isCadre: boolean) => {
    return eachDayOfInterval({ start: effectiveRange.start, end: effectiveRange.end });
  }, [effectiveRange]);

  const loadEntries = useCallback(async () => {
    const startStr = format(effectiveRange.start, "yyyy-MM-dd");
    const endStr = format(effectiveRange.end, "yyyy-MM-dd");
    const badgeRes = await supabase.from("badge_entries").select("*").gte("badge_date", startStr).lte("badge_date", endStr);
    if (badgeRes.data) setEntries(badgeRes.data as unknown as BadgeEntry[]);
    if (weekPlannerLink) {
      const timeRes = await supabase.from("app_time_entries").select("id, data, user_id");
      if (timeRes.data) setTimeEntries(timeRes.data);
    } else {
      setTimeEntries([]);
    }
  }, [effectiveRange, weekPlannerLink]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (departmentFilter !== "all" && p.department_id !== departmentFilter) return false;
      if (categoryFilter !== "all" && (p.category || "cadre") !== categoryFilter) return false;
      if (searchFilter && !p.full_name.toLowerCase().includes(searchFilter.toLowerCase())) return false;
      return true;
    });
  }, [profiles, departmentFilter, categoryFilter, searchFilter]);

  const getEntry = (userId: string, date: string) => {
    return entries.find((e) => e.user_id === userId && e.badge_date === date);
  };

  const handleSwipe = async (userId: string, date: string, category: string) => {
    const existing = getEntry(userId, date);
    const now = format(new Date(), "HH:mm:ss");
    const { fields, max } = getSwipeConfig(category);
    if (existing) {
      const nextEmpty = fields.find((f) => !(existing as unknown as Record<string, unknown>)[f]);
      if (!nextEmpty) {
        toast({ title: "Maximum atteint", description: `Ce collaborateur a déjà badgé ${max} fois aujourd'hui.`, variant: "destructive" });
        return;
      }
      const { error } = await supabase
        .from("badge_entries")
        .update({ [nextEmpty]: now, updated_at: new Date().toISOString() } as unknown as Record<string, unknown>)
        .eq("id", existing.id);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase
        .from("badge_entries")
        .insert({ user_id: userId, badge_date: date, swipe_1: now } as unknown as Record<string, unknown>);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    }
    await loadEntries();
  };


  const handleManualEdit = async (entryId: string, field: string, value: string) => {
    const timeVal = value || null;
    const { error } = await supabase
      .from("badge_entries")
      .update({ [field]: timeVal, updated_at: new Date().toISOString() } as unknown as Record<string, unknown>)
      .eq("id", entryId);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    await loadEntries();
  };

  const handleCreateAndEdit = async (userId: string, date: string, field: string, value: string) => {
    const timeVal = value || null;
    const { error } = await supabase
      .from("badge_entries")
      .insert({ user_id: userId, badge_date: date, [field]: timeVal } as unknown as Record<string, unknown>);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    await loadEntries();
  };

  const getSwipeCount = (entry: BadgeEntry | undefined, category: string) => {
    if (!entry) return 0;
    const { fields } = getSwipeConfig(category);
    return fields.filter((f) => (entry as unknown as Record<string, unknown>)[f]).length;
  };

  const getMaxSwipes = (category: string) => getSwipeConfig(category).max;

  const formatTime = (t: string | null) => (t ? t.substring(0, 5) : "—");

  const getDeptName = useCallback((deptId: string | null) => {
    if (!deptId) return "—";
    const dept = departments.find((d) => d.id === deptId);
    return dept?.name || deptId;
  }, [departments]);

  const computeWorkedHours = (entry: BadgeEntry | undefined, category: string) => {
    if (!entry || !entry.swipe_1) return null;
    const parseTime = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const isCadre = (category || "cadre") === "cadre";
    let total = 0;
    if (isCadre) {
      // Cadre: Arrivée (swipe_1) → Fin (swipe_4)
      if (entry.swipe_1 && entry.swipe_4) {
        total = parseTime(entry.swipe_4) - parseTime(entry.swipe_1);
      } else {
        return null;
      }
    } else {
      // Ouvrier: morning + afternoon
      if (entry.swipe_1 && entry.swipe_2) {
        total += parseTime(entry.swipe_2) - parseTime(entry.swipe_1);
      } else if (entry.swipe_1 && !entry.swipe_2) {
        return null;
      }
      if (entry.swipe_3 && entry.swipe_4) {
        total += parseTime(entry.swipe_4) - parseTime(entry.swipe_3);
      }
    }
    if (total <= 0) return null;
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return `${hours}h${mins.toString().padStart(2, "0")}`;
  };

  const handleExportXlsx = () => {
    const rows: Record<string, unknown>[] = [];
    // Export all days: cadres Mon-Sat, ouvriers Mon-Sun
    const allDays = eachDayOfInterval({ start: effectiveRange.start, end: effectiveRange.end });
    for (const day of allDays) {
      const dateStr = format(day, "yyyy-MM-dd");
      for (const p of filteredProfiles) {
        const isCadre = (p.category || "cadre") === "cadre";
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        // Skip weekends unless profile is in Production/Maintenance (both cadres & ouvriers)
        if (isWeekend && !isProductionOrMaintenance(p.department_id)) continue;
        const entry = getEntry(p.user_id, dateStr);
        rows.push({
          Date: format(day, "dd/MM/yyyy"),
          Collaborateur: p.full_name,
          Catégorie: isCadre ? "Cadre" : "Ouvrier",
          Département: getDeptName(p.department_id),
          Arrivée: formatTime(entry?.swipe_1 ?? null),
          "Sortie pause": formatTime(entry?.swipe_2 ?? null),
          Reprise: formatTime(entry?.swipe_3 ?? null),
          "Fin de journée": formatTime(entry?.swipe_4 ?? null),
          "Heures travaillées": entry ? (computeWorkedHours(entry, p.category) || "—") : "—",
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Badges");
    XLSX.writeFile(wb, `badges_${format(effectiveRange.start, "yyyy-MM-dd")}.xlsx`);
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // KPIs for today
  const todayEntries = entries.filter((e) => e.badge_date === todayStr);
  const presentToday = todayEntries.filter((e) => e.swipe_1).length;
  const completedToday = todayEntries.filter((e) => e.swipe_4).length;

  // Alerts: cross-check badge arrival vs time entries (only when weekPlannerLink active)
  interface TimeAlert {
    userId: string;
    fullName: string;
    department: string;
    date: string;
    badgeArrival: string;
    entryStart: string;
    entryActivity: string;
  }

  const alerts = useMemo<TimeAlert[]>(() => {
    if (!weekPlannerLink) return [];
    const result: TimeAlert[] = [];
    const startStr = format(effectiveRange.start, "yyyy-MM-dd");
    const endStr = format(effectiveRange.end, "yyyy-MM-dd");
    const cadreProfiles = profiles.filter(p => (p.category || "cadre") === "cadre");
    for (const p of cadreProfiles) {
      const userBadges = entries.filter(e => e.user_id === p.user_id);
      const userTimeEntries = timeEntries.filter(te => te.user_id === p.user_id);
      for (const badge of userBadges) {
        if (!badge.swipe_1) continue;
        const badgeDate = badge.badge_date;
        if (badgeDate < startStr || badgeDate > endStr) continue;
        const badgeArrivalStr = badge.swipe_1.substring(0, 5);
        const [bh, bm] = badgeArrivalStr.split(":").map(Number);
        const badgeMinutes = bh * 60 + bm;
        const dayTimeEntries = userTimeEntries.filter(te => {
          const data = te.data as unknown as { date?: string; startTime?: string };
          return data?.date === badgeDate;
        });
        for (const te of dayTimeEntries) {
          const data = te.data as unknown as { date?: string; startTime?: string };
          if (!data?.startTime) continue;
          const [sh, sm] = data.startTime.split(":").map(Number);
          const startMinutes = sh * 60 + sm;
          if (startMinutes < badgeMinutes) {
            result.push({
              userId: p.user_id,
              fullName: p.full_name,
              department: getDeptName(p.department_id),
              date: badgeDate,
              badgeArrival: badgeArrivalStr,
              entryStart: data.startTime,
              entryActivity: data.taskTitle || data.comment?.split("]")?.[0]?.replace("[", "") || data.projectId || "Activité",
            });
          }
        }
      }
    }
    return result.sort((a, b) => b.date.localeCompare(a.date) || a.fullName.localeCompare(b.fullName));
  }, [entries, timeEntries, profiles, effectiveRange, getDeptName, weekPlannerLink]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* KPIs */}
      <div className={cn("grid grid-cols-1 gap-4", weekPlannerLink ? "md:grid-cols-4" : "md:grid-cols-3")}>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Présents aujourd'hui</p>
              <p className="text-2xl font-bold text-foreground">{presentToday}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Journée complète</p>
              <p className="text-2xl font-bold text-foreground">{completedToday}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <UserCheck className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Non badgés</p>
              <p className="text-2xl font-bold text-foreground">{Math.max(0, profiles.length - presentToday)}</p>
            </div>
          </CardContent>
        </Card>
        {weekPlannerLink && (
          <Card className={cn(alerts.length > 0 && "border-destructive/50 bg-destructive/5")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Alertes incohérence</p>
                <p className="text-2xl font-bold text-destructive">{alerts.length}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Alerts Section */}
      {weekPlannerLink && alerts.length > 0 && (
        <Card className="border-destructive/30">
          <Collapsible open={alertsOpen} onOpenChange={setAlertsOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-muted/40 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    Alertes d'incohérence Badge / Saisie de temps
                    <Badge variant="destructive" className="ml-2">{alerts.length}</Badge>
                  </CardTitle>
                  <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", alertsOpen ? "" : "-rotate-90")} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Collaborateurs ayant déclaré une activité avant leur heure de badge d'arrivée
                </p>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Collaborateur</TableHead>
                        <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Département</TableHead>
                        <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Date</TableHead>
                        <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase text-center">Badge arrivée</TableHead>
                        <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase text-center">Début activité</TableHead>
                        <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Activité</TableHead>
                        <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase text-center">Écart</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((alert, idx) => {
                        const [bh, bm] = alert.badgeArrival.split(":").map(Number);
                        const [sh, sm] = alert.entryStart.split(":").map(Number);
                        const diffMin = (bh * 60 + bm) - (sh * 60 + sm);
                        return (
                          <TableRow key={idx} className="bg-destructive/5">
                            <TableCell className="font-medium text-foreground">{alert.fullName}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{alert.department}</TableCell>
                            <TableCell className="text-xs">
                              {format(new Date(alert.date + "T00:00:00"), "EEEE dd MMM", { locale: fr })}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-mono">{alert.badgeArrival}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="destructive" className="font-mono">{alert.entryStart}</Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{alert.entryActivity}</TableCell>
                            <TableCell className="text-center">
                              <span className="text-xs font-semibold text-destructive">-{diffMin} min</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">Suivi des badges</CardTitle>
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border/50">
                <Switch
                  checked={weekPlannerLink}
                  onCheckedChange={setWeekPlannerLink}
                  className="data-[state=checked]:bg-primary"
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {weekPlannerLink ? <Link2 className="w-3 h-3 text-primary" /> : <Link2Off className="w-3 h-3" />}
                  Lien Week Planner
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Period mode selector */}
              <div className="flex rounded-lg border border-border/50 overflow-hidden">
                {(["range", "month"] as PeriodMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setPeriodMode(mode)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium transition-colors",
                      periodMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {mode === "range" ? "Période" : "Mois"}
                  </button>
                ))}
              </div>

              {periodMode === "range" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, "dd MMM", { locale: fr })} — {format(dateRange.to, "dd MMM yyyy", { locale: fr })}</>
                        ) : format(dateRange.from, "dd MMM yyyy", { locale: fr })
                      ) : "Choisir dates"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      locale={fr}
                      className="p-3"
                    />
                  </PopoverContent>
                </Popover>
              )}

              {periodMode === "month" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {format(selectedMonth, "MMMM yyyy", { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedMonth}
                      onSelect={(d) => { if (d) setSelectedMonth(d); }}
                      locale={fr}
                      className="p-3"
                    />
                  </PopoverContent>
                </Popover>
              )}

            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Input
              placeholder="Rechercher un collaborateur…"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-56"
            />
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Département" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les départements</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                <SelectItem value="cadre">Cadre</SelectItem>
                <SelectItem value="ouvrier">Ouvrier</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5 ml-auto" onClick={handleExportXlsx}>
              <Download className="w-3.5 h-3.5" /> Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="cadres" className="w-full">
            <div className="px-4 pt-3">
              <TabsList>
                <TabsTrigger value="cadres">Cadres</TabsTrigger>
                <TabsTrigger value="ouvriers">Ouvriers</TabsTrigger>
              </TabsList>
            </div>
            {["cadres", "ouvriers"].map((tab) => {
              const isCadreTab = tab === "cadres";
              const tabProfiles = filteredProfiles.filter((p) => ((p.category || "cadre") === "cadre") === isCadreTab);
              const headersForTab = isCadreTab
                ? ["Arrivée", "Fin de journée"]
                : ["Arrivée", "Sortie pause", "Reprise", "Fin de journée"];
              const fieldsForTab = isCadreTab
                ? (["swipe_1", "swipe_4"] as const)
                : (["swipe_1", "swipe_2", "swipe_3", "swipe_4"] as const);
              const maxSwipes = isCadreTab ? 2 : 4;

              return (
                <TabsContent key={tab} value={tab} className="mt-0">
                  {getWeekDaysForCategory(isCadreTab).map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const isToday = dateStr === todayStr;
                    const dayKey = `${tab}-${dateStr}`;
                    const isOpen = openDays[dayKey] ?? isToday;
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                    // On weekends, only show profiles from Production/Maintenance (cadres & ouvriers)
                    const dayProfiles = isWeekend
                      ? tabProfiles.filter((p) => isProductionOrMaintenance(p.department_id))
                      : tabProfiles;

                    if (isWeekend && dayProfiles.length === 0) return null;

                    // For cadres tab on weekends: check minimum 2 cadres badged per dept (Production/Maintenance)
                    let weekendCadreAlerts: { deptName: string; count: number }[] = [];
                    if (isWeekend && isCadreTab) {
                      const prodMaintDepts = departments.filter((d) => {
                        const n = (d.name || "").toLowerCase();
                        return n.includes("production") || n.includes("maintenance");
                      });
                      weekendCadreAlerts = prodMaintDepts.map((dept) => {
                        const deptCadres = dayProfiles.filter((p) => p.department_id === dept.id);
                        const badgedCount = deptCadres.filter((p) => {
                          const e = getEntry(p.user_id, dateStr);
                          return e && e.swipe_1;
                        }).length;
                        return { deptName: dept.name, count: badgedCount };
                      }).filter((a) => a.count < 1);
                    }

                    const dayEntryCount = dayProfiles.filter((p) => {
                      const e = getEntry(p.user_id, dateStr);
                      return e && e.swipe_1;
                    }).length;

                    return (
                      <Collapsible key={dayKey} open={isOpen} onOpenChange={(o) => setOpenDays((prev) => ({ ...prev, [dayKey]: o }))}>
                        <CollapsibleTrigger asChild>
                          <button className={cn(
                            "w-full px-4 py-2.5 font-semibold text-sm flex items-center justify-between border-b cursor-pointer hover:bg-muted/40 transition-colors",
                            isToday ? "bg-primary/5 text-primary" : "bg-muted/20 text-foreground"
                          )}>
                            <div className="flex items-center gap-2">
                              <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen ? "" : "-rotate-90")} />
                              <span className="capitalize">{format(day, "EEEE dd MMMM", { locale: fr })}</span>
                              {isToday && <Badge variant="secondary" className="text-[10px]">Aujourd'hui</Badge>}
                              {isWeekend && isCadreTab && <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">Optionnel (min. 1/dept)</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                              {weekendCadreAlerts.length > 0 && (
                                <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {weekendCadreAlerts.map(a => `${a.deptName}: ${a.count}/1`).join(", ")}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px]">{dayEntryCount}/{dayProfiles.length} présents</Badge>
                            </div>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-48 text-[10px] font-semibold text-muted-foreground uppercase">Collaborateur</TableHead>
                                  <TableHead className="w-24 text-[10px] font-semibold text-muted-foreground uppercase">N° Badge</TableHead>
                                  <TableHead className="w-36 text-[10px] font-semibold text-muted-foreground uppercase">Département</TableHead>
                                  {headersForTab.map((label) => (
                                    <TableHead key={label} className="w-28 text-center">{label}</TableHead>
                                  ))}
                                  <TableHead className="w-24 text-[10px] font-semibold text-muted-foreground uppercase text-center">Heures</TableHead>
                                  <TableHead className="w-20 text-[10px] font-semibold text-muted-foreground uppercase text-center">Badges</TableHead>
                                  {weekPlannerLink && isToday && <TableHead className="w-24 text-[10px] font-semibold text-muted-foreground uppercase text-center">Action</TableHead>}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {dayProfiles.map((p) => {
                                  const entry = getEntry(p.user_id, dateStr);
                                  const cat = p.category || "cadre";
                                  const swipeCount = getSwipeCount(entry, cat);
                                  const worked = entry ? computeWorkedHours(entry, cat) : null;
                                  return (
                                    <TableRow key={p.user_id}>
                                      <TableCell className="font-medium text-foreground">{p.full_name}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground font-mono">{p.badge_number || "—"}</TableCell>
                                      <TableCell className="text-muted-foreground text-xs">{getDeptName(p.department_id)}</TableCell>
                                      {fieldsForTab.map((field) => (
                                        <TableCell key={field} className="text-center">
                                          <Input
                                            type="time"
                                            className="w-24 mx-auto text-xs h-8"
                                            value={entry ? ((entry as unknown as Record<string, string | null>)[field]?.substring(0, 5) || "") : ""}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (entry) {
                                                handleManualEdit(entry.id, field, val);
                                              } else if (val) {
                                                handleCreateAndEdit(p.user_id, dateStr, field, val);
                                              }
                                            }}
                                          />
                                        </TableCell>
                                      ))}
                                      <TableCell className="text-center font-mono text-sm text-foreground">{worked || "—"}</TableCell>
                                      <TableCell className="text-center">
                                        <Badge variant={swipeCount >= maxSwipes ? "default" : swipeCount > 0 ? "secondary" : "outline"} className="text-[10px]">
                                          {swipeCount}/{maxSwipes}
                                        </Badge>
                                      </TableCell>
                                      {weekPlannerLink && isToday && (
                                        <TableCell className="text-center">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs h-7"
                                            disabled={swipeCount >= maxSwipes}
                                            onClick={() => handleSwipe(p.user_id, dateStr, cat)}
                                          >
                                            Badger
                                          </Button>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  );
                                })}
                                {tabProfiles.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={headersForTab.length + 4} className="text-center text-muted-foreground py-8">
                                      Aucun {isCadreTab ? "cadre" : "ouvrier"} trouvé
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default BadgeManagement;
