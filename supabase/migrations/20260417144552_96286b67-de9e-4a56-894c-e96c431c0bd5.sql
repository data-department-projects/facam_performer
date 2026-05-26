
-- Allow users with can_create_projects to insert/update/delete projects
CREATE POLICY "Users with permission can insert projects"
ON public.app_projects FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_create_permissions WHERE user_id = auth.uid() AND can_create_projects = true));

CREATE POLICY "Users with permission can update projects"
ON public.app_projects FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_create_permissions WHERE user_id = auth.uid() AND can_create_projects = true));

CREATE POLICY "Users with permission can delete projects"
ON public.app_projects FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_create_permissions WHERE user_id = auth.uid() AND can_create_projects = true));

-- Allow users with can_create_committees to insert/update/delete committees
CREATE POLICY "Users with permission can insert committees"
ON public.app_committees FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_create_permissions WHERE user_id = auth.uid() AND can_create_committees = true));

CREATE POLICY "Users with permission can update committees"
ON public.app_committees FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_create_permissions WHERE user_id = auth.uid() AND can_create_committees = true));

CREATE POLICY "Users with permission can delete committees"
ON public.app_committees FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_create_permissions WHERE user_id = auth.uid() AND can_create_committees = true));
