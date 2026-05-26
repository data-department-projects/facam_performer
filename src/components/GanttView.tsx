import { useMemo, useState } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { CheckCircle2, Clock, AlertCircle, Link2, User, CalendarDays, FolderKanban, AlertTriangle, XCircle } from "lucide-react";
import { format, parseISO, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import DataToolbar from "@/components/DataToolbar";

const MONTHS = [
  { key: "2026-01", label: "Jan 2026", start: "2026-01-01", end: "2026-01-31" },
  { key: "2026-02", label: "Fév 2026", start: "2026-02-01", end: "2026-02-28" },
  { key: "2026-03", label: "Mar 2026", start: "2026-03-01", end: "2026-03-31" },
  { key: "2026-04", label: "Avr 2026", start: "2026-04-01", end: "2026-04-30" },
  { key: "2026-05", label: "Mai 2026", start: "2026-05-01", end: "2026-05-31" },
  { key: "2026-06", label: "Juin 2026", start: "2026-06-01", end: "2026-06-30" },
  { key: "2026-07", label: "Juil 2026", start: "2026-07-01", end: "2026-07-31" },
  { key: "2026-08", label: "Août 2026", start: "2026-08-01", end: "2026-08-31" },
  { key: "2026-09", label: "Sep 2026", start: "2026-09-01", end: "2026-09-30" },
  { key: "2026-10", label: "Oct 2026", start: "2026-10-01", end: "2026-10-31" },
  { key: "2026-11", label: "Nov 2026", start: "2026-11-01", end: "2026-11-30" },
  { key: "2026-12", label: "Déc 2026", start: "2026-12-01", end: "2026-12-31" },
  { key: "2027-01", label: "Jan 2027", start: "2027-01-01", end: "2027-01-31" },
  { key: "2027-02", label: "Fév 2027", start: "2027-02-01", end: "2027-02-28" },
  { key: "2027-03", label: "Mar 2027", start: "2027-03-01", end: "2027-03-31" },
  { key: "2027-04", label: "Avr 2027", start: "2027-04-01", end: "2027-04-30" },
  { key: "2027-05", label: "Mai 2027", start: "2027-05-01", end: "2027-05-31" },
  { key: "2027-06", label: "Juin 2027", start: "2027-06-01", end: "2027-06-30" },
  { key: "2027-07", label: "Juil 2027", start: "2027-07-01", end: "2027-07-31" },
  { key: "2027-08", label: "Août 2027", start: "2027-08-01", end: "2027-08-31" },
  { key: "2027-09", label: "Sep 2027", start: "2027-09-01", end: "2027-09-30" },
  { key: "2027-10", label: "Oct 2027", start: "2027-10-01", end: "2027-10-31" },
  { key: "2027-11", label: "Nov 2027", start: "2027-11-01", end: "2027-11-30" },
  { key: "2027-12", label: "Déc 2027", start: "2027-12-01", end: "2027-12-31" },
];

// Map quarter strings to month ranges for milestone placement
const quarterToMonths: Record<string, string[]> = {
  "Q1 2026": ["2026-01", "2026-02", "2026-03"],
  "Q2 2026": ["2026-04", "2026-05", "2026-06"],
  "Q3 2026": ["2026-07", "2026-08", "2026-09"],
  "Q4 2026": ["2026-10", "2026-11", "2026-12"],
  "Q1 2027": ["2027-01", "2027-02", "2027-03"],
  "Q2 2027": ["2027-04", "2027-05", "2027-06"],
  "Q3 2027": ["2027-07", "2027-08", "2027-09"],
  "Q4 2027": ["2027-10", "2027-11", "2027-12"],
};

const statusIcon = {
  done: <CheckCircle2 className="w-3 h-3" />,
  "in-progress": <Clock className="w-3 h-3" />,
  planned: <AlertCircle className="w-3 h-3" />,
};

const statusLabel: Record<string, string> = {
  done: "Terminé",
  "in-progress": "En cours",
  planned: "Planifié",
};

const statusClass: Record<string, string> = {
  done: "bg-accent/15 text-accent",
  "in-progress": "bg-secondary/30 text-secondary-foreground",
  planned: "bg-muted text-muted-foreground",
};

type MilestoneEntry = {
  id: string;
  title: string;
  status: "done" | "in-progress" | "planned";
  deadline?: string;
  deliverables?: { id: string; submittedBy: string; link: string; submittedAt: string }[];
};

interface GanttRow {
  projectId: string;
  projectName: string;
  projectColor: string;
  collaboratorName: string;
  missionTitle: string;
  missionId: string;
  milestonesByMonth: { month: typeof MONTHS[0]; milestones: MilestoneEntry[] }[];
}

function getMilestoneMonth(m: MilestoneEntry, quarter: string): string {
  // If milestone has a deadline, use that month
  if (m.deadline) {
    try {
      const d = parseISO(m.deadline);
      const key = format(d, "yyyy-MM");
      return key;
    } catch { /* fall through */ }
  }
  // Otherwise place in the first month of the quarter
  const months = quarterToMonths[quarter];
  return months ? months[0] : "2026-01";
}

const GanttView = ({ onNavigateToProject }: { onNavigateToProject?: (projectId: string) => void }) => {
  const { projects } = useProjects();
  const { departments } = useDepartments();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const rows: GanttRow[] = useMemo(() => {
    const result: GanttRow[] = [];
    for (const proj of projects) {
      for (const collab of proj.collaborators || []) {
        for (const mission of collab.missions || []) {
          // Build month map
          const monthMap = new Map<string, MilestoneEntry[]>();
          MONTHS.forEach(m => monthMap.set(m.key, []));

          for (const ms of mission.milestones || []) {
            const monthKey = getMilestoneMonth(ms, ms.quarter);
            if (monthMap.has(monthKey)) {
              monthMap.get(monthKey)!.push(ms);
            } else {
              // Fallback: find closest month
              const fallbackMonths = quarterToMonths[ms.quarter];
              if (fallbackMonths && fallbackMonths.length > 0 && monthMap.has(fallbackMonths[0])) {
                monthMap.get(fallbackMonths[0])!.push(ms);
              }
            }
          }

          result.push({
            projectId: proj.id,
            projectName: proj.name,
            projectColor: proj.color,
            collaboratorName: collab.name,
            missionTitle: mission.title || "Mission sans titre",
            missionId: mission.id,
            milestonesByMonth: MONTHS.map(m => ({
              month: m,
              milestones: monthMap.get(m.key) || [],
            })),
          });
        }
      }
    }
    return result;
  }, [projects]);

  const groupedByProject = useMemo(() => {
    const map = new Map<string, GanttRow[]>();
    for (const row of rows) {
      if (!map.has(row.projectId)) map.set(row.projectId, []);
      map.get(row.projectId)!.push(row);
    }
    return Array.from(map.entries());
  }, [rows]);

  const formatDeadline = (d: string) => {
    try {
      return format(parseISO(d), "dd MMM yyyy", { locale: fr });
    } catch {
      return d;
    }
  };

  // Compute overdue milestones report
  const overdueItems = useMemo(() => {
    const now = new Date();
    const items: {
      projectName: string;
      projectColor: string;
      projectLead: string;
      collaboratorName: string;
      missionTitle: string;
      milestoneTitle: string;
      deadline: string;
      daysOverdue: number;
      hasDeliverables: boolean;
      status: string;
    }[] = [];

    for (const proj of projects) {
      const leadStr = Array.isArray(proj.projectLead) ? proj.projectLead.join(", ") : proj.projectLead;
      for (const collab of proj.collaborators || []) {
        for (const mission of collab.missions || []) {
          for (const ms of mission.milestones || []) {
            if (!ms.deadline) continue;
            const deadlineDate = parseISO(ms.deadline);
            if (deadlineDate >= now) continue; // not yet overdue
            if (ms.status === "done") continue; // completed, skip
            const daysOverdue = Math.floor((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
            items.push({
              projectName: proj.name,
              projectColor: proj.color,
              projectLead: leadStr,
              collaboratorName: collab.name,
              missionTitle: mission.title || "Mission sans titre",
              milestoneTitle: ms.title,
              deadline: ms.deadline,
              daysOverdue,
              hasDeliverables: (ms.deliverables || []).length > 0,
              status: ms.status,
            });
          }
        }
      }
    }

    return items.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [projects]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <DataToolbar moduleType="gantt" />
      </div>

      {/* ═══ RAPPORT LIVRABLES NON RESPECTÉS ═══ */}
      {overdueItems.length > 0 && (
        <div className="bg-card rounded-2xl border-2 border-destructive/30 shadow-card overflow-hidden">
          <div className="bg-destructive/10 px-4 py-3 flex items-center gap-2 border-b border-destructive/20">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="font-display font-bold text-sm text-destructive">
              Rapport des livrables non respectés ({overdueItems.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Projet</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responsable projet</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Collaborateur</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mission</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Jalon</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Deadline</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Retard</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Livrable</th>
                </tr>
              </thead>
              <tbody>
                {overdueItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-border last:border-b-0 hover:bg-destructive/5 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.projectColor }} />
                        <span className="text-xs font-medium">{item.projectName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{item.projectLead || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs">{item.collaboratorName}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">{item.missionTitle}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-medium">{item.milestoneTitle}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3 text-destructive" />
                        <span className="text-xs font-semibold text-destructive">{formatDeadline(item.deadline)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                        {item.daysOverdue}j de retard
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {item.hasDeliverables ? (
                        <span className="text-xs text-accent flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> Déposé
                        </span>
                      ) : (
                        <span className="text-xs text-destructive flex items-center gap-1 font-semibold">
                          <XCircle className="w-3 h-3" /> Non déposé
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucune mission définie. Ajoutez des collaborateurs avec des missions dans vos projets.</p>
        </div>
      )}

      {groupedByProject.map(([projectId, projectRows]) => {
        const proj = projects.find(p => p.id === projectId);
        if (!proj) return null;
        return (
          <div key={projectId} className="bg-card rounded-2xl border border-border shadow-card overflow-x-auto">
            {/* Project header */}
            <div
              className="flex items-center gap-3 p-3 border-b border-border cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => onNavigateToProject?.(projectId)}
            >
              <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
              <div>
                <span className="text-sm font-display font-bold hover:underline">{proj.name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  👤 {Array.isArray(proj.projectLead) ? proj.projectLead.join(", ") : proj.projectLead}
                </span>
              </div>
            </div>

            {/* Column headers — months grouped by year */}
            <div className="grid min-w-[2800px]" style={{ gridTemplateColumns: "180px 140px repeat(24, 1fr)" }}>
              <div className="p-2 border-b border-r border-border bg-muted/30">
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Mission</span>
              </div>
              <div className="p-2 border-b border-r border-border bg-muted/30">
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Responsable</span>
              </div>
              {MONTHS.map(m => (
                <div key={m.key} className="p-1.5 border-b border-r border-border last:border-r-0 bg-muted/30 text-center">
                  <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">{m.label}</span>
                </div>
              ))}
            </div>

            {/* Mission rows */}
            {projectRows.map((row) => (
              <div key={`${row.missionId}-${row.collaboratorName}`} className="grid min-w-[2800px]" style={{ gridTemplateColumns: "180px 140px repeat(24, 1fr)" }}>
                <div className="p-2 border-b border-r border-border bg-muted/5">
                  <div className="flex items-center gap-1">
                    <FolderKanban className="w-3 h-3 text-muted-foreground shrink-0" />
                    <p className="text-[11px] font-medium truncate">{row.missionTitle}</p>
                  </div>
                </div>
                <div className="p-2 border-b border-r border-border bg-muted/5">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-muted-foreground shrink-0" />
                    <p className="text-[11px] text-muted-foreground truncate">{row.collaboratorName}</p>
                  </div>
                </div>
                {row.milestonesByMonth.map(({ month, milestones: ms }) => (
                  <div key={month.key} className="border-b border-r border-border last:border-r-0 p-0.5">
                    {ms.length === 0 ? null : (
                      <div className="space-y-0.5">
                        {ms.map(milestone => {
                          const itemId = `${row.missionId}-${milestone.id}`;
                          const isHovered = hoveredItem === itemId;
                          return (
                            <div
                              key={milestone.id}
                              className="rounded p-1 transition-all cursor-default relative"
                              style={{
                                backgroundColor: row.projectColor.replace(")", " / 0.15)").replace("hsl(", "hsl("),
                                borderLeft: `2px solid ${row.projectColor}`,
                              }}
                              onMouseEnter={() => setHoveredItem(itemId)}
                              onMouseLeave={() => setHoveredItem(null)}
                            >
                              <div className="flex items-start gap-0.5">
                                <span className={
                                  milestone.status === "done" ? "text-accent" :
                                  milestone.status === "in-progress" ? "text-secondary-foreground" : "text-muted-foreground"
                                }>
                                  {statusIcon[milestone.status]}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[9px] font-medium leading-tight truncate">{milestone.title}</p>
                                  {milestone.deadline && (
                                    <div className="flex items-center gap-0.5 mt-0.5">
                                      <CalendarDays className="w-2 h-2 text-primary" />
                                      <span className="text-[8px] font-semibold text-primary">{formatDeadline(milestone.deadline)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {isHovered && (
                                <div className="absolute z-10 left-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-elevated p-3 w-64">
                                  <p className="text-xs font-display font-bold">{milestone.title}</p>
                                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                                    <User className="w-3 h-3" />
                                    <span>{row.collaboratorName}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                                    <FolderKanban className="w-3 h-3" />
                                    <span>{row.missionTitle}</span>
                                  </div>
                                  {milestone.deadline && (
                                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
                                      <CalendarDays className="w-3 h-3 text-primary" />
                                      <span className="font-semibold text-primary">{formatDeadline(milestone.deadline)}</span>
                                    </div>
                                  )}
                                  {(milestone.deliverables || []).length > 0 && (
                                    <div className="mt-1.5 space-y-1">
                                      <span className="text-[10px] font-semibold text-muted-foreground">Livrables :</span>
                                      {(milestone.deliverables || []).map(d => (
                                        <div key={d.id} className="flex items-center gap-1 text-[10px]">
                                          <Link2 className="w-2.5 h-2.5 text-accent" />
                                          <span>{d.submittedBy}</span>
                                          <a href={d.link} target="_blank" rel="noopener noreferrer" className="text-accent underline truncate">{d.link.substring(0, 30)}...</a>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="mt-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusClass[milestone.status]}`}>
                                      {statusLabel[milestone.status]}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}

      {/* Legend */}
      {rows.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-3 flex items-center gap-6 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Légende :</span>
          <div className="flex items-center gap-1.5 text-accent">
            <CheckCircle2 className="w-3 h-3" />
            <span className="text-[11px]">Terminé</span>
          </div>
          <div className="flex items-center gap-1.5 text-secondary-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-[11px]">En cours</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <AlertCircle className="w-3 h-3" />
            <span className="text-[11px]">Planifié</span>
          </div>
          <div className="flex items-center gap-1.5 text-primary">
            <CalendarDays className="w-3 h-3" />
            <span className="text-[11px]">Deadline</span>
          </div>
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            {projects.filter(p => (p.collaborators || []).some(c => (c.missions || []).length > 0)).map(p => (
              <div key={p.id} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: p.color }} />
                <span className="text-[10px] text-muted-foreground">{p.name.substring(0, 20)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GanttView;
