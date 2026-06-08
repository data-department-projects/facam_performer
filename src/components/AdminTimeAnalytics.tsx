import { useState, useEffect, useMemo } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DollarSign, Clock, Users, TrendingUp, BarChart3, Calendar, Eye, AlertTriangle, ShieldCheck, Plus, Trash2, UserX, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, isWeekend, startOfYear, endOfYear, eachDayOfInterval, getDay, getMonth, isSameYear, getWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { useProfiles } from "@/hooks/useProfiles";

interface ExemptionRow {
  id: string;
  user_id: string;
  reason: string;
}

const AdminTimeAnalytics = () => {
  const { projects } = useProjects();
  const { entries, getEntriesByProject, getTotalHoursByProject, getCostByProject, getAvgDurationByProject } = useTimeTracking();
  const { user } = useAuth();
  const [hourlyRate, setHourlyRate] = useState(45);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // Profiles & exemptions
  const allProfiles = useProfiles();
  const profiles = useMemo(() => allProfiles.map(p => ({ user_id: p.user_id, full_name: p.full_name, email: p.email })), [allProfiles]);
  const [exemptions, setExemptions] = useState<ExemptionRow[]>([]);
  const [exemptDialogOpen, setExemptDialogOpen] = useState(false);
  const [newExemptUserId, setNewExemptUserId] = useState("");
  const [newExemptReason, setNewExemptReason] = useState("");

  useEffect(() => {
    const fetchExemptions = async () => {
      const { data } = await supabase.from("time_entry_exemptions" as unknown as never).select("id, user_id, reason");
      if (data) setExemptions(data as unknown as ExemptionRow[]);
    };
    fetchExemptions();
  }, []);

  // === KPIs ===
  const totalHoursAll = entries.reduce((s, e) => s + e.hoursWorked, 0);
  const totalCostAll = totalHoursAll * hourlyRate;
  const uniqueCollaborators = new Set(entries.map(e => e.collaboratorName)).size;
  const uniqueDays = new Set(entries.map(e => e.date)).size;

  const projectStats = projects.map(p => {
    const totalHours = getTotalHoursByProject(p.id);
    const cost = getCostByProject(p.id, hourlyRate);
    const avgDuration = getAvgDurationByProject(p.id);
    const projectEntries = getEntriesByProject(p.id);
    const uniqueWorkers = new Set(projectEntries.map(e => e.collaboratorName)).size;
    const uniqueWorkDays = new Set(projectEntries.map(e => e.date)).size;
    return { project: p, totalHours, cost, avgDuration, uniqueWorkers, uniqueWorkDays, entries: projectEntries };
  });

  const filteredEntries = selectedProjectId === "all" ? entries : entries.filter(e => e.projectId === selectedProjectId);

  const collaboratorStats = Object.values(
    filteredEntries.reduce<Record<string, { name: string; totalHours: number; days: Set<string>; entries: number }>>((acc, e) => {
      if (!acc[e.collaboratorName]) acc[e.collaboratorName] = { name: e.collaboratorName, totalHours: 0, days: new Set(), entries: 0 };
      acc[e.collaboratorName].totalHours += e.hoursWorked;
      acc[e.collaboratorName].days.add(e.date);
      acc[e.collaboratorName].entries += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.totalHours - a.totalHours);

  // === Week navigation for missing entries ===
  const [selectedWeekMonday, setSelectedWeekMonday] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const currentWeekDays = useMemo(() => {
    const days: string[] = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const d = addDays(selectedWeekMonday, i);
      // For past/current weeks, show all 5 days; for future weeks beyond today, cap at today
      if (d <= today) {
        days.push(format(d, "yyyy-MM-dd"));
      }
    }
    return days;
  }, [selectedWeekMonday]);

  const selectedWeekNumber = getWeek(selectedWeekMonday, { weekStartsOn: 1 });
  const selectedWeekYear = selectedWeekMonday.getFullYear();
  const isCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime() === selectedWeekMonday.getTime();

  // Names of profiles that have skip_personal_planning enabled (e.g. DG)
  const skipPlanningNames = useMemo(() => {
    return new Set(allProfiles.filter(p => (p as unknown as { skip_personal_planning?: boolean }).skip_personal_planning).map(p => p.full_name));
  }, [allProfiles]);

  const allCollaboratorNames = useMemo(() => {
    const names = new Set<string>();
    projects.forEach(p => {
      if (Array.isArray(p.projectLead)) p.projectLead.forEach(l => { if (l) names.add(l); }); else if (p.projectLead) names.add(p.projectLead);
      p.collaborators.forEach(c => { if (c.name) names.add(c.name); });
    });
    profiles.forEach(p => { if (p.full_name) names.add(p.full_name); });
    // Exclude users with skip_personal_planning (DG)
    skipPlanningNames.forEach(n => names.delete(n));
    return Array.from(names).sort();
  }, [projects, profiles, skipPlanningNames]);

  const missingEntries = useMemo(() => {
    const missing: { name: string; missingDays: string[] }[] = [];
    allCollaboratorNames.forEach(name => {
      const entryDates = new Set(entries.filter(e => e.collaboratorName === name).map(e => e.date));
      const missingDays = currentWeekDays.filter(d => !entryDates.has(d));
      if (missingDays.length > 0) {
        missing.push({ name, missingDays });
      }
    });
    return missing;
  }, [allCollaboratorNames, entries, currentWeekDays]);

  // === Exemption management ===
  const addExemption = async () => {
    if (!newExemptUserId || !user) return;
    const { error } = await supabase.from("time_entry_exemptions" as unknown as never).insert({
      user_id: newExemptUserId,
      reason: newExemptReason,
      granted_by: user.id,
    });
    if (!error) {
      const { data } = await supabase.from("time_entry_exemptions" as unknown as never).select("id, user_id, reason");
      if (data) setExemptions(data as unknown as ExemptionRow[]);
      setNewExemptUserId("");
      setNewExemptReason("");
    }
  };

  const removeExemption = async (id: string) => {
    await supabase.from("time_entry_exemptions" as unknown as never).delete().eq("id", id);
    setExemptions(prev => prev.filter(e => e.id !== id));
  };

  const getProfileName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || userId;
  const exemptUserIds = new Set(exemptions.map(e => e.user_id));
  const nonExemptProfiles = profiles.filter(p => !exemptUserIds.has(p.user_id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setExemptDialogOpen(true)}>
            <ShieldCheck className="w-3.5 h-3.5" /> Exemptions
          </Button>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground">Taux horaire (€)</Label>
            <Input type="number" value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value))} className="w-20 h-8 text-sm" />
          </div>
        </div>
      </div>

      {/* Missing time entries alert */}
      {(missingEntries.length > 0 || !isCurrentWeek) && (
        <Card className="shadow-card border-destructive/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-display flex items-center gap-2 text-destructive">
                <UserX className="w-4 h-4" />
                Saisies manquantes — Semaine {selectedWeekNumber} ({selectedWeekYear})
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedWeekMonday(m => addWeeks(m, -1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant={isCurrentWeek ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 text-[10px] px-2"
                  onClick={() => setSelectedWeekMonday(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                >
                  Aujourd'hui
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedWeekMonday(m => addWeeks(m, 1))} disabled={isCurrentWeek}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {format(selectedWeekMonday, "d MMM", { locale: fr })} — {format(addDays(selectedWeekMonday, 4), "d MMM yyyy", { locale: fr })}
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Collaborateur</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Jours manquants</TableHead>
                  <TableHead className="text-[10px] text-right">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missingEntries.map(m => (
                  <TableRow key={m.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center text-[10px] font-semibold text-destructive">
                          {m.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="text-xs font-medium">{m.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.missingDays.map(d => (
                          <Badge key={d} variant="destructive" className="text-[9px]">
                            {format(new Date(d + "T00:00:00"), "EEE dd/MM", { locale: fr })}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-[9px] text-destructive border-destructive/30">
                        <AlertTriangle className="w-2.5 h-2.5 mr-1" /> Non saisi
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}


      {/* Yearly Calendar Heatmap */}
      {(() => {
        const yearStart = startOfYear(new Date(calendarYear, 0, 1));
        const yearEnd = endOfYear(yearStart);
        const allDays = eachDayOfInterval({ start: yearStart, end: yearEnd });
        
        // Build hours map for the year
        const hoursMap: Record<string, number> = {};
        entries.forEach(e => {
          if (e.date && e.date.startsWith(String(calendarYear))) {
            hoursMap[e.date] = (hoursMap[e.date] || 0) + e.hoursWorked;
          }
        });

        const maxHours = Math.max(1, ...Object.values(hoursMap));

        const getColor = (hours: number) => {
          if (hours === 0) return "bg-muted";
          const intensity = hours / maxHours;
          if (intensity < 0.25) return "bg-primary/20";
          if (intensity < 0.5) return "bg-primary/40";
          if (intensity < 0.75) return "bg-primary/60";
          return "bg-primary";
        };

        // Group by week columns
        const weeks: Date[][] = [];
        let currentWeek: Date[] = [];
        allDays.forEach((day, i) => {
          const dow = getDay(day); // 0=Sun
          if (i === 0) {
            // Pad initial week
            for (let p = 0; p < dow; p++) currentWeek.push(null as unknown as Date);
          }
          currentWeek.push(day);
          if (dow === 6 || i === allDays.length - 1) {
            weeks.push(currentWeek);
            currentWeek = [];
          }
        });

        const monthLabels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
        const dayLabels = ["", "Lun", "", "Mer", "", "Ven", ""];

        return (
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  Calendrier annuel des saisies
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalendarYear(y => y - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-display font-bold w-12 text-center">{calendarYear}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalendarYear(y => y + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TooltipProvider delayDuration={100}>
                <div className="overflow-x-auto">
                  {/* Month labels */}
                  <div className="flex ml-8 mb-1">
                    {(() => {
                      const labels: { month: number; col: number }[] = [];
                      weeks.forEach((week, wi) => {
                        const validDay = week.find(d => d != null);
                        if (validDay && (wi === 0 || getMonth(validDay) !== getMonth(weeks[wi - 1]?.find(d => d != null) || validDay))) {
                          labels.push({ month: getMonth(validDay), col: wi });
                        }
                      });
                      return labels.map(({ month, col }, i) => {
                        const nextCol = labels[i + 1]?.col || weeks.length;
                        const width = (nextCol - col) * 14;
                        return (
                          <span key={month} className="text-[9px] text-muted-foreground" style={{ width: `${width}px`, flexShrink: 0 }}>
                            {monthLabels[month]}
                          </span>
                        );
                      });
                    })()}
                  </div>
                  <div className="flex gap-0">
                    {/* Day labels */}
                    <div className="flex flex-col gap-[2px] mr-1 pt-0">
                      {dayLabels.map((label, i) => (
                        <div key={i} className="h-[12px] flex items-center">
                          <span className="text-[8px] text-muted-foreground w-6 text-right">{label}</span>
                        </div>
                      ))}
                    </div>
                    {/* Weeks grid */}
                    {weeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-[2px]">
                        {Array.from({ length: 7 }).map((_, di) => {
                          const day = week[di];
                          if (!day) return <div key={di} className="w-[12px] h-[12px]" />;
                          const dateStr = format(day, "yyyy-MM-dd");
                          const hours = hoursMap[dateStr] || 0;
                          const isWe = isWeekend(day);
                          return (
                            <Tooltip key={di}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`w-[12px] h-[12px] rounded-[2px] cursor-pointer transition-colors ${isWe && hours === 0 ? "bg-muted/50" : getColor(hours)}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <p className="font-medium">{format(day, "EEEE d MMMM yyyy", { locale: fr })}</p>
                                <p className="text-muted-foreground">{hours > 0 ? `${hours.toFixed(1)}h travaillées` : "Aucune saisie"}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-2 mt-3 ml-8">
                    <span className="text-[9px] text-muted-foreground">Moins</span>
                    <div className="w-[12px] h-[12px] rounded-[2px] bg-muted" />
                    <div className="w-[12px] h-[12px] rounded-[2px] bg-primary/20" />
                    <div className="w-[12px] h-[12px] rounded-[2px] bg-primary/40" />
                    <div className="w-[12px] h-[12px] rounded-[2px] bg-primary/60" />
                    <div className="w-[12px] h-[12px] rounded-[2px] bg-primary" />
                    <span className="text-[9px] text-muted-foreground">Plus</span>
                    <span className="text-[9px] text-muted-foreground ml-4">
                      Total {calendarYear}: {Object.values(hoursMap).reduce((a, b) => a + b, 0).toFixed(1)}h
                    </span>
                  </div>
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>
        );
      })()}


      {/* Detail: per collaborator */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Détail par collaborateur
            </CardTitle>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="h-8 w-52 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les projets</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Collaborateur</TableHead>
                <TableHead className="text-[10px] text-right">Saisies</TableHead>
                <TableHead className="text-[10px] text-right">Jours</TableHead>
                <TableHead className="text-[10px] text-right">Heures totales</TableHead>
                <TableHead className="text-[10px] text-right">Moy./jour</TableHead>
                <TableHead className="text-[10px] text-right">Coût</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collaboratorStats.map(c => (
                <TableRow key={c.name}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                        {c.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <span className="text-xs font-medium">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs">{c.entries}</TableCell>
                  <TableCell className="text-right text-xs">{c.days.size}</TableCell>
                  <TableCell className="text-right text-xs font-medium">{c.totalHours.toFixed(1)}h</TableCell>
                  <TableCell className="text-right text-xs">{(c.totalHours / c.days.size).toFixed(1)}h</TableCell>
                  <TableCell className="text-right text-xs font-bold">{(c.totalHours * hourlyRate).toLocaleString("fr-FR")}€</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Raw entries */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display">Journal des saisies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Date</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Projet</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Collaborateur</TableHead>
                  <TableHead className="text-[10px] text-right">Début</TableHead>
                  <TableHead className="text-[10px] text-right">Fin</TableHead>
                  <TableHead className="text-[10px] text-right">Heures</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.sort((a, b) => b.date.localeCompare(a.date)).map(e => {
                  const proj = projects.find(p => p.id === e.projectId);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{e.date}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {proj && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: proj.color }} />}
                          <span className="text-xs">{proj?.name || e.projectId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{e.collaboratorName}</TableCell>
                      <TableCell className="text-right text-xs">{e.startTime}</TableCell>
                      <TableCell className="text-right text-xs">{e.endTime}</TableCell>
                      <TableCell className="text-right text-xs font-medium">{e.hoursWorked.toFixed(1)}h</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Exemption management dialog */}
      <Dialog open={exemptDialogOpen} onOpenChange={setExemptDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4" /> Gestion des exemptions horaires
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Les profils exemptés peuvent saisir leur temps sans contrainte de date/heure.</p>

          {/* Current exemptions */}
          {exemptions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Profils exemptés</Label>
              {exemptions.map(ex => (
                <div key={ex.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-xs font-medium">{getProfileName(ex.user_id)}</span>
                    {ex.reason && <span className="text-[10px] text-muted-foreground ml-2">— {ex.reason}</span>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeExemption(ex.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add exemption */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Ajouter une exemption</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={newExemptUserId} onValueChange={setNewExemptUserId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Collaborateur..." /></SelectTrigger>
                <SelectContent>
                  {nonExemptProfiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={newExemptReason} onChange={e => setNewExemptReason(e.target.value)} placeholder="Raison (optionnel)" className="h-8 text-xs" />
            </div>
            <Button size="sm" className="text-xs gap-1" onClick={addExemption} disabled={!newExemptUserId}>
              <Plus className="w-3 h-3" /> Ajouter l'exemption
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTimeAnalytics;
