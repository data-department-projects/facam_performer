
CREATE TABLE public.action_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  action_ref_id text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, action_type, action_ref_id)
);

ALTER TABLE public.action_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own acknowledgements"
  ON public.action_acknowledgements
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all acknowledgements"
  ON public.action_acknowledgements
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
