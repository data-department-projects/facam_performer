-- Allow managers to view change requests from their subordinates
CREATE POLICY "Managers can view subordinate change requests"
ON public.objective_change_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_manager = true
      AND objective_change_requests.user_id IN (
        SELECT sub.user_id FROM public.profiles sub WHERE sub.hierarchy_user_id = auth.uid()
      )
  )
);

-- Allow managers to update change requests from their subordinates
CREATE POLICY "Managers can update subordinate change requests"
ON public.objective_change_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_manager = true
      AND objective_change_requests.user_id IN (
        SELECT sub.user_id FROM public.profiles sub WHERE sub.hierarchy_user_id = auth.uid()
      )
  )
);