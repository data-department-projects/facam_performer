import { useState } from "react";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Department } from "@/data/departments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Users, Layers, CheckCircle2, Clock, AlertCircle, Pencil } from "lucide-react";
import DataToolbar from "@/components/DataToolbar";

interface Props {
  onEdit?: (dept: Department) => void;
}

const RoadmapByDepartment = ({ onEdit }: Props) => {
  const { departments } = useDepartments();
  const [selectedId, setSelectedId] = useState(departments[0]?.id);
  const dept = departments.find(d => d.id === selectedId) || departments[0];

  if (!dept) return null;

  const allMs = [...dept.milestones2026, ...dept.milestones2027];
  const doneCount = allMs.filter(m => m.status === "done").length;
  const pct = allMs.length > 0 ? Math.round((doneCount / allMs.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl">Roadmap par direction</h2>
          <p className="text-sm text-muted-foreground">Organisation actuelle vs cible 2027 et jalons</p>
        </div>
        <DataToolbar moduleType="roadmap" />
      </div>

      {/* Department selector */}
      <div className="flex gap-2 flex-wrap">
        {departments.map(d => (
          <button
            key={d.id}
            onClick={() => setSelectedId(d.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              d.id === selectedId
                ? "bg-primary text-primary-foreground border-primary shadow-elevated"
                : "bg-card text-foreground border-border shadow-card hover:shadow-elevated hover:-translate-y-0.5"
            }`}
          >
            <span className="text-lg">{d.icon}</span>
            <span className="hidden md:inline">{d.name.replace(/^Département\s+/, "")}</span>
          </button>
        ))}
      </div>

      {/* Department header */}
      <div className="bg-card rounded-2xl border border-border shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">{dept.icon}</div>
            <div>
              <h3 className="font-display font-bold text-lg">{dept.name}</h3>
              <p className="text-xs text-muted-foreground">{dept.head} · {dept.services.length} départements · {dept.compositionToday.length} membres</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-display font-bold">{pct}%</p>
              <p className="text-[10px] text-muted-foreground">{doneCount}/{allMs.length} jalons</p>
            </div>
            <Progress value={pct} className="w-24 h-2" />
            {onEdit && (
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => onEdit(dept)}>
                <Pencil className="w-3.5 h-3.5" /> Modifier
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="organisation" className="w-full">
          <TabsList className="bg-muted/50 p-1 rounded-lg">
            <TabsTrigger value="organisation" className="rounded-md text-xs font-medium">Organisation</TabsTrigger>
            <TabsTrigger value="roadmap-2026" className="rounded-md text-xs font-medium">Roadmap 2026</TabsTrigger>
            <TabsTrigger value="roadmap-2027" className="rounded-md text-xs font-medium">Roadmap 2027</TabsTrigger>
          </TabsList>

          {/* Organisation: Today vs Tomorrow side by side */}
          <TabsContent value="organisation" className="mt-5">
            <div className="grid md:grid-cols-2 gap-5">
              {/* Today */}
              <div className="rounded-xl border border-border p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                   <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">Aujourd'hui — {dept.name}</h4>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responsable</p>
                  <p className="text-sm font-medium">{dept.head} <span className="text-muted-foreground">— {dept.headRoleToday}</span></p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mission</p>
                  <p className="text-sm leading-relaxed">{dept.missionToday}</p>
                </div>
                {dept.services.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-muted-foreground" />
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Départements</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {dept.services.map((s, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{typeof s === "string" ? s : s.name}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Équipe ({dept.compositionToday.length})</p>
                  </div>
                  {dept.compositionToday.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                        {m.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.role}</p>
                        {(m.services || []).length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {m.services!.map((s, si) => (
                              <span key={si} className="text-[8px] px-1 py-0 rounded bg-accent/10 text-accent">{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tomorrow 2027 */}
              <div className="rounded-xl border-2 border-secondary/40 p-5 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/10 rounded-full -translate-y-8 translate-x-8" />
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-3 h-3 text-secondary" />
                  <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-secondary-foreground">2027 — {dept.nameTomorrow}</h4>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responsable</p>
                  <p className="text-sm font-medium">{dept.head} <span className="text-muted-foreground">— {dept.headRoleTomorrow}</span></p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mission</p>
                  <p className="text-sm leading-relaxed">{dept.missionTomorrow}</p>
                </div>
                {dept.services.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-muted-foreground" />
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Départements</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {dept.services.map((s, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/20 text-secondary-foreground">{typeof s === "string" ? s : s.name}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Équipe cible ({dept.compositionTomorrow.length})</p>
                  </div>
                  {dept.compositionTomorrow.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                        m.name === "À recruter" ? "bg-secondary/20 text-secondary-foreground border border-dashed border-secondary" : "bg-primary/10 text-primary"
                      }`}>
                        {m.name === "À recruter" ? "+" : m.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <p className={`text-xs font-medium ${m.name === "À recruter" ? "text-secondary-foreground italic" : ""}`}>{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.role}</p>
                        {(m.services || []).length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {m.services!.map((s, si) => (
                              <span key={si} className="text-[8px] px-1 py-0 rounded bg-accent/10 text-accent">{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Roadmap 2026 */}
          <TabsContent value="roadmap-2026" className="mt-5">
            <TimelineSection milestones={dept.milestones2026} year="2026" />
          </TabsContent>

          {/* Roadmap 2027 */}
          <TabsContent value="roadmap-2027" className="mt-5">
            <TimelineSection milestones={dept.milestones2027} year="2027" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const TimelineSection = ({ milestones, year }: { milestones: Department["milestones2026"]; year: string }) => {
  if (milestones.length === 0) return <p className="text-sm text-muted-foreground italic">Aucun jalon pour {year}</p>;

  const statusConfig = {
    done: { icon: <CheckCircle2 className="w-4 h-4" />, color: "text-accent", bg: "bg-accent/10", label: "Terminé" },
    "in-progress": { icon: <Clock className="w-4 h-4" />, color: "text-secondary-foreground", bg: "bg-secondary/20", label: "En cours" },
    planned: { icon: <AlertCircle className="w-4 h-4" />, color: "text-muted-foreground", bg: "bg-muted", label: "Planifié" },
  };

  return (
    <div className="space-y-3">
      {milestones.map((m, i) => {
        const cfg = statusConfig[m.status];
        return (
          <div key={i} className="flex gap-4 items-start">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center ${cfg.color}`}>
                {cfg.icon}
              </div>
              {i < milestones.length - 1 && <div className="w-px h-8 bg-border" />}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">{m.quarter} {year}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
              </div>
              <p className="text-sm font-display font-bold mt-0.5">{m.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RoadmapByDepartment;
