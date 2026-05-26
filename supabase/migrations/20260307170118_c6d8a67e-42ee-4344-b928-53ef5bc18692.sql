
-- Allow all authenticated users to INSERT, UPDATE, DELETE on app_departments
CREATE POLICY "Authenticated users can insert departments"
ON public.app_departments FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update departments"
ON public.app_departments FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete departments"
ON public.app_departments FOR DELETE TO authenticated
USING (true);

-- Allow all authenticated users to INSERT, UPDATE, DELETE on app_committees
CREATE POLICY "Authenticated users can insert committees"
ON public.app_committees FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update committees"
ON public.app_committees FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete committees"
ON public.app_committees FOR DELETE TO authenticated
USING (true);

-- Allow all authenticated users to INSERT, UPDATE, DELETE on app_organization
CREATE POLICY "Authenticated users can insert organization"
ON public.app_organization FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update organization"
ON public.app_organization FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete organization"
ON public.app_organization FOR DELETE TO authenticated
USING (true);

-- Allow all authenticated users to INSERT, UPDATE, DELETE on app_projects
CREATE POLICY "Authenticated users can insert projects"
ON public.app_projects FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update projects"
ON public.app_projects FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete projects"
ON public.app_projects FOR DELETE TO authenticated
USING (true);

-- Allow all authenticated users to UPDATE and DELETE on app_time_entries
CREATE POLICY "Authenticated users can update time entries"
ON public.app_time_entries FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete time entries"
ON public.app_time_entries FOR DELETE TO authenticated
USING (true);
