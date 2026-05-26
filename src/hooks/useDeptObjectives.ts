import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ObjectiveStatus } from "./useObjectives";

export interface DeptObjective {
  id: string;
  department_id: string;
  title: string;
  description: string;
  category: string;
  year: number;
  status: ObjectiveStatus;
  bonus: number;
  achievement_pct: number;
  s1_achievement_pct: number | null;
  s1_comment: string | null;
  s1_reviewed_at: string | null;
  final_achievement_pct: number | null;
  final_comment: string | null;
  final_reviewed_at: string | null;
  deadline: string | null;
  created_by: string;
  validated_by: string | null;
  validated_at: string | null;
  kpi_unit: string;
  created_at: string;
  updated_at: string;
}

export const useDeptObjectives = (year?: number) => {
  const { user } = useAuth();
  const [objectives, setObjectives] = useState<DeptObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = year || new Date().getFullYear();

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("department_objectives_public" as any)
      .select("*")
      .eq("year", currentYear)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Error fetching dept objectives:", error);
      toast.error("Erreur lors du chargement des objectifs départementaux");
    } else {
      setObjectives((data as unknown as DeptObjective[]) || []);
    }
    setLoading(false);
  }, [user, currentYear]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (obj: Partial<DeptObjective> & { department_id: string }) => {
    if (!user) return null;
    const payload = { ...obj, created_by: user.id, year: currentYear, status: "draft" as ObjectiveStatus };
    const { data, error } = await supabase.from("department_objectives").insert(payload as any).select().single();
    if (error) { toast.error("Erreur lors de la création"); console.error(error); return null; }
    toast.success("Objectif créé");
    fetch();
    return data;
  };

  const update = async (id: string, updates: Partial<DeptObjective>) => {
    const { error } = await supabase.from("department_objectives").update(updates as any).eq("id", id);
    if (error) { toast.error("Erreur lors de la mise à jour"); console.error(error); return false; }
    toast.success("Objectif mis à jour");
    fetch();
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("department_objectives").delete().eq("id", id);
    if (error) { toast.error("Erreur lors de la suppression"); console.error(error); return false; }
    toast.success("Objectif supprimé");
    fetch();
    return true;
  };

  const bulkUpdateStatus = async (deptId: string, fromStatuses: ObjectiveStatus[], toStatus: ObjectiveStatus, extra?: Partial<DeptObjective>) => {
    const { error } = await supabase
      .from("department_objectives")
      .update({ status: toStatus, ...extra } as any)
      .eq("department_id", deptId)
      .eq("year", currentYear)
      .in("status", fromStatuses);
    if (error) { toast.error("Erreur"); console.error(error); return false; }
    toast.success("Statut mis à jour");
    fetch();
    return true;
  };

  return { objectives, loading, create, update, remove, bulkUpdateStatus, refetch: fetch };
};
