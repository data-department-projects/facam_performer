import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Requires admin JWT
  const authHeader = req.headers["authorization"] as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const token       = authHeader.slice(7);
  const adminClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: { user } } = await adminClient.auth.getUser(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { data: roleData } = await adminClient
    .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleData) return res.status(403).json({ error: "Admin access required" });

  const { to, subject, body } = req.body as { to?: string; subject?: string; body?: string };
  if (!to || !subject || !body) return res.status(400).json({ error: "Missing to, subject or body" });

  const resend    = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "FACAM PERFORMER <noreply@facamperformer.com>";

  const htmlBody = escHtml(body).replace(/\n/g, "<br>");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#001b61;border-radius:12px 12px 0 0;padding:24px 32px;">
        <span style="color:#ffae03;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">FACAM PERFORMER</span>
        <h2 style="color:#ffffff;margin:8px 0 0;font-size:20px;">Message de l'administration</h2>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-top:3px solid #ffae03;border-radius:0 0 12px 12px;padding:28px 32px;">
        <p style="color:#334155;font-size:15px;line-height:1.7;">${htmlBody}</p>
        <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px;">
          FACAM PERFORMER — message automatique, ne pas répondre
        </p>
      </div>
    </div>`;

  const { error } = await resend.emails.send({ from: fromEmail, to, subject, html });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
