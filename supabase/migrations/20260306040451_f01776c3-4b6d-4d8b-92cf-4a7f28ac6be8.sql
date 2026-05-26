
-- Table for profiles exempt from time entry deadline rules
CREATE TABLE public.time_entry_exemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  reason TEXT NOT NULL DEFAULT '',
  granted_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entry_exemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage exemptions" ON public.time_entry_exemptions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own exemption" ON public.time_entry_exemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
