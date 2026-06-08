import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { Project } from "@/data/projects";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Users } from "lucide-react";

interface ProfileSalary {
  full_name: string;
  salary: number | null;
}

const MONTHLY_HOURS = 173.33; // Standard monthly working hours

const ProjectCostSection = ({ project }: { project: Project }) => {
  const { entries } = useTimeTracking();
  const [profiles, setProfiles] = useState<ProfileSalary[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("profiles").select("full_name, salary");
      if (data) setProfiles(data as ProfileSalary[]);
    };
    load();
  }, []);

  const projectEntries = useMemo(
    () => entries.filter(e => e.projectId === project.id),
    [entries, project.id]
  );

  const collaboratorCosts = useMemo(() => {
    const byCollab: Record<string, { hours: number; salary: number | null }> = {};
    for (const entry of projectEntries) {
      if (!byCollab[entry.collaboratorName]) {
        const profile = profiles.find(p => p.full_name === entry.collaboratorName);
        byCollab[entry.collaboratorName] = { hours: 0, salary: profile?.salary ?? null };
      }
      byCollab[entry.collaboratorName].hours += entry.hoursWorked;
    }
    return Object.entries(byCollab).map(([name, data]) => ({
      name,
      hours: data.hours,
      hourlyRate: data.salary ? data.salary / MONTHLY_HOURS : null,
      cost: data.salary ? (data.salary / MONTHLY_HOURS) * data.hours : null,
    }));
  }, [projectEntries, profiles]);

  const totalCost = useMemo(
    () => collaboratorCosts.reduce((sum, c) => sum + (c.cost ?? 0), 0),
    [collaboratorCosts]
  );

  const totalHours = useMemo(
    () => collaboratorCosts.reduce((sum, c) => sum + c.hours, 0),
    [collaboratorCosts]
  );

  const avgHourlyRate = totalHours > 0 ? totalCost / totalHours : 0;

  if (projectEntries.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-primary" />
        <h4 className="font-semibold text-sm">Coût du projet</h4>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-xs gap-1">
          Coût total : {Math.round(totalCost).toLocaleString("fr-FR")} Fr CFA
        </Badge>
        <Badge variant="outline" className="text-xs gap-1">
          {totalHours.toFixed(1)} heures
        </Badge>
        <Badge variant="outline" className="text-xs gap-1">
          Taux horaire moyen : {Math.round(avgHourlyRate).toLocaleString("fr-FR")} Fr CFA/h
        </Badge>
        <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" onClick={() => setDetailOpen(true)}>
          <Users className="w-3 h-3" /> Détail par collaborateur
        </Button>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4" /> Coût par collaborateur — {project.name}
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Collaborateur</TableHead>
                <TableHead className="text-[10px] text-right">Heures</TableHead>
                <TableHead className="text-[10px] text-right">Taux horaire</TableHead>
                <TableHead className="text-[10px] text-right">Coût</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collaboratorCosts.map(c => (
                <TableRow key={c.name}>
                  <TableCell className="text-xs">{c.name}</TableCell>
                  <TableCell className="text-xs text-right">{c.hours.toFixed(1)}h</TableCell>
                  <TableCell className="text-xs text-right">
                    {c.hourlyRate != null ? `${Math.round(c.hourlyRate).toLocaleString("fr-FR")} Fr CFA` : <span className="text-muted-foreground italic">Non défini</span>}
                  </TableCell>
                  <TableCell className="text-xs text-right font-medium">
                    {c.cost != null ? `${Math.round(c.cost).toLocaleString("fr-FR")} Fr CFA` : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {collaboratorCosts.length > 0 && (
                <TableRow className="font-semibold border-t-2">
                  <TableCell className="text-xs">Total</TableCell>
                  <TableCell className="text-xs text-right">{totalHours.toFixed(1)}h</TableCell>
<TableCell className="text-xs text-right">{Math.round(avgHourlyRate).toLocaleString("fr-FR")} Fr CFA</TableCell>
                  <TableCell className="text-xs text-right">{Math.round(totalCost).toLocaleString("fr-FR")} Fr CFA</TableCell>
                </TableRow>
              )}
              {collaboratorCosts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">Aucune saisie de temps</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectCostSection;
