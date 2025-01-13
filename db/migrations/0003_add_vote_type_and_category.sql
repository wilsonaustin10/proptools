-- Add vote type and category columns to upvotes table
ALTER TABLE upvotes
  ADD COLUMN vote_type boolean NOT NULL DEFAULT true,
  ADD COLUMN category text NOT NULL,
  ADD COLUMN created_at timestamp DEFAULT NOW();

-- Add index for performance on common queries
CREATE INDEX idx_upvotes_category_created_at ON upvotes(category, created_at);
