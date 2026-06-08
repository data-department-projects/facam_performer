import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "profiles", "app_departments", "app_projects", "app_committees",
  "app_organization", "app_time_entries", "objectives", "department_objectives",
  "department_objective_kpis", "modification_requests", "objective_change_requests",
  "objective_change_audit_log", "operational_meetings", "other_tasks", "reports",
  "weekly_todos", "weekly_planner_status", "weekly_planner_audit_log",
  "user_roles", "user_module_permissions", "user_create_permissions", "user_audit_log",
  "time_entry_exemptions", "project_expenses", "project_expense_types",
] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Auth: x-backup-secret (cron) OU Bearer JWT admin (UI)
  const secret     = req.headers["x-backup-secret"] as string | undefined;
  const authHeader = req.headers["authorization"]   as string | undefined;

  let authorized = false;
  if (secret && secret === process.env.BACKUP_SECRET) {
    authorized = true;
  } else if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      const { data: roleData } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (roleData) authorized = true;
    }
  }

  if (!authorized) return res.status(401).json({ error: "Unauthorized" });

  const backup: Record<string, unknown[]> = {};
  const errors: string[] = [];

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      errors.push(`${table}: ${error.message}`);
      backup[table] = [];
    } else {
      backup[table] = data ?? [];
    }
  }

  const now      = new Date();
  const fileName = `backup_${now.toISOString().replace(/[:.]/g, "-")}.json`;

  const { error: uploadError } = await supabase.storage
    .from("backups")
    .upload(fileName, Buffer.from(JSON.stringify(backup, null, 2)), {
      contentType: "application/json",
      upsert: false,
    });

  if (uploadError) {
    return res.status(500).json({ success: false, error: uploadError.message });
  }

  await supabase
    .from("backup_schedule")
    .update({ last_backup_at: now.toISOString() })
    .eq("id", "default");

  return res.status(200).json({ success: true, file: fileName, tables: TABLES.length, errors });
}
