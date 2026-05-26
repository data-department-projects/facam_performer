import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES = [
  "profiles",
  "app_departments",
  "app_projects",
  "app_committees",
  "app_organization",
  "app_time_entries",
  "objectives",
  "department_objectives",
  "department_objective_kpis",
  "modification_requests",
  "objective_change_requests",
  "objective_change_audit_log",
  "operational_meetings",
  "other_tasks",
  "reports",
  "weekly_todos",
  "weekly_planner_status",
  "weekly_planner_audit_log",
  "user_roles",
  "user_module_permissions",
  "user_create_permissions",
  "user_audit_log",
  "time_entry_exemptions",
  "project_expenses",
  "project_expense_types",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const backup: Record<string, unknown[]> = {};
    const errors: string[] = [];

    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        errors.push(`${table}: ${error.message}`);
        backup[table] = [];
      } else {
        backup[table] = data || [];
      }
    }

    const now = new Date();
    const fileName = `backup_${now.toISOString().replace(/[:.]/g, "-")}.json`;
    const jsonContent = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(fileName, blob, {
        contentType: "application/json",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Update last_backup_at
    await supabase
      .from("backup_schedule")
      .update({ last_backup_at: now.toISOString() })
      .eq("id", "default");

    return new Response(
      JSON.stringify({
        success: true,
        file: fileName,
        tables: TABLES.length,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
