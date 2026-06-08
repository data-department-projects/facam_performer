import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "request_created"
  | "manager_approved"
  | "manager_rejected"
  | "dg_approved"
  | "dg_rejected";

interface AuditLogEntry {
  change_request_id: string;
  objective_id: string;
  user_id: string;
  action: AuditAction;
  actor_id: string;
  actor_role: string;
  details?: Record<string, unknown>;
}

type UntypedRpc = (fn: string, params: Record<string, unknown>) => Promise<{ error: Error | null }>;

export const logObjectiveChangeAudit = async (entry: AuditLogEntry) => {
  const rpc = supabase.rpc as unknown as UntypedRpc;
  const { error } = await rpc("insert_objective_audit_log", {
    _action: entry.action,
    _actor_id: entry.actor_id,
    _actor_role: entry.actor_role,
    _change_request_id: entry.change_request_id,
    _objective_id: entry.objective_id,
    _user_id: entry.user_id,
    _details: entry.details ?? {},
  });
  if (error) console.error("Audit log error:", error);
};
