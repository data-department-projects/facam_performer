
-- Add user_id and validated columns to app_time_entries
ALTER TABLE public.app_time_entries ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.app_time_entries ADD COLUMN IF NOT EXISTS validated boolean NOT NULL DEFAULT true;

-- Backfill user_id from data jsonb where possible (collaboratorName match)
-- We'll handle this in code going forward

-- Drop all existing permissive RLS policies on app_time_entries
DROP POLICY IF EXISTS "Admins can manage time entries" ON public.app_time_entries;
DROP POLICY IF EXISTS "Authenticated users can delete time entries" ON public.app_time_entries;
DROP POLICY IF EXISTS "Authenticated users can insert time entries" ON public.app_time_entries;
DROP POLICY IF EXISTS "Authenticated users can read time entries" ON public.app_time_entries;
DROP POLICY IF EXISTS "Authenticated users can update time entries" ON public.app_time_entries;

-- 1. Admin (DG) can do everything
CREATE POLICY "Admins can manage all time entries"
ON public.app_time_entries
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Users can SELECT their own entries
CREATE POLICY "Users can view own time entries"
ON public.app_time_entries
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. Managers can SELECT their subordinates' entries
CREATE POLICY "Managers can view subordinate time entries"
ON public.app_time_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_manager = true
      AND app_time_entries.user_id IN (
        SELECT sub.user_id FROM profiles sub WHERE sub.hierarchy_user_id = auth.uid()
      )
  )
);

-- 4. Users can INSERT their own entries
CREATE POLICY "Users can insert own time entries"
ON public.app_time_entries
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 5. Users can UPDATE their own entries ONLY if not validated
CREATE POLICY "Users can update own unvalidated time entries"
ON public.app_time_entries
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND validated = false);

-- 6. Users can DELETE their own entries ONLY if not validated
CREATE POLICY "Users can delete own unvalidated time entries"
ON public.app_time_entries
FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND validated = false);
