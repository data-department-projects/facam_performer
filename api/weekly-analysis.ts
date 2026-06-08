import type { VercelRequest, VercelResponse } from "@vercel/node";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es un analyste stratégique senior spécialisé dans la gestion de projets. Tu produis une analyse hebdomadaire concise et percutante en français.

Ton analyse doit couvrir ces axes :
1. **🚀 Projets les plus dynamiques** — Projets qui avancent le plus vite (jalons terminés, taux de complétion, livrables déposés à temps).
2. **⭐ Collaborateurs les plus performants** — Ceux qui livrent dans les délais, avec un bon ratio coût/productivité.
3. **⚠️ Points d'attention** — Projets en retard, collaborateurs en difficulté, coûts qui dérapent.
4. **💰 Analyse financière** — Projets les plus coûteux, meilleur rapport qualité/coût, dépenses notables.
5. **📋 Recommandations** — 3 à 5 actions concrètes pour la semaine à venir.

Utilise des emojis, du gras, et des listes. Sois factuel, base-toi uniquement sur les données fournies. Termine par une note globale sur la santé des projets.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { projectData } = req.body as { projectData: unknown };
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI service not configured" });

  const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Voici les données des projets pour l'analyse hebdomadaire :\n\n${JSON.stringify(projectData, null, 2)}`,
        },
      ],
      stream: true,
    }),
  });

  if (!upstream.ok) {
    const status = upstream.status === 429 ? 429 : upstream.status === 402 ? 402 : 500;
    const msgs: Record<number, string> = {
      429: "Limite de requêtes atteinte, réessayez dans quelques minutes.",
      402: "Crédits insuffisants. Ajoutez des crédits dans les paramètres.",
      500: "Erreur du service d'analyse IA",
    };
    return res.status(status).json({ error: msgs[status] });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const reader = upstream.body?.getReader();
  if (!reader) return res.status(500).json({ error: "No response body" });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}
