import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if any admin exists (bootstrap mode if none)
    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);
    const isBootstrap = !adminRoles || adminRoles.length === 0;

    // Parse body
    const body = await req.json();

    if (!isBootstrap) {
      // Extract user token
      const xUserToken = req.headers.get("x-user-token");
      let token = xUserToken || body.access_token;
      if (!token) {
        const authHeader = req.headers.get("Authorization");
        if (authHeader?.startsWith("Bearer ")) {
          token = authHeader.replace("Bearer ", "");
        }
      }

      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = decodeJwtPayload(token);
      const callerId = payload?.sub as string;
      if (!callerId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { action } = body;

    // ── Action: Update password ──
    if (action === "update_password") {
      const { user_id, new_password } = body;
      if (!user_id || !new_password) {
        return new Response(JSON.stringify({ error: "user_id and new_password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: Ban/Unban user ──
    if (action === "toggle_ban") {
      const { user_id, ban } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: ban ? "876600h" : "none",
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: Get user statuses ──
    if (action === "list_users_status") {
      const { data: { users: allUsers }, error } = await adminClient.auth.admin.listUsers();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const statuses = (allUsers ?? []).map(u => ({
        user_id: u.id,
        email: u.email,
        banned_until: u.banned_until,
        last_sign_in_at: u.last_sign_in_at,
        created_at: u.created_at,
        confirmed_at: u.confirmed_at,
      }));
      return new Response(JSON.stringify({ statuses }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: Delete user ──
    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await adminClient.from("user_module_permissions").delete().eq("user_id", user_id);
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      await adminClient.from("profiles").delete().eq("user_id", user_id);
      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: Re-send invite email for existing user ──
    if (action === "resend_invite") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: userData, error: getUserErr } = await adminClient.auth.admin.getUserById(user_id);
      if (getUserErr || !userData?.user?.email) {
        return new Response(JSON.stringify({ error: getUserErr?.message || "User not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: profileErr } = await adminClient
        .from("profiles")
        .update({ must_change_password: true })
        .eq("user_id", user_id);

      if (profileErr) {
        return new Response(JSON.stringify({ error: profileErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const originHeader = req.headers.get("origin");
      const refererHeader = req.headers.get("referer");
      let appOrigin = "https://facamperformer.com";

      if (originHeader) {
        appOrigin = originHeader.replace(/\/$/, "");
      } else if (refererHeader) {
        try {
          appOrigin = new URL(refererHeader).origin;
        } catch {
          appOrigin = "https://facamperformer.com";
        }
      }

      const { error: recoveryErr } = await adminClient.auth.resetPasswordForEmail(userData.user.email, {
        redirectTo: `${appOrigin}/reset-password?type=recovery`,
      });

      if (recoveryErr) {
        return new Response(JSON.stringify({ error: recoveryErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Access email re-sent", { user_id, email: userData.user.email, appOrigin });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Default: Create users (bulk) via invite ──
    const { users } = body;
    if (!Array.isArray(users) || users.length === 0) {
      return new Response(JSON.stringify({ error: "No users provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { email: string; success: boolean; error?: string; user_id?: string }[] = [];
    for (const u of users) {
      const { email, full_name, department_id, service, poste, role } = u;
      if (!email || !full_name) {
        results.push({ email: email || "?", success: false, error: "Missing required fields" });
        continue;
      }

      // Use inviteUserByEmail — sends invite email automatically via auth-email-hook
      const { data: newUser, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name },
      });

      if (inviteError || !newUser?.user) {
        results.push({ email, success: false, error: inviteError?.message || "Invitation failed" });
        continue;
      }

      const userId = newUser.user.id;
      await adminClient.from("profiles").update({
        full_name,
        department_id: department_id || null,
        service: service || null,
        poste: poste || null,
        must_change_password: true,
      }).eq("user_id", userId);

      const finalRole = role === "admin" ? "admin" : role === "admin_rapproche" ? "admin_rapproche" : "collaborator";
      await adminClient.from("user_roles").insert({ user_id: userId, role: finalRole });

      console.log("Invite sent for", email);
      results.push({ email, success: true, user_id: userId });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
