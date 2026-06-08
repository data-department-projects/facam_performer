import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user_id, week_start } = req.body as { user_id?: string; week_start?: string };
  if (!user_id || !week_start) {
    return res.status(400).json({ error: "Missing user_id or week_start" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Profil du collaborateur ayant soumis le planning
  const { data: submitter } = await supabase
    .from("profiles")
    .select("full_name, hierarchy_user_id")
    .eq("user_id", user_id)
    .single();

  if (!submitter?.hierarchy_user_id) {
    return res.status(200).json({ ok: true, skipped: "no manager" });
  }

  // Email du manager
  const { data: manager } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("user_id", submitter.hierarchy_user_id)
    .single();

  if (!manager?.email) {
    return res.status(200).json({ ok: true, skipped: "manager has no email" });
  }

  const resend    = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "FACAM PERFORMER <noreply@facamperformer.com>";

  const { error } = await resend.emails.send({
    from:    fromEmail,
    to:      manager.email,
    subject: `Planning soumis par ${submitter.full_name} — Semaine du ${week_start}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:#001b61;border-radius:12px 12px 0 0;padding:24px 32px;">
          <span style="color:#ffae03;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">FACAM PERFORMER</span>
          <h2 style="color:#ffffff;margin:8px 0 0;font-size:20px;">📋 Nouveau planning à valider</h2>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-top:3px solid #ffae03;border-radius:0 0 12px 12px;padding:28px 32px;">
          <p style="color:#334155;font-size:15px;">Bonjour <strong>${manager.full_name}</strong>,</p>
          <p style="color:#334155;font-size:15px;">
            <strong>${submitter.full_name}</strong> a soumis son planning hebdomadaire
            pour la semaine du <strong>${week_start}</strong>.
          </p>
          <p style="color:#334155;font-size:15px;">Connectez-vous à l'application pour le valider ou le refuser.</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="https://facamperformer.com"
               style="background:#001b61;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
              Accéder à l'application
            </a>
          </div>
          <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px;">
            FACAM PERFORMER — message automatique, ne pas répondre
          </p>
        </div>
      </div>`,
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
