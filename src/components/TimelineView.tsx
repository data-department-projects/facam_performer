import { Milestone } from "@/data/departments";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface TimelineViewProps {
  milestones: Milestone[];
  year: string;
}

const statusConfig = {
  done: { icon: CheckCircle2, className: "text-accent", bgClass: "bg-accent/10", label: "Terminé" },
  "in-progress": { icon: Loader2, className: "text-secondary", bgClass: "bg-secondary/10", label: "En cours" },
  planned: { icon: Circle, className: "text-muted-foreground", bgClass: "bg-muted", label: "Planifié" },
};

const TimelineView = ({ milestones, year }: TimelineViewProps) => {
  return (
    <div>
      <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
        <span className="inline-block w-8 h-1 rounded-full bg-secondary" />
        Roadmap {year}
      </h3>
      <div className="space-y-3">
        {milestones.map((milestone, idx) => {
          const config = statusConfig[milestone.status];
          const Icon = config.icon;
          return (
            <div key={idx} className="flex gap-4 items-start group">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.bgClass}`}>
                  <Icon className={`w-4 h-4 ${config.className} ${milestone.status === "in-progress" ? "animate-spin" : ""}`} />
                </div>
                {idx < milestones.length - 1 && <div className="w-px h-8 bg-border" />}
              </div>
              <div className="pb-4 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{milestone.quarter}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    milestone.status === "done" ? "bg-accent/10 text-accent" :
                    milestone.status === "in-progress" ? "bg-secondary/20 text-secondary-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}>{config.label}</span>
                </div>
                <p className="font-display font-medium text-sm">{milestone.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{milestone.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineView;
