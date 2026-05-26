
-- Add dept_objectives to app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'dept_objectives';

-- Create department_objectives table
CREATE TABLE public.department_objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  year INTEGER NOT NULL DEFAULT (EXTRACT(year FROM now()))::integer,
  status public.objective_status NOT NULL DEFAULT 'draft',
  bonus NUMERIC DEFAULT 0,
  achievement_pct NUMERIC NOT NULL DEFAULT 0,
  s1_achievement_pct NUMERIC,
  s1_comment TEXT,
  s1_reviewed_at TIMESTAMPTZ,
  final_achievement_pct NUMERIC,
  final_comment TEXT,
  final_reviewed_at TIMESTAMPTZ,
  deadline DATE,
  created_by UUID NOT NULL,
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.department_objectives ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can read dept objectives"
ON public.department_objectives FOR SELECT TO authenticated
USING (true);

-- Admins can do everything
CREATE POLICY "Admins can manage dept objectives"
ON public.department_objectives FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Department heads can insert/update for their department
CREATE POLICY "Dept heads can insert dept objectives"
ON public.department_objectives FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.app_departments d ON d.id = department_id
    WHERE p.user_id = auth.uid()
      AND p.department_id = department_id
      AND (d.data->>'head') = p.full_name
  )
);

CREATE POLICY "Dept heads can update dept objectives"
ON public.department_objectives FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.app_departments d ON d.id = department_id
    WHERE p.user_id = auth.uid()
      AND p.department_id = department_id
      AND (d.data->>'head') = p.full_name
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_dept_objectives_updated_at
  BEFORE UPDATE ON public.department_objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
