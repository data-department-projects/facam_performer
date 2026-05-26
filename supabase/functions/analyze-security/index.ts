import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { violations } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const violationsSummary = violations.map((v: any) => 
      `- [${v.created_at}] ${v.user_email || 'inconnu'}: ${v.violation_type} sur ${v.target_table || 'N/A'} (action: ${v.target_action || 'N/A'}) — Détails: ${JSON.stringify(v.details)}`
    ).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Tu es un expert en cybersécurité et audit informatique pour une plateforme de gestion d'entreprise. 
Analyse les violations de sécurité fournies et produis un rapport structuré en français avec :

1. **Résumé exécutif** : Vue d'ensemble des menaces détectées
2. **Analyse par utilisateur** : Pour chaque utilisateur impliqué, décris le profil de risque et les patterns d'attaque
3. **Classification des menaces** : Classe chaque violation (Critique/Élevé/Moyen/Faible) avec justification
4. **Intentions probables** : Déduis ce que chaque utilisateur tentait de faire et pourquoi
5. **Recommandations** : Actions correctives à prendre

Sois précis, factuel et professionnel. Utilise des emojis pour la gravité (🔴 Critique, 🟠 Élevé, 🟡 Moyen, 🟢 Faible).`
          },
          {
            role: "user",
            content: `Voici les violations de sécurité à analyser :\n\n${violationsSummary}`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez plus tard." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const analysis = result.choices?.[0]?.message?.content || "Analyse non disponible.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-security error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
