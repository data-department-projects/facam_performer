
-- ============================================================
-- 1. OBJECTIVE CHANGE AUDIT LOG: lock down
-- ============================================================

-- Remove permissive insert policy (anyone can forge entries)
DROP POLICY "Authenticated users can insert audit logs" ON public.objective_change_audit_log;

-- Remove user/manager visibility (collaborators should not see audit logs)
DROP POLICY "Users can view own audit logs" ON public.objective_change_audit_log;
DROP POLICY "Managers can view subordinate audit logs" ON public.objective_change_audit_log;

-- Admin-only policy already exists ("Admins can manage audit logs" ALL)
-- That's sufficient: only DG/admin can read and write

-- Create a security definer function for inserting audit entries
-- This allows code to insert via function without giving direct INSERT to users
CREATE OR REPLACE FUNCTION public.insert_objective_audit_log(
  _action text,
  _actor_id uuid,
  _actor_role text,
  _change_request_id uuid,
  _objective_id uuid,
  _user_id uuid,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.objective_change_audit_log (action, actor_id, actor_role, change_request_id, objective_id, user_id, details)
  VALUES (_action, _actor_id, _actor_role, _change_request_id, _objective_id, _user_id, _details)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- ============================================================
-- 2. WEEKLY PLANNER AUDIT LOG: lock down
-- ============================================================

-- Remove permissive insert policy
DROP POLICY "Users can insert audit logs" ON public.weekly_planner_audit_log;

-- Remove user/manager visibility
DROP POLICY "Users can view own audit logs" ON public.weekly_planner_audit_log;
DROP POLICY "Managers can view subordinate audit logs" ON public.weekly_planner_audit_log;

-- Admin-only policy already exists ("Admins can manage all audit logs" ALL)

-- Create a security definer function for weekly planner audit
CREATE OR REPLACE FUNCTION public.insert_weekly_planner_audit(
  _action text,
  _actor_id uuid,
  _user_id uuid,
  _week_start text,
  _details jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.weekly_planner_audit_log (action, actor_id, user_id, week_start, details)
  VALUES (_action, _actor_id, _user_id, _week_start, _details)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- ============================================================
-- 3. USER AUDIT LOG: already admin-only, add secure insert function
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_user_audit_log(
  _action text,
  _actor_id uuid,
  _target_user_id uuid DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.user_audit_log (action, actor_id, target_user_id, details)
  VALUES (_action, _actor_id, _target_user_id, _details)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
