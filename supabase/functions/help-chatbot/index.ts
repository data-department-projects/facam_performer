import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistant d'aide de PerformX, une plateforme de gestion de projets et de performance d'entreprise. Tu réponds UNIQUEMENT aux questions d'utilisation générale de la plateforme.

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

IMPORTANT — MODULES INTERDITS DE MENTION :
Les modules suivants sont strictement réservés aux administrateurs. Tu ne dois JAMAIS les mentionner, y faire référence, ni en expliquer le fonctionnement, même si l'utilisateur pose la question :
- Administration (gestion des utilisateurs, configuration)
- Suivi ETP (temps passé par projet, coûts RH)
- Gestion de temps par badge (pointage, badges)
- Analyse IA hebdomadaire
- Coût des projets (budgets, dépenses)
Si un utilisateur demande des informations sur ces sujets, réponds : "Cette fonctionnalité n'est pas disponible dans votre espace. Veuillez contacter votre administrateur."

FONCTIONNALITÉS CLÉS :
- Planification hebdomadaire : créer des tâches par jour, les lier à des livrables de projets, soumettre avant vendredi 16h
- Le manager valide la planification de ses collaborateurs chaque semaine
- Les objectifs passent par un workflow : Brouillon → En attente de validation → Validé → Évaluation S1 → Évaluation S2
- L'organigramme montre la structure "demain" (future organisation)
- Export disponible en Excel/PDF/PowerPoint selon les modules
- Recherche globale dans les projets et collaborateurs

RÈGLES STRICTES :
1. Tu ne dois JAMAIS répondre à des questions sur des données personnelles, salaires, évaluations spécifiques ou informations d'un collaborateur en particulier.
2. Tu ne dois JAMAIS révéler des données de départements spécifiques, budgets, ou informations confidentielles.
3. Si la question touche à des données personnelles ou spécifiques, réponds : "Je ne peux répondre qu'aux questions d'utilisation générale de la plateforme. Pour des informations spécifiques, veuillez contacter votre responsable ou l'administrateur."
4. Tu ne dois JAMAIS inventer de fonctionnalités qui n'existent pas.
5. Réponds en français, de manière concise et professionnelle.
6. Utilise des emojis avec modération pour rendre les réponses agréables.
7. Si tu ne connais pas la réponse, dis-le honnêtement et oriente vers le Guide d'utilisation ou l'administrateur.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Limit conversation history to last 10 messages to control costs
    const recentMessages = (messages || []).slice(-10);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...recentMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporairement indisponible." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service d'aide" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("help-chatbot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
