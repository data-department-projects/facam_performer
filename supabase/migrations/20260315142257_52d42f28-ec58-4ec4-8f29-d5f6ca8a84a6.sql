
-- 1. Create a SECURITY DEFINER function to check if current user is manager of a given user
-- This avoids infinite recursion when profiles RLS policies reference profiles table
CREATE OR REPLACE FUNCTION public.is_manager_of(_subordinate_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND is_manager = true
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _subordinate_user_id
      AND hierarchy_user_id = auth.uid()
  )
$$;

-- 2. Fix profiles: drop recursive manager policy and recreate with security definer function
DROP POLICY IF EXISTS "Managers can read subordinate profiles" ON public.profiles;

CREATE POLICY "Managers can read subordinate profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (hierarchy_user_id = auth.uid() AND public.is_manager_of(user_id));

-- 3. Fix objective_change_requests: drop and recreate manager policies
DROP POLICY IF EXISTS "Managers can view subordinate change requests" ON public.objective_change_requests;
DROP POLICY IF EXISTS "Managers can update subordinate change requests" ON public.objective_change_requests;

CREATE POLICY "Managers can view subordinate change requests"
ON public.objective_change_requests
FOR SELECT
TO authenticated
USING (public.is_manager_of(user_id));

CREATE POLICY "Managers can update subordinate change requests"
ON public.objective_change_requests
FOR UPDATE
TO authenticated
USING (public.is_manager_of(user_id));

-- 4. Fix objectives: drop and recreate manager policies  
DROP POLICY IF EXISTS "Managers can view subordinate objectives" ON public.objectives;
DROP POLICY IF EXISTS "Managers can update subordinate objectives" ON public.objectives;
DROP POLICY IF EXISTS "Managers can insert subordinate objectives" ON public.objectives;
DROP POLICY IF EXISTS "Managers can delete subordinate draft objectives" ON public.objectives;

CREATE POLICY "Managers can view subordinate objectives"
ON public.objectives FOR SELECT TO authenticated
USING (public.is_manager_of(user_id));

CREATE POLICY "Managers can update subordinate objectives"
ON public.objectives FOR UPDATE TO authenticated
USING (public.is_manager_of(user_id));

CREATE POLICY "Managers can insert subordinate objectives"
ON public.objectives FOR INSERT TO authenticated
WITH CHECK (public.is_manager_of(user_id));

CREATE POLICY "Managers can delete subordinate draft objectives"
ON public.objectives FOR DELETE TO authenticated
USING (
  status IN ('draft', 'pending_validation')
  AND public.is_manager_of(user_id)
);

-- 5. Fix app_time_entries: drop and recreate manager policy
DROP POLICY IF EXISTS "Managers can view subordinate time entries" ON public.app_time_entries;

CREATE POLICY "Managers can view subordinate time entries"
ON public.app_time_entries FOR SELECT TO authenticated
USING (public.is_manager_of(user_id));

-- 6. Fix weekly_planner_status: check and add RLS policies
-- First ensure RLS is enabled
ALTER TABLE public.weekly_planner_status ENABLE ROW LEVEL SECURITY;

-- Drop any existing recursive policies
DROP POLICY IF EXISTS "Users can manage own planner status" ON public.weekly_planner_status;
DROP POLICY IF EXISTS "Managers can view subordinate planner status" ON public.weekly_planner_status;
DROP POLICY IF EXISTS "Managers can update subordinate planner status" ON public.weekly_planner_status;
DROP POLICY IF EXISTS "Admins can manage all planner status" ON public.weekly_planner_status;

CREATE POLICY "Users can manage own planner status"
ON public.weekly_planner_status FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers can view subordinate planner status"
ON public.weekly_planner_status FOR SELECT TO authenticated
USING (public.is_manager_of(user_id));

CREATE POLICY "Managers can update subordinate planner status"
ON public.weekly_planner_status FOR UPDATE TO authenticated
USING (public.is_manager_of(user_id));

CREATE POLICY "Admins can manage all planner status"
ON public.weekly_planner_status FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
