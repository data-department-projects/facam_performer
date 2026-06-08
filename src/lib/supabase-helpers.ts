import { toast } from "sonner";
import type { PostgrestError } from "@supabase/supabase-js";

const isDev = import.meta.env.DEV;

/**
 * Gère une erreur Supabase de façon standardisée :
 * - affiche un toast à l'utilisateur
 * - log en console uniquement en développement
 * Retourne `true` si une erreur est présente (permet if-early-return).
 */
export function handleError(
  error: PostgrestError | Error | null | undefined,
  userMessage: string
): boolean {
  if (!error) return false;
  toast.error(userMessage);
  if (isDev) console.error("[supabase]", error);
  return true;
}

/**
 * Wrapper pour les mutations Supabase avec gestion toast automatique.
 * Retourne la data ou null en cas d'erreur.
 *
 * @example
 * const data = await withToast(
 *   supabase.from("objectives").insert(payload).select().single(),
 *   { success: "Objectif créé", error: "Erreur lors de la création" }
 * );
 */
export async function withToast<T>(
  promise: Promise<{ data: T | null; error: PostgrestError | null }>,
  messages: { success: string; error: string }
): Promise<T | null> {
  const { data, error } = await promise;
  if (handleError(error, messages.error)) return null;
  toast.success(messages.success);
  return data;
}

/**
 * Wrapper lecture seule — pas de toast succès, juste la gestion d'erreur.
 */
export async function withErrorToast<T>(
  promise: Promise<{ data: T | null; error: PostgrestError | null }>,
  errorMessage: string
): Promise<T | null> {
  const { data, error } = await promise;
  if (handleError(error, errorMessage)) return null;
  return data;
}
