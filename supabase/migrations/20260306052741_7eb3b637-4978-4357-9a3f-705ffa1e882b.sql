ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS poste text DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hierarchy_user_id uuid DEFAULT NULL;