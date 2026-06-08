export interface BugReportPayload {
  category: string;
  urgency: string;
  title: string;
  description: string;
  page_concerned?: string | null;
  reporter_name: string;
  reporter_email?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  interface:   "Problème d'interface",
  donnees:     "Erreur de données",
  performance: "Lenteur / Performance",
  autre:       "Autre",
};

const URGENCY_META: Record<string, { label: string; color: string; bg: string }> = {
  haute:   { label: "HAUTE",   color: "#dc2626", bg: "#fef2f2" },
  moyenne: { label: "MOYENNE", color: "#d97706", bg: "#fffbeb" },
  basse:   { label: "BASSE",   color: "#059669", bg: "#ecfdf5" },
};

export function buildBugReportEmail(p: BugReportPayload): string {
  const urg = URGENCY_META[p.urgency] ?? URGENCY_META.moyenne;
  const cat = CATEGORY_LABELS[p.category] ?? p.category;
  const now = new Date().toLocaleString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return /* html */ `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Signalement FACAM PERFORMER</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#001b61;border-radius:12px 12px 0 0;padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#ffae03;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">FACAM PERFORMER</span>
                  <h1 style="color:#ffffff;margin:8px 0 0;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                    Nouveau signalement d'erreur
                  </h1>
                </td>
                <td align="right" valign="top">
                  <span style="display:inline-block;background:${urg.bg};color:${urg.color};border:1px solid ${urg.color}33;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:700;letter-spacing:1px;">
                    &#9679;&nbsp; URGENCE ${urg.label}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Gold accent line -->
        <tr><td style="background:#ffae03;height:3px;"></td></tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 40px;">

            <!-- Meta row -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:50%;padding-right:16px;">
                        <p style="margin:0;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Catégorie</p>
                        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#001b61;">${cat}</p>
                      </td>
                      <td style="width:50%;border-left:1px solid #e2e8f0;padding-left:16px;">
                        <p style="margin:0;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Date</p>
                        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#001b61;">${now}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Title -->
            <p style="margin:0 0 6px;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Titre du problème</p>
            <h2 style="margin:0 0 24px;font-size:18px;font-weight:700;color:#0f172a;line-height:1.4;">${escHtml(p.title)}</h2>

            <!-- Page concerned -->
            ${p.page_concerned ? `
            <p style="margin:0 0 6px;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Page / Module concerné</p>
            <p style="margin:0 0 24px;font-size:14px;color:#334155;background:#f8fafc;border-left:3px solid #ffae03;padding:10px 14px;border-radius:0 6px 6px 0;">${escHtml(p.page_concerned)}</p>
            ` : ""}

            <!-- Description -->
            <p style="margin:0 0 6px;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Description détaillée</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px 20px;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;">${escHtml(p.description)}</div>

            <!-- Divider -->
            <div style="height:1px;background:#e2e8f0;margin:28px 0;"></div>

            <!-- Reporter -->
            <p style="margin:0 0 6px;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Signalé par</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:36px;height:36px;background:#001b61;border-radius:50%;text-align:center;vertical-align:middle;">
                  <span style="color:#ffae03;font-size:14px;font-weight:700;">${(p.reporter_name[0] ?? "?").toUpperCase()}</span>
                </td>
                <td style="padding-left:12px;">
                  <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">${escHtml(p.reporter_name)}</p>
                  ${p.reporter_email ? `<p style="margin:2px 0 0;font-size:12px;color:#64748b;">${escHtml(p.reporter_email)}</p>` : ""}
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              Ce message a été généré automatiquement par <strong style="color:#001b61;">FACAM PERFORMER</strong>.
              Ne pas répondre directement à cet email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
