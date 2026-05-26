
CREATE TABLE public.user_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_user_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user audit logs"
  ON public.user_audit_log
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_user_audit_log_created_at ON public.user_audit_log(created_at DESC);
CREATE INDEX idx_user_audit_log_action ON public.user_audit_log(action);
CREATE INDEX idx_user_audit_log_target ON public.user_audit_log(target_user_id);
