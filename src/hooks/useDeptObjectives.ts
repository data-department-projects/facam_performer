import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { handleError, withToast } from "@/lib/supabase-helpers";
import type { DeptObjective, ObjectiveStatus } from "@/types";

export type { DeptObjective };

export const useDeptObjectives = (year?: number) => {
  const { user } = useAuth();
  const [objectives, setObjectives] = useState<DeptObjective[]>([]);
  const [loading, setLoading] = useState(true);

  const currentYear = year ?? new Date().getFullYear();

  const fetchObjectives = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      // Vue Supabase non incluse dans les types générés — cast nécessaire
      .from("department_objectives_public" as never)
      .select("*")
      .eq("year", currentYear)
      .order("created_at", { ascending: true });

    if (!handleError(error, "Erreur lors du chargement des objectifs départementaux")) {
      setObjectives((data as unknown as DeptObjective[]) ?? []);
    }

    setLoading(false);
  }, [user, currentYear]);

  useEffect(() => {
    fetchObjectives();
  }, [fetchObjectives]);

  const create = async (
    obj: Omit<Partial<DeptObjective>, "department_id"> & { department_id: string }
  ): Promise<DeptObjective | null> => {
    if (!user) return null;
    const payload = { ...obj, created_by: user.id, year: currentYear, status: "draft" as ObjectiveStatus };
    const data = await withToast(
      supabase.from("department_objectives").insert(payload as never).select().single(),
      { success: "Objectif créé", error: "Erreur lors de la création" }
    );
    if (data) fetchObjectives();
    return data as DeptObjective | null;
  };

  const update = async (id: string, updates: Partial<DeptObjective>): Promise<boolean> => {
    const { error } = await supabase
      .from("department_objectives")
      .update(updates as never)
      .eq("id", id);
    if (handleError(error, "Erreur lors de la mise à jour")) return false;
    fetchObjectives();
    return true;
  };

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("department_objectives").delete().eq("id", id);
    if (handleError(error, "Erreur lors de la suppression")) return false;
    fetchObjectives();
    return true;
  };

  const bulkUpdateStatus = async (
    deptId: string,
    fromStatuses: ObjectiveStatus[],
    toStatus: ObjectiveStatus,
    extra?: Partial<DeptObjective>
  ): Promise<boolean> => {
    const { error } = await supabase
      .from("department_objectives")
      .update({ status: toStatus, ...extra } as never)
      .eq("department_id", deptId)
      .eq("year", currentYear)
      .in("status", fromStatuses);
    if (handleError(error, "Erreur lors de la mise à jour du statut")) return false;
    fetchObjectives();
    return true;
  };

  return { objectives, loading, create, update, remove, bulkUpdateStatus, refetch: fetchObjectives };
};
