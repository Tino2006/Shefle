-- QUICK FIX: Run this first before using search
-- This creates the token_similarity function needed by the search API

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create token_similarity function
CREATE OR REPLACE FUNCTION token_similarity(
  query_text TEXT,
  mark_text TEXT
)
RETURNS NUMERIC AS $$
DECLARE
  query_clean TEXT;
  mark_clean TEXT;
  query_tokens TEXT[];
  mark_tokens TEXT[];
  query_len INT;
  mark_len INT;
  matching_tokens INT := 0;
  partial_matches NUMERIC := 0;
  length_ratio NUMERIC;
  token_overlap_score NUMERIC;
  length_penalty NUMERIC;
  final_score NUMERIC;
BEGIN
  -- Normalize and clean text
  query_clean := LOWER(unaccent(query_text));
  mark_clean := LOWER(unaccent(mark_text));
  
  -- Split into tokens (words)
  query_tokens := string_to_array(regexp_replace(query_clean, '[^a-z0-9]+', ' ', 'g'), ' ');
  mark_tokens := string_to_array(regexp_replace(mark_clean, '[^a-z0-9]+', ' ', 'g'), ' ');
  
  -- Remove empty strings
  query_tokens := array_remove(query_tokens, '');
  mark_tokens := array_remove(mark_tokens, '');
  
  query_len := array_length(query_tokens, 1);
  mark_len := array_length(mark_tokens, 1);
  
  -- Handle edge cases
  IF query_len IS NULL OR query_len = 0 THEN RETURN 0; END IF;
  IF mark_len IS NULL OR mark_len = 0 THEN RETURN 0; END IF;
  
  -- Count exact token matches
  FOR i IN 1..query_len LOOP
    FOR j IN 1..mark_len LOOP
      IF query_tokens[i] = mark_tokens[j] THEN
        matching_tokens := matching_tokens + 1;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
  
  -- Count partial/substring matches (only if no exact match found)
  FOR i IN 1..query_len LOOP
    DECLARE
      found_exact BOOLEAN := FALSE;
    BEGIN
      -- Check if this token had an exact match
      FOR j IN 1..mark_len LOOP
        IF query_tokens[i] = mark_tokens[j] THEN
          found_exact := TRUE;
          EXIT;
        END IF;
      END LOOP;
      
      -- If no exact match, check for substring matches
      IF NOT found_exact THEN
        FOR j IN 1..mark_len LOOP
          IF length(query_tokens[i]) >= 3 AND (
            mark_tokens[j] LIKE query_tokens[i] || '%' OR
            mark_tokens[j] LIKE '%' || query_tokens[i] || '%' OR
            query_tokens[i] LIKE mark_tokens[j] || '%'
          ) THEN
            partial_matches := partial_matches + 0.5;
            EXIT;
          END IF;
        END LOOP;
      END IF;
    END;
  END LOOP;
  
  -- Calculate token overlap score (0 to 1)
  token_overlap_score := (matching_tokens::NUMERIC + partial_matches) / query_len::NUMERIC;
  
  -- Calculate length penalty
  length_ratio := LEAST(query_len::NUMERIC, mark_len::NUMERIC) / GREATEST(query_len::NUMERIC, mark_len::NUMERIC);
  length_penalty := 0.7 + (0.3 * length_ratio);
  
  -- Calculate final score
  final_score := token_overlap_score * length_penalty;
  
  -- Cap at 1.0
  RETURN LEAST(final_score, 1.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Verify function works
SELECT token_similarity('nike', 'NIKE') AS should_be_1;
SELECT token_similarity('nike', 'Nike Air Max') AS should_be_low;

COMMENT ON FUNCTION token_similarity IS 'Token-based similarity with exact match, partial match, and length penalty';
