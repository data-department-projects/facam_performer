
CREATE TABLE public.user_create_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  can_create_projects boolean NOT NULL DEFAULT false,
  can_create_committees boolean NOT NULL DEFAULT false
);

ALTER TABLE public.user_create_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage create permissions"
  ON public.user_create_permissions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own create permissions"
  ON public.user_create_permissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
