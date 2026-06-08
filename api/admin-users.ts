import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-token",
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).setHeader("Content-Type", "application/json").json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = req.body as Record<string, unknown>;

  // Bootstrap mode : aucun admin existant → pas d'auth requise
  const { data: adminRoles } = await adminClient
    .from("user_roles").select("id").eq("role", "admin").limit(1);
  const isBootstrap = !adminRoles || adminRoles.length === 0;

  if (!isBootstrap) {
    const xUserToken = req.headers["x-user-token"] as string | undefined;
    const authHeader  = req.headers.authorization ?? "";
    const token = xUserToken ?? (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null) ?? body.access_token as string | undefined;

    if (!token) return json(res, 401, { error: "Unauthorized" });

    const payload  = decodeJwtPayload(token as string);
    const callerId = payload?.sub as string | undefined;
    if (!callerId) return json(res, 401, { error: "Unauthorized" });

    const { data: roleData } = await adminClient
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleData) return json(res, 403, { error: "Admin access required" });
  }

  const { action } = body;

  // ── Update password ──────────────────────────────────────────────────────
  if (action === "update_password") {
    const { user_id, new_password } = body as { user_id: string; new_password: string };
    if (!user_id || !new_password) return json(res, 400, { error: "user_id and new_password required" });
    const { error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
    if (error) return json(res, 400, { error: error.message });
    return json(res, 200, { success: true });
  }

  // ── Ban / Unban ───────────────────────────────────────────────────────────
  if (action === "toggle_ban") {
    const { user_id, ban } = body as { user_id: string; ban: boolean };
    if (!user_id) return json(res, 400, { error: "user_id required" });
    const { error } = await adminClient.auth.admin.updateUserById(user_id, {
      ban_duration: ban ? "876600h" : "none",
    });
    if (error) return json(res, 400, { error: error.message });
    return json(res, 200, { success: true });
  }

  // ── List users status ─────────────────────────────────────────────────────
  if (action === "list_users_status") {
    const { data: { users: allUsers }, error } = await adminClient.auth.admin.listUsers();
    if (error) return json(res, 400, { error: error.message });
    const statuses = (allUsers ?? []).map(u => ({
      user_id:        u.id,
      email:          u.email,
      banned_until:   u.banned_until,
      last_sign_in_at: u.last_sign_in_at,
      created_at:     u.created_at,
      confirmed_at:   u.confirmed_at,
    }));
    return json(res, 200, { statuses });
  }

  // ── Delete user ───────────────────────────────────────────────────────────
  if (action === "delete_user") {
    const { user_id } = body as { user_id: string };
    if (!user_id) return json(res, 400, { error: "user_id required" });
    await adminClient.from("user_module_permissions").delete().eq("user_id", user_id);
    await adminClient.from("user_roles").delete().eq("user_id", user_id);
    await adminClient.from("profiles").delete().eq("user_id", user_id);
    const { error } = await adminClient.auth.admin.deleteUser(user_id);
    if (error) return json(res, 400, { error: error.message });
    return json(res, 200, { success: true });
  }

  // ── Resend invite ─────────────────────────────────────────────────────────
  if (action === "resend_invite") {
    const { user_id } = body as { user_id: string };
    if (!user_id) return json(res, 400, { error: "user_id required" });

    const { data: userData, error: getUserErr } = await adminClient.auth.admin.getUserById(user_id);
    if (getUserErr || !userData?.user?.email) {
      return json(res, 400, { error: getUserErr?.message ?? "User not found" });
    }

    await adminClient.from("profiles").update({ must_change_password: true }).eq("user_id", user_id);

    const origin = (req.headers.origin ?? req.headers.referer) as string | undefined;
    let appOrigin = "https://facamperformer.com";
    try { if (origin) appOrigin = new URL(origin).origin; } catch { /* keep default */ }

    const { error: recoveryErr } = await adminClient.auth.resetPasswordForEmail(
      userData.user.email,
      { redirectTo: `${appOrigin}/reset-password?type=recovery` }
    );
    if (recoveryErr) return json(res, 400, { error: recoveryErr.message });
    return json(res, 200, { success: true });
  }

  // ── Create users (bulk invite) ────────────────────────────────────────────
  const { users } = body as { users: Array<Record<string, string>> };
  if (!Array.isArray(users) || users.length === 0) {
    return json(res, 400, { error: "No users provided" });
  }

  const results: Array<{ email: string; success: boolean; error?: string; user_id?: string }> = [];

  for (const u of users) {
    const { email, full_name, department_id, service, poste, role } = u;
    if (!email || !full_name) {
      results.push({ email: email ?? "?", success: false, error: "Missing required fields" });
      continue;
    }

    const { data: newUser, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name },
    });

    if (inviteError || !newUser?.user) {
      results.push({ email, success: false, error: inviteError?.message ?? "Invitation failed" });
      continue;
    }

    const userId = newUser.user.id;
    await adminClient.from("profiles").update({
      full_name,
      department_id: department_id ?? null,
      service:       service ?? null,
      poste:         poste ?? null,
      must_change_password: true,
    }).eq("user_id", userId);

    const finalRole = role === "admin" ? "admin" : role === "admin_rapproche" ? "admin_rapproche" : "collaborator";
    await adminClient.from("user_roles").insert({ user_id: userId, role: finalRole });

    results.push({ email, success: true, user_id: userId });
  }

  return json(res, 200, { results });
}
