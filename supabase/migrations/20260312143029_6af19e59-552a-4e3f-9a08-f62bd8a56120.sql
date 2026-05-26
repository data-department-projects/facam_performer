
-- Week-level planner status
CREATE TABLE public.weekly_planner_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft, submitted, validated, rejected
  submitted_at timestamptz,
  validated_at timestamptz,
  validated_by uuid,
  manager_comment text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE public.weekly_planner_status ENABLE ROW LEVEL SECURITY;

-- Users can view their own
CREATE POLICY "Users can view own planner status"
  ON public.weekly_planner_status FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own
CREATE POLICY "Users can insert own planner status"
  ON public.weekly_planner_status FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update own (for submitting)
CREATE POLICY "Users can update own planner status"
  ON public.weekly_planner_status FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Managers can view subordinates
CREATE POLICY "Managers can view subordinate planner status"
  ON public.weekly_planner_status FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.is_manager = true
    AND weekly_planner_status.user_id IN (
      SELECT sub.user_id FROM profiles sub WHERE sub.hierarchy_user_id = auth.uid()
    )
  ));

-- Managers can update subordinates (validate/reject)
CREATE POLICY "Managers can update subordinate planner status"
  ON public.weekly_planner_status FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.is_manager = true
    AND weekly_planner_status.user_id IN (
      SELECT sub.user_id FROM profiles sub WHERE sub.hierarchy_user_id = auth.uid()
    )
  ));

-- Admins full access
CREATE POLICY "Admins can manage all planner status"
  ON public.weekly_planner_status FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Audit log
CREATE TABLE public.weekly_planner_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  action text NOT NULL, -- submitted, validated, rejected, task_added, task_modified, task_deleted
  actor_id uuid NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_planner_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON public.weekly_planner_audit_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert audit logs"
  ON public.weekly_planner_audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can view subordinate audit logs"
  ON public.weekly_planner_audit_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.is_manager = true
    AND weekly_planner_audit_log.user_id IN (
      SELECT sub.user_id FROM profiles sub WHERE sub.hierarchy_user_id = auth.uid()
    )
  ));

CREATE POLICY "Admins can manage all audit logs"
  ON public.weekly_planner_audit_log FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
