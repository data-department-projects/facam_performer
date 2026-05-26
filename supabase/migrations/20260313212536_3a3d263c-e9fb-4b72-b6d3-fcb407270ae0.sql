
-- Drop existing restrictive policies on backups bucket
DROP POLICY IF EXISTS "Admins can read backups" ON storage.objects;
DROP POLICY IF EXISTS "Admins can insert backups" ON storage.objects;

-- Allow authenticated admins to SELECT (list + download) backups
CREATE POLICY "Admins can read backups"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow authenticated admins to INSERT backups
CREATE POLICY "Admins can insert backups"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'backups'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow authenticated admins to DELETE backups
CREATE POLICY "Admins can delete backups"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'backups'
  AND public.has_role(auth.uid(), 'admin')
);

-- Also allow service_role (used by edge function) - create permissive policy for service role uploads
-- The edge function uses service_role key which bypasses RLS, so this is just for the client-side operations
