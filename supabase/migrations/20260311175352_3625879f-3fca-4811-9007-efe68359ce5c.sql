
DROP POLICY IF EXISTS "Users can delete own draft objectives" ON public.objectives;

CREATE POLICY "Users can delete own draft or pending objectives"
ON public.objectives
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id 
  AND status IN ('draft', 'pending_validation')
);
