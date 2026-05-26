CREATE TABLE public.objective_change_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id uuid NOT NULL,
  objective_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid NOT NULL,
  actor_role text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.objective_change_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins can manage audit logs"
ON public.objective_change_audit_log
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Any authenticated user can insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
ON public.objective_change_audit_log
FOR INSERT TO authenticated
WITH CHECK (true);

-- Users can view audit logs for their own requests
CREATE POLICY "Users can view own audit logs"
ON public.objective_change_audit_log
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Managers can view subordinate audit logs
CREATE POLICY "Managers can view subordinate audit logs"
ON public.objective_change_audit_log
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_manager = true
      AND objective_change_audit_log.user_id IN (
        SELECT sub.user_id FROM public.profiles sub WHERE sub.hierarchy_user_id = auth.uid()
      )
  )
);