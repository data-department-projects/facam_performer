
-- Campaign animations table
CREATE TABLE public.campaign_animations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  logo_url text DEFAULT NULL,
  custom_image_url text DEFAULT NULL,
  button_label text DEFAULT NULL,
  button_url text DEFAULT NULL,
  duration_seconds integer NOT NULL DEFAULT 6,
  trigger_type text NOT NULL DEFAULT 'first_login',
  date_start date DEFAULT NULL,
  date_end date DEFAULT NULL,
  recurrence text DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- RLS
ALTER TABLE public.campaign_animations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage campaign animations"
  ON public.campaign_animations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read active campaigns"
  ON public.campaign_animations FOR SELECT TO authenticated
  USING (is_active = true);

-- Track which user has seen which campaign
CREATE TABLE public.campaign_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaign_animations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, user_id)
);

ALTER TABLE public.campaign_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own campaign views"
  ON public.campaign_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own campaign views"
  ON public.campaign_views FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage campaign views"
  ON public.campaign_views FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
