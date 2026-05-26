
CREATE OR REPLACE FUNCTION public.update_backup_cron(_day_of_week integer, _hour integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cron_expr text;
  _job_id bigint;
BEGIN
  _cron_expr := '0 ' || _hour || ' * * ' || _day_of_week;

  -- Remove existing job
  PERFORM cron.unschedule('weekly-backup');

  -- Create new cron job  
  SELECT cron.schedule(
    'weekly-backup',
    _cron_expr,
    format(
      $cmd$
      SELECT net.http_post(
        url := '%s/functions/v1/scheduled-backup',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body := '{}'::jsonb
      ) AS request_id;
      $cmd$,
      'https://faqlafabgmlfxnyyvznq.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcWxhZmFiZ21sZnhueXl2em5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTgxMjUsImV4cCI6MjA4ODMzNDEyNX0.PuseQiC45OKr6NcEynUCdSIdJ21XlL18jmg_rB4-fWc'
    )
  ) INTO _job_id;

  UPDATE backup_schedule
  SET day_of_week = _day_of_week,
      hour = _hour,
      cron_job_id = _job_id,
      updated_at = now()
  WHERE id = 'default';
END;
$$;
