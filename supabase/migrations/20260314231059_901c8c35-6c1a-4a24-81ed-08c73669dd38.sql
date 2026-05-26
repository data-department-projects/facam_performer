-- Create storage bucket for campaign images
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-images', 'campaign-images', true);

-- Allow authenticated users to upload campaign images
CREATE POLICY "Admins can upload campaign images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'campaign-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete campaign images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'campaign-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read campaign images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'campaign-images');

-- Add max_views column to campaign_animations
ALTER TABLE campaign_animations ADD COLUMN max_views integer DEFAULT NULL;