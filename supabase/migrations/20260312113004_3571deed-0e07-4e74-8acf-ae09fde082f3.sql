
CREATE TABLE public.objective_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  objective_id uuid NOT NULL,
  request_type text NOT NULL DEFAULT 'modification',
  field_name text,
  old_value text,
  new_value text,
  explanation text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.objective_change_requests ENABLE ROW LEVEL SECURITY;

-- Users can create requests for their own objectives
CREATE POLICY "Users can create objective change requests"
  ON public.objective_change_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own requests
CREATE POLICY "Users can view own objective change requests"
  ON public.objective_change_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can manage all
CREATE POLICY "Admins can manage objective change requests"
  ON public.objective_change_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
