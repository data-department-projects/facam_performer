CREATE POLICY "Public can read login design"
ON public.app_organization
FOR SELECT
TO anon
USING (id = 'login_design');