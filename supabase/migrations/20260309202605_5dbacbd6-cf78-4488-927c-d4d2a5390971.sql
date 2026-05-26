
-- Create objective status enum
CREATE TYPE public.objective_status AS ENUM ('draft', 'pending_validation', 'validated', 's1_review', 's2_evaluation', 'completed');

-- Create objectives table
CREATE TABLE public.objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_by uuid NOT NULL,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  weight numeric NOT NULL DEFAULT 0,
  kpi_target text NOT NULL DEFAULT '',
  kpi_unit text NOT NULL DEFAULT '',
  kpi_actual text DEFAULT NULL,
  deadline date DEFAULT NULL,
  status objective_status NOT NULL DEFAULT 'draft',
  achievement_pct numeric NOT NULL DEFAULT 0,
  s1_achievement_pct numeric DEFAULT NULL,
  s1_comment text DEFAULT NULL,
  s1_reviewed_at timestamptz DEFAULT NULL,
  final_achievement_pct numeric DEFAULT NULL,
  final_comment text DEFAULT NULL,
  final_reviewed_at timestamptz DEFAULT NULL,
  validated_by uuid DEFAULT NULL,
  validated_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own objectives
CREATE POLICY "Users can view own objectives" ON public.objectives
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- RLS: Admins can view all objectives
CREATE POLICY "Admins can view all objectives" ON public.objectives
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Authenticated users can create objectives
CREATE POLICY "Users can create objectives" ON public.objectives
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- RLS: Users can update their own draft objectives
CREATE POLICY "Users can update own objectives" ON public.objectives
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- RLS: Admins can manage all objectives
CREATE POLICY "Admins can manage all objectives" ON public.objectives
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Users can delete their own draft objectives
CREATE POLICY "Users can delete own draft objectives" ON public.objectives
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status = 'draft');

-- Updated_at trigger
CREATE TRIGGER update_objectives_updated_at
  BEFORE UPDATE ON public.objectives
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
