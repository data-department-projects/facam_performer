import { Department } from "@/data/departments";
import { ArrowRight } from "lucide-react";

interface MissionCompareProps {
  department: Department;
}

const MissionCompare = ({ department }: MissionCompareProps) => {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Aujourd'hui */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-muted-foreground" />
          <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">Aujourd'hui</h4>
        </div>
        <p className="text-sm leading-relaxed mb-4">{department.missionToday}</p>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Équipe ({department.compositionToday.length})</p>
          {department.compositionToday.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                {m.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <p className="text-xs font-medium">{m.name}</p>
                <p className="text-[10px] text-muted-foreground">{m.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Demain */}
      <div className="rounded-xl border-2 border-secondary bg-card p-5 shadow-card relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/10 rounded-full -translate-y-8 translate-x-8" />
        <div className="flex items-center gap-2 mb-3">
          <ArrowRight className="w-3 h-3 text-secondary" />
          <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-secondary-foreground">Demain</h4>
        </div>
        <p className="text-sm leading-relaxed mb-4">{department.missionTomorrow}</p>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Équipe cible ({department.compositionTomorrow.length})</p>
          {department.compositionTomorrow.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                m.name === "À recruter" ? "bg-secondary/20 text-secondary-foreground border border-dashed border-secondary" : "bg-primary/10 text-primary"
              }`}>
                {m.name === "À recruter" ? "+" : m.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <p className={`text-xs font-medium ${m.name === "À recruter" ? "text-secondary-foreground italic" : ""}`}>{m.name}</p>
                <p className="text-[10px] text-muted-foreground">{m.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MissionCompare;
