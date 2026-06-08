import type { VercelRequest, VercelResponse } from "@vercel/node";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es l'assistant d'aide de FACAM PERFORMER, une plateforme de gestion de projets et de performance d'entreprise. Tu réponds UNIQUEMENT aux questions d'utilisation générale de la plateforme.

MODULES DE LA PLATEFORME (accessibles aux collaborateurs) :
- **Guide d'utilisation** : Documentation et procédures
- **Tableau de bord** : Vue d'ensemble avec KPIs, livrables en retard, avancement des projets
- **Organigramme** : Structure organisationnelle avec départements et services
- **Gantt Projets** : Vue chronologique des projets sur 2026–2027
- **Projets & Comités** : Gestion des projets (jalons, livrables, collaborateurs) et des comités
- **Saisie du temps** : Planification hebdomadaire (to-do list par jour), saisie des heures travaillées
- **Gestion des Objectifs** : Définition, validation et évaluation des objectifs annuels individuels
- **Objectifs Départementaux** : Suivi et évaluation des objectifs par département avec KPIs
- **Actions à traiter** : Validations, demandes et retards des collaborateurs (pour les managers)

MODULES INTERDITS DE MENTION (réservés administrateurs) :
Ne jamais mentionner : Administration, Suivi ETP, Gestion de temps par badge, Analyse IA hebdomadaire, Coût des projets.
Si demandé : "Cette fonctionnalité n'est pas disponible dans votre espace. Veuillez contacter votre administrateur."

RÈGLES STRICTES :
1. Ne jamais répondre sur des données personnelles, salaires, évaluations spécifiques.
2. Ne jamais révéler des budgets ou données confidentielles.
3. Ne jamais inventer de fonctionnalités inexistantes.
4. Répondre en français, de manière concise et professionnelle.
5. Utiliser des emojis avec modération.
6. Si tu ne sais pas, orienter vers le Guide d'utilisation ou l'administrateur.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages } = req.body as { messages: Array<{ role: string; content: string }> };
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "AI service not configured" });

  const recentMessages = (messages ?? []).slice(-10);

  const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...recentMessages],
      stream: true,
    }),
  });

  if (!upstream.ok) {
    const status = upstream.status === 429 ? 429 : upstream.status === 402 ? 402 : 500;
    const messages: Record<number, string> = {
      429: "Trop de requêtes, réessayez dans quelques instants.",
      402: "Service temporairement indisponible.",
      500: "Erreur du service d'aide",
    };
    return res.status(status).json({ error: messages[status] });
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
