
-- Fix tautology bug: p.department_id = p.department_id → p.department_id = department_objectives.department_id

-- 1. Fix INSERT policy
DROP POLICY "Dept heads can insert dept objectives" ON public.department_objectives;
CREATE POLICY "Dept heads can insert dept objectives"
ON public.department_objectives FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN app_departments d ON d.id = p.department_id
    WHERE p.user_id = auth.uid()
      AND p.department_id = department_objectives.department_id
      AND (d.data ->> 'head') = p.full_name
  )
);

-- 2. Fix UPDATE policy
DROP POLICY "Dept heads can update dept objectives" ON public.department_objectives;
CREATE POLICY "Dept heads can update dept objectives"
ON public.department_objectives FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN app_departments d ON d.id = p.department_id
    WHERE p.user_id = auth.uid()
      AND p.department_id = department_objectives.department_id
      AND (d.data ->> 'head') = p.full_name
  )
);
