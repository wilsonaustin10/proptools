-- Convert category to categories array
ALTER TABLE tools 
  ADD COLUMN categories text[] NOT NULL DEFAULT '{}',
  DROP COLUMN category;
