-- Allow managers to manage objectives of their direct reports
CREATE POLICY "Managers can view subordinate objectives"
ON public.objectives
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_manager = true
      AND objectives.user_id IN (
        SELECT sub.user_id FROM public.profiles sub WHERE sub.hierarchy_user_id = auth.uid()
      )
  )
);

CREATE POLICY "Managers can insert subordinate objectives"
ON public.objectives
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_manager = true
      AND objectives.user_id IN (
        SELECT sub.user_id FROM public.profiles sub WHERE sub.hierarchy_user_id = auth.uid()
      )
  )
);

CREATE POLICY "Managers can update subordinate objectives"
ON public.objectives
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_manager = true
      AND objectives.user_id IN (
        SELECT sub.user_id FROM public.profiles sub WHERE sub.hierarchy_user_id = auth.uid()
      )
  )
);

CREATE POLICY "Managers can delete subordinate draft objectives"
ON public.objectives
FOR DELETE
TO authenticated
USING (
  objectives.status IN ('draft', 'pending_validation')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_manager = true
      AND objectives.user_id IN (
        SELECT sub.user_id FROM public.profiles sub WHERE sub.hierarchy_user_id = auth.uid()
      )
  )
);