/**
 * Types partagés — source de vérité unique pour le domaine métier.
 * Importer depuis "@/types" plutôt que de redéfinir en local.
 */

// ── Objectifs ────────────────────────────────────────────────────────────────

export type ObjectiveStatus =
  | "draft"
  | "pending_validation"
  | "validated"
  | "s1_review"
  | "s2_evaluation"
  | "completed";

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

// ── Profils ───────────────────────────────────────────────────────────────────

/** Profil public — retourné par la vue profiles_public */
export interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  department_id: string | null;
  service: string | null;
  poste: string | null;
  is_manager: boolean;
  hierarchy_user_id: string | null;
  category: string;
  badge_number: string | null;
}

/** Profil enrichi utilisé dans AuthContext (inclut les champs auth) */
export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department_id: string | null;
  service: string | null;
  is_manager: boolean;
  hierarchy_user_id: string | null;
  skip_personal_planning?: boolean;
  must_change_password?: boolean;
  is_blocked?: boolean;
}

// ── Utilitaires génériques ────────────────────────────────────────────────────

/** Ligne brute d'une table app_* (données sérialisées en JSONB) */
export interface AppDataRow {
  id: string;
  data: unknown;
}

export interface TimeEntryRow extends AppDataRow {
  user_id: string;
  validated: boolean;
}
