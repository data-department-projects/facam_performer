ALTER TABLE campaign_views ADD COLUMN view_count integer NOT NULL DEFAULT 1;

-- Drop the unique constraint to allow the upsert to update view_count
-- First find and drop the constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_views_campaign_id_user_id_key') THEN
    ALTER TABLE campaign_views DROP CONSTRAINT campaign_views_campaign_id_user_id_key;
  END IF;
END $$;

-- Re-add unique constraint for upsert to work
ALTER TABLE campaign_views ADD CONSTRAINT campaign_views_campaign_id_user_id_key UNIQUE (campaign_id, user_id);