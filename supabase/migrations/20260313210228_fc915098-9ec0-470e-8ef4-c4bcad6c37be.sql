
-- Create backups storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: only admins can read backups
CREATE POLICY "Admins can read backups"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups'
  AND public.has_role(auth.uid(), 'admin')
);

-- RLS: service role (edge function) inserts via service key, but also allow admin insert
CREATE POLICY "Admins can insert backups"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'backups'
  AND public.has_role(auth.uid(), 'admin')
);

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Table to store backup schedule config
CREATE TABLE IF NOT EXISTS public.backup_schedule (
  id TEXT PRIMARY KEY DEFAULT 'default',
  day_of_week INTEGER NOT NULL DEFAULT 0,
  hour INTEGER NOT NULL DEFAULT 2,
  cron_job_id BIGINT,
  last_backup_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage backup_schedule"
ON public.backup_schedule FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
