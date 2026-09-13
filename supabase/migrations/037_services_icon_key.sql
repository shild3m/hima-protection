-- Add icon_key for admin-selected service icon and remove slug (no more detail pages)
ALTER TABLE services ADD COLUMN IF NOT EXISTS icon_key text;

-- Map existing slugs to matching icon keys so current services keep their icons
UPDATE services
SET icon_key = CASE slug
  WHEN 'window-tinting' THEN 'tint'
  WHEN 'ppf' THEN 'shield'
  WHEN 'nano-ceramic' THEN 'nano'
  WHEN 'glass-protection' THEN 'tint'
  WHEN 'full-protection' THEN 'check'
  ELSE NULL
END
WHERE icon_key IS NULL;

-- Remove slug column entirely (routing no longer depends on it)
ALTER TABLE services DROP COLUMN IF EXISTS slug;