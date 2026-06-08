import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as React from "react";
import { render } from "@react-email/components";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { SignupEmail } from "./_lib/email-templates/signup";
import { InviteEmail } from "./_lib/email-templates/invite";
import { MagicLinkEmail } from "./_lib/email-templates/magic-link";
import { RecoveryEmail } from "./_lib/email-templates/recovery";
import { EmailChangeEmail } from "./_lib/email-templates/email-change";
import { ReauthenticationEmail } from "./_lib/email-templates/reauthentication";

const SITE_NAME   = "FACAM PERFORMER";
const ROOT_DOMAIN = "facamperformer.com";

const EMAIL_SUBJECTS: Record<string, string> = {
  signup:           "Bienvenue — Activez votre compte",
  invite:           "Rejoignez FACAM PERFORMER",
  magiclink:        "Votre lien de connexion",
  recovery:         "Réinitialisation de votre mot de passe",
  email_change:     "Confirmez votre changement d'adresse email",
  reauthentication: "Votre code de vérification",
};

const EMAIL_TEMPLATES: Record<string, React.ComponentType<Record<string, unknown>>> = {
  signup:           SignupEmail,
  invite:           InviteEmail,
  magiclink:        MagicLinkEmail,
  recovery:         RecoveryEmail,
  email_change:     EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
};

function buildConfirmationUrl(emailData: Record<string, unknown>): string | undefined {
  const direct = [emailData.confirmation_url, emailData.url, emailData.action_link]
    .find((v): v is string => typeof v === "string" && v.trim().length > 0);
  if (direct) return direct;

  const supabaseUrl = process.env.SUPABASE_URL;
  const tokenHash  = emailData.token_hash as string | undefined;
  const actionType = (emailData.email_action_type ?? emailData.action_type) as string | undefined;
  const redirectTo = (emailData.redirect_to ?? emailData.site_url) as string | undefined;

  if (supabaseUrl && tokenHash && actionType) {
    const url = new URL("/auth/v1/verify", supabaseUrl);
    url.searchParams.set("token", tokenHash);
    url.searchParams.set("type", actionType);
    if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
    return url.toString();
  }
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify Supabase auth hook secret (set in Supabase dashboard › Auth › Hooks)
  const hookSecret  = process.env.SUPABASE_HOOK_SECRET;
  const authHeader  = req.headers.authorization ?? "";
  const callerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!hookSecret || callerToken !== hookSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body      = req.body as Record<string, unknown>;
  const emailData = (body.email_data ?? body.data ?? body) as Record<string, unknown>;
  const user      = body.user as Record<string, unknown> | undefined;
  const emailType = (
    emailData.email_action_type ?? emailData.action_type ?? body.type
  ) as string | undefined;

  if (!emailType || !EMAIL_TEMPLATES[emailType]) {
    return res.status(400).json({ error: `Unknown email type: ${emailType}` });
  }

  const recipientEmail = (
    emailData.email ?? user?.email ?? body.email
  ) as string | undefined;

  if (!recipientEmail) {
    return res.status(400).json({ error: "Missing recipient email" });
  }

  // Personalise les emails d'inscription et d'invitation
  let firstName: string | undefined;
  if (emailType === "signup" || emailType === "invite") {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("email", recipientEmail)
      .maybeSingle();
    if (profile?.full_name) firstName = profile.full_name.split(" ")[0];
  }

  const confirmationUrl = buildConfirmationUrl(emailData);

  const templateProps = {
    siteName:        SITE_NAME,
    siteUrl:         `https://${ROOT_DOMAIN}`,
    recipient:       recipientEmail,
    confirmationUrl,
    token:           emailData.token as string | undefined,
    email:           recipientEmail,
    newEmail:        emailData.new_email as string | undefined,
    firstName,
  };

  const EmailTemplate = EMAIL_TEMPLATES[emailType];
  const html = await render(React.createElement(EmailTemplate, templateProps));

  const resend    = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? `${SITE_NAME} <noreply@${ROOT_DOMAIN}>`;

  const { data, error } = await resend.emails.send({
    from:    fromEmail,
    to:      recipientEmail,
    subject: EMAIL_SUBJECTS[emailType] ?? "Notification FACAM PERFORMER",
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    return res.status(500).json({ error: error.message });
  }

  console.log(`Auth email sent [${emailType}] → ${recipientEmail} (id: ${data?.id})`);
  return res.status(200).json({ success: true, id: data?.id });
}
