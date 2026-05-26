ALTER TABLE public.objective_change_requests
  ADD COLUMN manager_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN manager_comment text,
  ADD COLUMN manager_reviewed_by uuid,
  ADD COLUMN manager_reviewed_at timestamptz;