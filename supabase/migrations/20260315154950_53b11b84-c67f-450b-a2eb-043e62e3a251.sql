
-- Table for production managers to plan team work schedules
CREATE TABLE public.team_work_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  week_start date NOT NULL,
  team_name text NOT NULL DEFAULT '',
  work_days integer[] NOT NULL DEFAULT '{}',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(manager_id, week_start, team_name)
);

ALTER TABLE public.team_work_schedules ENABLE ROW LEVEL SECURITY;

-- Admins can manage all
CREATE POLICY "Admins can manage team schedules"
  ON public.team_work_schedules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Managers can manage their own schedules
CREATE POLICY "Managers can manage own team schedules"
  ON public.team_work_schedules FOR ALL TO authenticated
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- Team members can view schedules from their manager
CREATE POLICY "Users can view their manager schedules"
  ON public.team_work_schedules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.hierarchy_user_id = team_work_schedules.manager_id
    )
  );
