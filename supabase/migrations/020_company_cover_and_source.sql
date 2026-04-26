-- Fix 1: Add cover_image_url for company hero banner
-- (header_image_url already exists; cover_image_url is an alias for new usage)
ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Fix 6: Add data_source + data_updated_at for metric attribution
ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS data_source text;

ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS data_updated_at timestamptz;

-- Backfill cover_image_url from header_image_url if not set
UPDATE ow_companies
SET cover_image_url = header_image_url
WHERE cover_image_url IS NULL AND header_image_url IS NOT NULL;
