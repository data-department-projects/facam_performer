import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { BarChart3, TrendingUp } from "lucide-react";

interface KpiRow {
  id: string;
  label: string;
  unit: string;
  target_value: number;
  actual_value: number | null;
}

interface Props {
  objectiveId: string;
  kpiUnit?: string;
}

const DeptObjectiveInlineKpis = ({ objectiveId, kpiUnit }: Props) => {
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKpis = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("department_objective_kpis")
        .select("*")
        .eq("objective_id", objectiveId)
        .order("created_at");
      setKpis((data as unknown as KpiRow[]) || []);
      setLoading(false);
    };
    fetchKpis();
  }, [objectiveId]);

  if (loading) return null;

  const hasKpis = kpis.length > 0;
  const hasKpiUnit = kpiUnit && kpiUnit.trim().length > 0;

  if (!hasKpis && !hasKpiUnit) return null;

  return (
    <div className="mt-3 rounded-lg bg-muted/30 border border-border/30 p-3 space-y-2">
      {hasKpiUnit && (
        <div className="flex items-center gap-2 text-[11px]">
          <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-3 h-3 text-primary" />
          </div>
          <span className="font-semibold text-foreground">Objectif chiffré :</span>
          <span className="text-muted-foreground">{kpiUnit}</span>
        </div>
      )}
      {hasKpis && (
        <div className="space-y-2">
          {hasKpiUnit && <div className="h-px bg-border/30" />}
          {kpis.map(kpi => {
            const pct = kpi.target_value > 0 && kpi.actual_value != null
              ? Math.round((kpi.actual_value / kpi.target_value) * 100)
              : 0;
            return (
              <div key={kpi.id} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-accent" />
                    <span className="font-medium text-foreground">{kpi.label}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {kpi.actual_value != null ? kpi.actual_value.toLocaleString() : "—"} / {kpi.target_value.toLocaleString()} {kpi.unit}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <span className={`text-[10px] font-bold min-w-[28px] text-right ${pct >= 100 ? 'text-accent' : pct >= 50 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DeptObjectiveInlineKpis;
