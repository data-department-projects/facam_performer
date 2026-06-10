import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { handleError, withToast } from "@/lib/supabase-helpers";
import type { Objective, ObjectiveStatus } from "@/types";

export type { ObjectiveStatus, Objective };

export const STATUS_LABELS: Record<ObjectiveStatus, string> = {
  draft:               "Brouillon",
  pending_validation:  "En attente de validation",
  validated:           "Validé",
  s1_review:           "Revue S1",
  s2_evaluation:       "Évaluation S2",
  completed:           "Complété",
};

export const STATUS_COLORS: Record<ObjectiveStatus, string> = {
  draft:               "bg-muted text-muted-foreground",
  pending_validation:  "bg-orange-100 text-orange-800 border-orange-300",
  validated:           "bg-blue-100 text-blue-800 border-blue-300",
  s1_review:           "bg-purple-100 text-purple-800 border-purple-300",
  s2_evaluation:       "bg-orange-100 text-orange-800 border-orange-300",
  completed:           "bg-green-100 text-green-800 border-green-300",
};

// Re-exported from constants to avoid breaking existing imports
export { OBJECTIVE_CATEGORIES } from "@/constants/modules";

export const useObjectives = (filterUserId?: string, filterYear?: number) => {
  const { user } = useAuth();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  const year = filterYear ?? new Date().getFullYear();

  const fetchObjectives = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("objectives")
      .select("*")
      .eq("year", year)
      .order("created_at", { ascending: true });

    if (filterUserId) query = query.eq("user_id", filterUserId);

    const { data, error } = await query;

    if (!handleError(error, "Erreur lors du chargement des objectifs")) {
      setObjectives((data as unknown as Objective[]) ?? []);
    }

    setLoading(false);
  }, [user, year, filterUserId]);

  useEffect(() => {
    fetchObjectives();
  }, [fetchObjectives]);

  const createObjective = async (
    obj: Omit<Partial<Objective>, "user_id"> & { user_id: string }
  ): Promise<Objective | null> => {
    if (!user) return null;
    const payload = { ...obj, created_by: user.id, year, status: "draft" as ObjectiveStatus };
    const data = await withToast(
      supabase.from("objectives").insert(payload as never).select().single(),
      { success: "Objectif créé", error: "Erreur lors de la création de l'objectif" }
    );
    if (data) fetchObjectives();
    return data as Objective | null;
  };

  const updateObjective = async (id: string, updates: Partial<Objective>): Promise<boolean> => {
    const { error } = await supabase.from("objectives").update(updates as never).eq("id", id);
    if (handleError(error, "Erreur lors de la mise à jour")) return false;
    fetchObjectives();
    return true;
  };

  const deleteObjective = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("objectives").delete().eq("id", id);
    if (handleError(error, "Erreur lors de la suppression")) return false;
    fetchObjectives();
    return true;
  };

  const submitForValidation = async (userId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("objectives")
      .update({ status: "pending_validation" } as never)
      .eq("user_id", userId)
      .eq("year", year)
      .eq("status", "draft");
    if (handleError(error, "Erreur lors de la soumission")) return false;
    fetchObjectives();
    return true;
  };

  const validateObjectives = async (userId: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from("objectives")
      .update({
        status: "validated",
        validated_by: user.id,
        validated_at: new Date().toISOString(),
      } as never)
      .eq("user_id", userId)
      .eq("year", year)
      .in("status", ["draft", "pending_validation"]);
    if (handleError(error, "Erreur lors de la validation")) return false;
    fetchObjectives();
    return true;
  };

  const startS1Review = async (userId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("objectives")
      .update({ status: "s1_review" } as never)
      .eq("user_id", userId)
      .eq("year", year)
      .eq("status", "validated");
    if (handleError(error, "Erreur lors du lancement de la revue S1")) return false;
    fetchObjectives();
    return true;
  };

  const startS2Evaluation = async (userId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("objectives")
      .update({ status: "s2_evaluation" } as never)
      .eq("user_id", userId)
      .eq("year", year)
      .in("status", ["s1_review", "validated"]);
    if (handleError(error, "Erreur lors du lancement de l'évaluation S2")) return false;
    fetchObjectives();
    return true;
  };

  const completeEvaluation = async (userId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("objectives")
      .update({ status: "completed" } as never)
      .eq("user_id", userId)
      .eq("year", year)
      .eq("status", "s2_evaluation");
    if (handleError(error, "Erreur lors de la finalisation de l'évaluation")) return false;
    fetchObjectives();
    return true;
  };

  return {
    objectives,
    loading,
    createObjective,
    updateObjective,
    deleteObjective,
    submitForValidation,
    validateObjectives,
    startS1Review,
    startS2Evaluation,
    completeEvaluation,
    refetch: fetchObjectives,
  };
};
