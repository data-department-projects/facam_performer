import type { VercelRequest, VercelResponse } from "@vercel/node";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es un expert en cybersécurité et audit informatique pour une plateforme de gestion d'entreprise.
Analyse les violations de sécurité fournies et produis un rapport structuré en français avec :

1. **Résumé exécutif** : Vue d'ensemble des menaces détectées
2. **Analyse par utilisateur** : Pour chaque utilisateur impliqué, décris le profil de risque et les patterns d'attaque
3. **Classification des menaces** : Classe chaque violation (Critique/Élevé/Moyen/Faible) avec justification
4. **Intentions probables** : Déduis ce que chaque utilisateur tentait de faire et pourquoi
5. **Recommandations** : Actions correctives à prendre

Sois précis, factuel et professionnel. Utilise des emojis pour la gravité (🔴 Critique, 🟠 Élevé, 🟡 Moyen, 🟢 Faible).`;

interface Violation {
  created_at: string;
  user_email?: string;
  violation_type: string;
  target_table?: string;
  target_action?: string;
  details: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { violations } = req.body as { violations: Violation[] };
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI service not configured" });

  const violationsSummary = violations
    .map(v => `- [${v.created_at}] ${v.user_email ?? "inconnu"}: ${v.violation_type} sur ${v.target_table ?? "N/A"} (action: ${v.target_action ?? "N/A"}) — Détails: ${JSON.stringify(v.details)}`)
    .join("\n");

  const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Voici les violations de sécurité à analyser :\n\n${violationsSummary}` },
      ],
    }),
  });

  if (!upstream.ok) {
    if (upstream.status === 429) return res.status(429).json({ error: "Limite de requêtes atteinte, réessayez plus tard." });
    if (upstream.status === 402) return res.status(402).json({ error: "Crédits insuffisants." });
    return res.status(500).json({ error: "Erreur du service IA" });
  }

  const result = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
  const analysis = result.choices?.[0]?.message?.content ?? "Analyse non disponible.";
  return res.status(200).json({ analysis });
}
