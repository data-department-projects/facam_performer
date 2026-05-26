
-- ============================================================
-- 1. FIX PERMISSIVE RLS: Remove USING(true) INSERT/UPDATE/DELETE
-- ============================================================

-- APP_DEPARTMENTS: remove blanket policies, keep admin-only
DROP POLICY "Authenticated users can delete departments" ON public.app_departments;
DROP POLICY "Authenticated users can insert departments" ON public.app_departments;
DROP POLICY "Authenticated users can update departments" ON public.app_departments;

-- APP_PROJECTS: remove blanket policies, keep admin-only
DROP POLICY "Authenticated users can delete projects" ON public.app_projects;
DROP POLICY "Authenticated users can insert projects" ON public.app_projects;
DROP POLICY "Authenticated users can update projects" ON public.app_projects;

-- APP_COMMITTEES: remove blanket policies, keep admin-only
DROP POLICY "Authenticated users can delete committees" ON public.app_committees;
DROP POLICY "Authenticated users can insert committees" ON public.app_committees;
DROP POLICY "Authenticated users can update committees" ON public.app_committees;

-- APP_ORGANIZATION: remove blanket policies, keep admin-only
DROP POLICY "Authenticated users can delete organization" ON public.app_organization;
DROP POLICY "Authenticated users can insert organization" ON public.app_organization;
DROP POLICY "Authenticated users can update organization" ON public.app_organization;

-- ============================================================
-- 2. SECURITY VIOLATIONS TABLE + AUTO-BLOCK SYSTEM
-- ============================================================

-- Add blocked column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_reason text;

-- Security violations table
CREATE TABLE public.security_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  violation_type text NOT NULL, -- 'rls_bypass_attempt', 'unauthorized_access', 'data_tampering', 'suspicious_activity'
  target_table text,
  target_action text, -- 'insert', 'update', 'delete', 'select'
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.security_violations ENABLE ROW LEVEL SECURITY;

-- Only admins can read violations
CREATE POLICY "Admins can manage security violations"
ON public.security_violations FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Security definer function to log violations (callable by anyone but inserts securely)
CREATE OR REPLACE FUNCTION public.log_security_violation(
  _violation_type text,
  _target_table text DEFAULT NULL,
  _target_action text DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _user_email text;
  _violation_count int;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RETURN; END IF;

  -- Get user email
  SELECT email INTO _user_email FROM profiles WHERE user_id = _user_id LIMIT 1;

  -- Insert violation record
  INSERT INTO security_violations (user_id, user_email, violation_type, target_table, target_action, details)
  VALUES (_user_id, _user_email, _violation_type, _target_table, _target_action, _details);

  -- Count violations in last 24 hours
  SELECT COUNT(*) INTO _violation_count
  FROM security_violations
  WHERE user_id = _user_id
    AND created_at > now() - interval '24 hours';

  -- Auto-block after 3 violations in 24h
  IF _violation_count >= 3 THEN
    UPDATE profiles
    SET is_blocked = true,
        blocked_at = now(),
        blocked_reason = 'Auto-bloqué : ' || _violation_count || ' tentatives de violation de sécurité en 24h'
    WHERE user_id = _user_id;
  END IF;
END;
$$;

-- Function to check if user is blocked (used by frontend)
CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_blocked FROM profiles WHERE user_id = _user_id LIMIT 1),
    false
  )
$$;

-- Admin function to unblock a user
CREATE OR REPLACE FUNCTION public.unblock_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Seul l''administrateur peut débloquer un compte.';
  END IF;
  
  UPDATE profiles
  SET is_blocked = false, blocked_at = NULL, blocked_reason = NULL
  WHERE user_id = _user_id;
END;
$$;
