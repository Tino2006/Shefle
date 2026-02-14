-- 🔧 FIX 3: Prevent Duplicate Watchlist Hits
-- Run this in your Supabase SQL Editor or via psql

-- Note: If you created watchlist_hits from monitor-schema.sql, 
-- the UNIQUE constraint already exists on (watchlist_id, trademark_id).
-- This adds the alternative constraint on serial_number as well for safety.

-- Add unique constraint to prevent duplicates (if not already present)
DO $$ 
BEGIN
  -- Try to add constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'watchlist_unique_hit'
  ) THEN
    ALTER TABLE watchlist_hits
    ADD CONSTRAINT watchlist_unique_hit
    UNIQUE (watchlist_id, trademark_serial_number);
  END IF;
END $$;

-- Clean up any existing duplicates (run this BEFORE if you have duplicates)
-- Uncomment if needed:
-- 
-- DELETE FROM watchlist_hits
-- WHERE id NOT IN (
--   SELECT MIN(id)
--   FROM watchlist_hits
--   GROUP BY watchlist_id, trademark_serial_number
-- );

