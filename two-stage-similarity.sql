-- 🎯 TWO-STAGE SIMILARITY SCORING
-- Stage 1: Trigram for candidate selection (fast, broad)
-- Stage 2: Token-based for final ranking (accurate, penalizes inflation)

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- =====================================================
-- TOKEN-BASED SIMILARITY FUNCTION
-- =====================================================

-- Function to calculate token-based similarity score
-- Accounts for: exact token overlap, substring matching, length penalty
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
        EXIT; -- Move to next query token
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
            -- Partial match worth 0.5 points
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
  -- Penalize if mark is much longer than query
  length_ratio := LEAST(query_len::NUMERIC, mark_len::NUMERIC) / GREATEST(query_len::NUMERIC, mark_len::NUMERIC);
  
  -- Apply moderate length penalty (less aggressive than pure ratio)
  length_penalty := 0.7 + (0.3 * length_ratio);
  
  -- Calculate final score
  final_score := token_overlap_score * length_penalty;
  
  -- Cap at 1.0
  RETURN LEAST(final_score, 1.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- TWO-STAGE SEARCH FUNCTION
-- =====================================================

-- Drop old function
DROP FUNCTION IF EXISTS search_trademarks(text, int);

-- Create two-stage search function
CREATE OR REPLACE FUNCTION search_trademarks_two_stage(
  search_query TEXT,
  result_limit INT DEFAULT 25
)
RETURNS TABLE (
  serial_number TEXT,
  registration_number TEXT,
  mark_text TEXT,
  status_norm TEXT,
  owner_name TEXT,
  filing_date DATE,
  sim_trgm NUMERIC,
  sim_final NUMERIC
)
LANGUAGE SQL
AS $$
  WITH candidates AS (
    -- Stage 1: Use trigram for candidate selection (broad net)
    SELECT
      t.serial_number,
      t.registration_number,
      t.mark_text,
      t.status_norm,
      t.owner_name,
      t.filing_date,
      similarity(
        LOWER(unaccent(t.mark_text)),
        LOWER(unaccent(search_query))
      ) AS trgm_score
    FROM trademarks t
    WHERE t.mark_text IS NOT NULL
      AND (
        -- Exact match
        LOWER(unaccent(t.mark_text)) = LOWER(unaccent(search_query))
        -- Prefix match
        OR LOWER(unaccent(t.mark_text)) LIKE LOWER(unaccent(search_query)) || '%'
        -- Contains match
        OR LOWER(unaccent(t.mark_text)) LIKE '%' || LOWER(unaccent(search_query)) || '%'
        -- Trigram similarity fallback
        OR similarity(
          LOWER(unaccent(t.mark_text)),
          LOWER(unaccent(search_query))
        ) > 0.15
      )
  )
  -- Stage 2: Re-rank with token-based scoring
  SELECT
    c.serial_number,
    c.registration_number,
    c.mark_text,
    c.status_norm,
    c.owner_name,
    c.filing_date,
    c.trgm_score AS sim_trgm,
    -- Token-based final score (more accurate)
    CASE 
      WHEN LOWER(unaccent(c.mark_text)) = LOWER(unaccent(search_query)) THEN 1.0
      ELSE token_similarity(search_query, c.mark_text)
    END AS sim_final
  FROM candidates c
  ORDER BY sim_final DESC, sim_trgm DESC
  LIMIT result_limit;
$$;

-- Set similarity threshold
SELECT set_limit(0.1);

-- =====================================================
-- TEST QUERIES
-- =====================================================

-- Test token-based similarity function
-- Expected: High overlap = high score, length mismatch = penalty
SELECT 
  mark_text,
  similarity(LOWER(unaccent(mark_text)), LOWER(unaccent('nike'))) AS sim_trgm,
  token_similarity('nike', mark_text) AS sim_token
FROM trademarks
WHERE mark_text IS NOT NULL
  AND similarity(LOWER(unaccent(mark_text)), LOWER(unaccent('nike'))) > 0.2
ORDER BY sim_token DESC
LIMIT 10;

-- Test two-stage search function
SELECT * FROM search_trademarks_two_stage('apple', 10);

-- Compare trigram vs token scores
-- Look for inflated trigram scores that get corrected by token scoring
SELECT 
  mark_text,
  sim_trgm,
  sim_final,
  (sim_trgm - sim_final) AS inflation
FROM search_trademarks_two_stage('nike', 20)
ORDER BY inflation DESC;
