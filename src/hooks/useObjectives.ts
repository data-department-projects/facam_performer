import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type ObjectiveStatus = "draft" | "pending_validation" | "validated" | "s1_review" | "s2_evaluation" | "completed";

export interface Objective {
  id: string;
  user_id: string;
  created_by: string;
  year: number;
  title: string;
  description: string;
  category: string;
  weight: number;
  bonus: number;
  kpi_target: string;
  kpi_unit: string;
  kpi_actual: string | null;
  deadline: string | null;
  status: ObjectiveStatus;
  achievement_pct: number;
  s1_achievement_pct: number | null;
  s1_comment: string | null;
  s1_reviewed_at: string | null;
  final_achievement_pct: number | null;
  final_comment: string | null;
  final_reviewed_at: string | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export const OBJECTIVE_CATEGORIES = [
  { value: "performance", label: "Performance" },
  { value: "development", label: "Développement" },
  { value: "leadership", label: "Leadership" },
  { value: "innovation", label: "Innovation" },
  { value: "collaboration", label: "Collaboration" },
  { value: "general", label: "Général" },
];

export const STATUS_LABELS: Record<ObjectiveStatus, string> = {
  draft: "Brouillon",
  pending_validation: "En attente de validation",
  validated: "Validé",
  s1_review: "Revue S1",
  s2_evaluation: "Évaluation S2",
  completed: "Complété",
};

export const STATUS_COLORS: Record<ObjectiveStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_validation: "bg-yellow-100 text-yellow-800 border-yellow-300",
  validated: "bg-blue-100 text-blue-800 border-blue-300",
  s1_review: "bg-purple-100 text-purple-800 border-purple-300",
  s2_evaluation: "bg-orange-100 text-orange-800 border-orange-300",
  completed: "bg-green-100 text-green-800 border-green-300",
};

export const useObjectives = (filterUserId?: string, filterYear?: number) => {
  const { user, isAdmin } = useAuth();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  const year = filterYear || new Date().getFullYear();

  const fetchObjectives = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from("objectives").select("*").eq("year", year).order("created_at", { ascending: true });

    if (filterUserId) {
      query = query.eq("user_id", filterUserId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching objectives:", error);
      toast.error("Erreur lors du chargement des objectifs");
    } else {
      setObjectives((data as unknown as Objective[]) || []);
    }
    setLoading(false);
  }, [user, year, filterUserId]);

  useEffect(() => {
    fetchObjectives();
  }, [fetchObjectives]);

  const createObjective = async (obj: Partial<Objective> & { user_id: string }) => {
    if (!user) return null;
    const payload = {
      ...obj,
      created_by: user.id,
      year,
      status: "draft" as ObjectiveStatus,
    };
    const { data, error } = await supabase.from("objectives").insert(payload as any).select().single();
    if (error) {
      toast.error("Erreur lors de la création de l'objectif");
      console.error(error);
      return null;
    }
    toast.success("Objectif créé");
    fetchObjectives();
    return data;
  };

  const updateObjective = async (id: string, updates: Partial<Objective>) => {
    const { error } = await supabase.from("objectives").update(updates as any).eq("id", id);
    if (error) {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
      return false;
    }
    toast.success("Objectif mis à jour");
    fetchObjectives();
    return true;
  };

  const deleteObjective = async (id: string) => {
    const { error } = await supabase.from("objectives").delete().eq("id", id);
    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
      return false;
    }
    toast.success("Objectif supprimé");
    fetchObjectives();
    return true;
  };

  const submitForValidation = async (userId: string) => {
    const { error } = await supabase
      .from("objectives")
      .update({ status: "pending_validation" } as any)
      .eq("user_id", userId)
      .eq("year", year)
      .eq("status", "draft");
    if (error) {
      toast.error("Erreur lors de la soumission");
      return false;
    }
    toast.success("Objectifs soumis pour validation");
    fetchObjectives();
    return true;
  };

  const validateObjectives = async (userId: string) => {
    if (!user) return false;
    const { error } = await supabase
      .from("objectives")
      .update({ status: "validated", validated_by: user.id, validated_at: new Date().toISOString() } as any)
      .eq("user_id", userId)
      .eq("year", year)
      .in("status", ["draft", "pending_validation"]);
    if (error) {
      toast.error("Erreur lors de la validation");
      return false;
    }
    toast.success("Objectifs validés");
    fetchObjectives();
    return true;
  };

  const startS1Review = async (userId: string) => {
    const { error } = await supabase
      .from("objectives")
      .update({ status: "s1_review" } as any)
      .eq("user_id", userId)
      .eq("year", year)
      .eq("status", "validated");
    if (error) {
      toast.error("Erreur");
      return false;
    }
    toast.success("Revue S1 lancée");
    fetchObjectives();
    return true;
  };

  const startS2Evaluation = async (userId: string) => {
    const { error } = await supabase
      .from("objectives")
      .update({ status: "s2_evaluation" } as any)
      .eq("user_id", userId)
      .eq("year", year)
      .in("status", ["s1_review", "validated"]);
    if (error) {
      toast.error("Erreur");
      return false;
    }
    toast.success("Évaluation S2 lancée");
    fetchObjectives();
    return true;
  };

  const completeEvaluation = async (userId: string) => {
    const { error } = await supabase
      .from("objectives")
      .update({ status: "completed" } as any)
      .eq("user_id", userId)
      .eq("year", year)
      .eq("status", "s2_evaluation");
    if (error) {
      toast.error("Erreur");
      return false;
    }
    toast.success("Évaluation finalisée");
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
