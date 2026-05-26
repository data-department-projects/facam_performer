
-- Add badgemanagement to app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'badgemanagement';

-- Create badge_entries table
CREATE TABLE public.badge_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  badge_date date NOT NULL DEFAULT CURRENT_DATE,
  swipe_1 time without time zone DEFAULT NULL,
  swipe_2 time without time zone DEFAULT NULL,
  swipe_3 time without time zone DEFAULT NULL,
  swipe_4 time without time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_date)
);

-- Enable RLS
ALTER TABLE public.badge_entries ENABLE ROW LEVEL SECURITY;

-- Only admins can manage badge entries
CREATE POLICY "Admins can manage badge entries"
  ON public.badge_entries
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own badge entries
CREATE POLICY "Users can view own badge entries"
  ON public.badge_entries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
