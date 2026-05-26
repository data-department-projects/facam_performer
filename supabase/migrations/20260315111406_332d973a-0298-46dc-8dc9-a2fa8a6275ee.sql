
-- 1. Create a public view WITHOUT sensitive columns (salary, manager_bonus_budget)
-- This view is owned by postgres and bypasses RLS, exposing only safe columns
CREATE VIEW public.profiles_public AS
SELECT id, user_id, full_name, email, department_id, service, poste,
       is_manager, hierarchy_user_id, category, badge_number, avatar_url,
       must_change_password, created_at, updated_at
FROM public.profiles;

-- Grant access to authenticated and anon roles
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO anon;

-- 2. Remove the blanket SELECT policy that exposes ALL columns (including salary) to everyone
DROP POLICY "All authenticated users can read profiles" ON public.profiles;

-- 3. Add a restricted policy: non-admin authenticated users can only read their own row
-- (Admins already have full access via "Admins can view all profiles" policy)
-- Managers need to see subordinate profiles for hierarchy features
CREATE POLICY "Managers can read subordinate profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_manager = true
      AND profiles.hierarchy_user_id = auth.uid()
  )
);
