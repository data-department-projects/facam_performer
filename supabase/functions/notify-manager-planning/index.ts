import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { user_id, week_start } = await req.json()

    if (!user_id || !week_start) {
      return new Response(JSON.stringify({ error: 'Missing user_id or week_start' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get submitter profile
    const { data: submitter } = await supabaseAdmin
      .from('profiles')
      .select('full_name, hierarchy_user_id')
      .eq('user_id', user_id)
      .single()

    if (!submitter?.hierarchy_user_id) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no manager' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get manager email
    const { data: manager } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', submitter.hierarchy_user_id)
      .single()

    if (!manager?.email) {
      return new Response(JSON.stringify({ ok: true, skipped: 'manager has no email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Enqueue email via pgmq
    const emailPayload = {
      to: manager.email,
      subject: `Planning soumis par ${submitter.full_name} — Semaine du ${week_start}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #C8963E; margin-bottom: 16px;">📋 Nouveau planning à valider</h2>
          <p>Bonjour <strong>${manager.full_name}</strong>,</p>
          <p><strong>${submitter.full_name}</strong> a soumis son planning hebdomadaire pour la <strong>semaine du ${week_start}</strong>.</p>
          <p>Connectez-vous à l'application pour le valider ou le refuser.</p>
          <div style="margin-top: 24px; padding: 12px 24px; background-color: #C8963E; color: white; text-align: center; border-radius: 8px; display: inline-block;">
            <a href="https://facamstrategicroadmap.lovable.app" style="color: white; text-decoration: none; font-weight: bold;">Accéder à l'application</a>
          </div>
          <p style="margin-top: 24px; font-size: 12px; color: #999;">FACAM Performer — Work Space</p>
        </div>
      `,
      from_name: 'FACAM Performer',
    }

    await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: emailPayload,
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
