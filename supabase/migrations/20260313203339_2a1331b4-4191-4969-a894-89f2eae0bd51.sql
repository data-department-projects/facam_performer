
CREATE TABLE public.operational_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  time text,
  participant_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage operational meetings"
ON public.operational_meetings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read operational meetings"
ON public.operational_meetings FOR SELECT
TO authenticated
USING (true);
