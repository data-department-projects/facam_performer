import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Tu es un analyste stratégique senior spécialisé dans la gestion de projets. Tu produis une analyse hebdomadaire concise et percutante en français.

Ton analyse doit couvrir ces axes :
1. **🚀 Projets les plus dynamiques** — Identifie les projets qui avancent le plus vite (jalons terminés, taux de complétion, livrables déposés à temps).
2. **⭐ Collaborateurs les plus performants** — Mets en avant les collaborateurs qui livrent dans les délais, avec un bon ratio coût/productivité (heures travaillées vs taux horaire vs livrables livrés).
3. **⚠️ Points d'attention** — Projets en retard, collaborateurs en difficulté, coûts qui dérapent.
4. **💰 Analyse financière** — Projets les plus coûteux, collaborateurs avec le meilleur rapport qualité/coût, dépenses supplémentaires notables et qui les a saisies.
5. **📋 Recommandations** — 3 à 5 actions concrètes pour la semaine à venir.

Utilise des emojis, du gras, et des listes pour rendre le rapport lisible. Sois factuel et base-toi uniquement sur les données fournies. Si des données manquent, mentionne-le. Termine par une note globale sur la santé des projets.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Voici les données des projets pour l'analyse hebdomadaire :\n\n${JSON.stringify(projectData, null, 2)}`,
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez dans quelques minutes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants. Ajoutez des crédits dans les paramètres." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service d'analyse IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("weekly-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
