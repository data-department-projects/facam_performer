
CREATE TABLE public.department_objective_kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objective_id UUID NOT NULL REFERENCES public.department_objectives(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  target_value NUMERIC NOT NULL DEFAULT 0,
  actual_value NUMERIC DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.department_objective_kpis ENABLE ROW LEVEL SECURITY;

-- All authenticated can read
CREATE POLICY "Authenticated users can read dept objective kpis"
ON public.department_objective_kpis FOR SELECT TO authenticated
USING (true);

-- Admins can do everything
CREATE POLICY "Admins can manage dept objective kpis"
ON public.department_objective_kpis FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Department heads can insert
CREATE POLICY "Dept heads can insert kpis"
ON public.department_objective_kpis FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.department_objectives do2
    JOIN public.profiles p ON p.user_id = auth.uid()
    JOIN public.app_departments d ON d.id = do2.department_id
    WHERE do2.id = objective_id
      AND p.department_id = do2.department_id
      AND (d.data->>'head') = p.full_name
  )
);

-- Department heads can update
CREATE POLICY "Dept heads can update kpis"
ON public.department_objective_kpis FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.department_objectives do2
    JOIN public.profiles p ON p.user_id = auth.uid()
    JOIN public.app_departments d ON d.id = do2.department_id
    WHERE do2.id = objective_id
      AND p.department_id = do2.department_id
      AND (d.data->>'head') = p.full_name
  )
);

-- Department heads can delete
CREATE POLICY "Dept heads can delete kpis"
ON public.department_objective_kpis FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.department_objectives do2
    JOIN public.profiles p ON p.user_id = auth.uid()
    JOIN public.app_departments d ON d.id = do2.department_id
    WHERE do2.id = objective_id
      AND p.department_id = do2.department_id
      AND (d.data->>'head') = p.full_name
  )
);
