-- Add cover_color column to mentors table
ALTER TABLE mentors
  ADD COLUMN IF NOT EXISTS cover_color text DEFAULT '#0f172a';

-- Update cover_color for each mentor
UPDATE mentors SET cover_color = '#0070d2' WHERE name LIKE '%田中%';
UPDATE mentors SET cover_color = '#ff7a59' WHERE name LIKE '%佐藤%';
UPDATE mentors SET cover_color = '#2d1b4e' WHERE name LIKE '%鈴木%';
UPDATE mentors SET cover_color = '#1a1a2e' WHERE name LIKE '%伊藤%';
UPDATE mentors SET cover_color = '#003366' WHERE name LIKE '%中村%';
UPDATE mentors SET cover_color = '#007aff' WHERE name LIKE '%小林%';
UPDATE mentors SET cover_color = '#0070d2' WHERE name LIKE '%加藤%';
UPDATE mentors SET cover_color = '#ff7a59' WHERE name LIKE '%渡辺%';
UPDATE mentors SET cover_color = '#0f172a' WHERE name LIKE '%柴%';

-- Move 柴 to first position
UPDATE mentors SET display_order = 0 WHERE name LIKE '%柴%';
UPDATE mentors SET display_order = display_order + 1 WHERE name NOT LIKE '%柴%';
