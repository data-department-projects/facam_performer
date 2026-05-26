
-- Create storage bucket for login design assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('login-assets', 'login-assets', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp']);

-- Allow authenticated users to upload to login-assets
CREATE POLICY "Authenticated users can upload login assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'login-assets');

-- Allow public read access
CREATE POLICY "Public can read login assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'login-assets');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update login assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'login-assets');

-- Allow authenticated users to delete login assets
CREATE POLICY "Authenticated users can delete login assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'login-assets');
