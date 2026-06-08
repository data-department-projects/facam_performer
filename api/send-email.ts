import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { buildBugReportEmail, type BugReportPayload } from "./_lib/templates";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Authenticate via Supabase JWT
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const { type, payload } = req.body as { type: string; payload: BugReportPayload };

  if (type === "bug_report") {
    const urgencyLabel = (payload.urgency ?? "moyenne").toUpperCase();
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "FACAM PERFORMER <no-reply@facam.com>",
      to: process.env.SUPPORT_EMAIL!,
      subject: `[${urgencyLabel}] ${payload.title}`,
      html: buildBugReportEmail(payload),
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ id: data?.id });
  }

  return res.status(400).json({ error: `Unknown email type: ${type}` });
}
