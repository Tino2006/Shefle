-- Hybrid Trademark Similarity v2
-- Adds phonetic, edit-distance, Jaro-Winkler, and compound-word signals.

-- Required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- -----------------------------------------------------
-- Normalization helpers
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION normalize_search_text(input_text TEXT)
RETURNS TEXT AS $$
  SELECT trim(
    regexp_replace(
      LOWER(unaccent(COALESCE(input_text, ''))),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION normalize_search_text_nospace(input_text TEXT)
RETURNS TEXT AS $$
  SELECT replace(normalize_search_text(input_text), ' ', '');
$$ LANGUAGE SQL IMMUTABLE;

-- -----------------------------------------------------
-- Jaro-Winkler (pure PL/pgSQL, no custom extension build)
-- Ported from jellyfish implementation
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION jaro_winkler(ying TEXT, yang TEXT)
RETURNS float8 AS $$
DECLARE
    ying_len integer := LENGTH(ying);
    yang_len integer := LENGTH(yang);
    min_len integer := LEAST(ying_len, yang_len);
    search_range integer;
    ying_flags bool[];
    yang_flags bool[];
    common_chars float8 := 0;
    ying_ch TEXT;
    hi integer;
    low integer;
    trans_count integer := 0;
    weight float8;
    i integer;
    j integer;
    jj integer;
    k integer;
BEGIN
    IF ying IS NULL OR yang IS NULL OR ying_len = 0 OR yang_len = 0 THEN
        RETURN 0;
    END IF;

    search_range := (GREATEST(ying_len, yang_len) / 2) - 1;
    IF search_range < 0 THEN
        search_range := 0;
    END IF;

    FOR i IN 1 .. ying_len LOOP
        ying_flags[i] := false;
    END LOOP;
    FOR i IN 1 .. yang_len LOOP
        yang_flags[i] := false;
    END LOOP;

    -- Count and flag matches inside search window
    FOR i IN 1 .. ying_len LOOP
        ying_ch := SUBSTRING(ying FROM i for 1);
        IF i > search_range THEN
            low := i - search_range;
        ELSE
            low := 1;
        END IF;
        IF i + search_range <= yang_len THEN
            hi := i + search_range;
        ELSE
            hi := yang_len;
        END IF;

        <<inner>>
        FOR j IN low .. hi LOOP
            IF NOT yang_flags[j] AND SUBSTRING(yang FROM j FOR 1) = ying_ch THEN
               ying_flags[i] := true;
               yang_flags[j] := true;
               common_chars := common_chars + 1;
               EXIT inner;
            END IF;
        END LOOP inner;
    END LOOP;

    IF common_chars = 0 THEN
        RETURN 0;
    END IF;

    -- Count transpositions
    k := 1;
    FOR i IN 1 .. ying_len LOOP
        IF ying_flags[i] THEN
            <<inner2>>
            FOR j IN k .. yang_len LOOP
                jj := j;
                IF yang_flags[j] THEN
                    k := j + 1;
                    EXIT inner2;
                END IF;
            END LOOP;
            IF SUBSTRING(ying FROM i FOR 1) <> SUBSTRING(yang FROM jj FOR 1) THEN
                trans_count := trans_count + 1;
            END IF;
        END IF;
    END LOOP;
    trans_count := trans_count / 2;

    weight := (
      (common_chars / ying_len)
      + (common_chars / yang_len)
      + ((common_chars - trans_count) / common_chars)
    ) / 3;

    -- Winkler boost for common prefix (up to 4 chars)
    IF weight > 0.7 THEN
      j := LEAST(min_len, 4);
      i := 1;
      WHILE i <= j AND SUBSTRING(ying FROM i FOR 1) = SUBSTRING(yang FROM i FOR 1) LOOP
        i := i + 1;
      END LOOP;
      weight := weight + ((i - 1) * 0.1 * (1.0 - weight));
    END IF;

    RETURN LEAST(weight, 1.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- -----------------------------------------------------
-- Scoring signal helpers
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION normalized_levenshtein_similarity(query_text TEXT, mark_text TEXT)
RETURNS NUMERIC AS $$
DECLARE
  q_clean TEXT := normalize_search_text(query_text);
  m_clean TEXT := normalize_search_text(mark_text);
  max_len INT;
  dist INT;
BEGIN
  IF q_clean = '' OR m_clean = '' THEN
    RETURN 0;
  END IF;

  max_len := GREATEST(length(q_clean), length(m_clean));
  dist := levenshtein(q_clean, m_clean);

  RETURN GREATEST(0, LEAST(1, 1 - (dist::NUMERIC / max_len::NUMERIC)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION phonetic_similarity(query_text TEXT, mark_text TEXT)
RETURNS NUMERIC AS $$
DECLARE
  q_clean TEXT := normalize_search_text(query_text);
  m_clean TEXT := normalize_search_text(mark_text);
  q_dm TEXT;
  q_dm_alt TEXT;
  m_dm TEXT;
  m_dm_alt TEXT;
BEGIN
  IF q_clean = '' OR m_clean = '' THEN
    RETURN 0;
  END IF;

  q_dm := dmetaphone(q_clean);
  q_dm_alt := dmetaphone_alt(q_clean);
  m_dm := dmetaphone(m_clean);
  m_dm_alt := dmetaphone_alt(m_clean);

  IF q_dm <> '' AND q_dm = m_dm THEN
    RETURN 1.0;
  END IF;

  IF q_dm_alt <> '' AND q_dm_alt = m_dm_alt THEN
    RETURN 0.8;
  END IF;

  IF q_dm <> '' AND q_dm = m_dm_alt THEN
    RETURN 0.8;
  END IF;

  IF q_dm_alt <> '' AND q_dm_alt = m_dm THEN
    RETURN 0.8;
  END IF;

  RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION token_overlap_similarity_v2(query_text TEXT, mark_text TEXT)
RETURNS NUMERIC AS $$
DECLARE
  query_tokens TEXT[];
  mark_tokens TEXT[];
  query_len INT;
  mark_len INT;
  matching_tokens INT := 0;
  partial_matches NUMERIC := 0;
BEGIN
  query_tokens := string_to_array(normalize_search_text(query_text), ' ');
  mark_tokens := string_to_array(normalize_search_text(mark_text), ' ');

  query_tokens := array_remove(query_tokens, '');
  mark_tokens := array_remove(mark_tokens, '');

  query_len := array_length(query_tokens, 1);
  mark_len := array_length(mark_tokens, 1);

  IF query_len IS NULL OR query_len = 0 OR mark_len IS NULL OR mark_len = 0 THEN
    RETURN 0;
  END IF;

  -- Exact token matches
  FOR i IN 1..query_len LOOP
    FOR j IN 1..mark_len LOOP
      IF query_tokens[i] = mark_tokens[j] THEN
        matching_tokens := matching_tokens + 1;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  -- Partial token matches for unmatched query tokens
  FOR i IN 1..query_len LOOP
    DECLARE
      found_exact BOOLEAN := FALSE;
    BEGIN
      FOR j IN 1..mark_len LOOP
        IF query_tokens[i] = mark_tokens[j] THEN
          found_exact := TRUE;
          EXIT;
        END IF;
      END LOOP;

      IF NOT found_exact THEN
        FOR j IN 1..mark_len LOOP
          IF length(query_tokens[i]) >= 3 AND (
            mark_tokens[j] LIKE query_tokens[i] || '%'
            OR mark_tokens[j] LIKE '%' || query_tokens[i] || '%'
            OR query_tokens[i] LIKE mark_tokens[j] || '%'
          ) THEN
            partial_matches := partial_matches + 0.5;
            EXIT;
          END IF;
        END LOOP;
      END IF;
    END;
  END LOOP;

  RETURN LEAST(1.0, (matching_tokens::NUMERIC + partial_matches) / query_len::NUMERIC);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Penalize cases where one short/common token (or short prefix fragment)
-- dominates token similarity while whole-string signals remain weak.
CREATE OR REPLACE FUNCTION dominant_token_penalty_v2(
  query_text TEXT,
  mark_text TEXT,
  sig_token NUMERIC,
  sig_trgm NUMERIC,
  sig_jw NUMERIC,
  sig_lev NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  q_tokens TEXT[];
  m_tokens TEXT[];
  q_count INT;
  m_count INT;
  q_nospace TEXT := normalize_search_text_nospace(query_text);
  query_len INT;
  exact_matched_tokens INT := 0;
  longest_exact_len INT := 0;
  longest_prefix_len INT := 0;
  strongest_overlap_len INT := 0;
  coverage_ratio NUMERIC := 0;
  whole_signal_avg NUMERIC;
  score_gap NUMERIC;
  has_single_dominant_overlap BOOLEAN := FALSE;
  suspicious_short_overlap BOOLEAN := FALSE;
  prefix_only_overlap BOOLEAN := FALSE;
  brand_family_extension BOOLEAN := FALSE;
  penalty NUMERIC := 1.0;
BEGIN
  q_tokens := string_to_array(normalize_search_text(query_text), ' ');
  m_tokens := string_to_array(normalize_search_text(mark_text), ' ');

  q_tokens := array_remove(q_tokens, '');
  m_tokens := array_remove(m_tokens, '');

  q_count := COALESCE(array_length(q_tokens, 1), 0);
  m_count := COALESCE(array_length(m_tokens, 1), 0);
  query_len := length(q_nospace);

  IF q_count = 0 OR m_count = 0 OR query_len = 0 THEN
    RETURN 1.0;
  END IF;

  -- Count exact token overlaps and strongest exact token length
  FOR i IN 1..q_count LOOP
    FOR j IN 1..m_count LOOP
      IF q_tokens[i] = m_tokens[j] THEN
        exact_matched_tokens := exact_matched_tokens + 1;
        longest_exact_len := GREATEST(longest_exact_len, length(q_tokens[i]));
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  -- Track strongest prefix fragment overlap (for cases like "sam" vs "samsung")
  FOR i IN 1..q_count LOOP
    FOR j IN 1..m_count LOOP
      IF q_tokens[i] <> m_tokens[j] AND (
        q_tokens[i] LIKE m_tokens[j] || '%'
        OR m_tokens[j] LIKE q_tokens[i] || '%'
      ) THEN
        longest_prefix_len := GREATEST(
          longest_prefix_len,
          LEAST(length(q_tokens[i]), length(m_tokens[j]))
        );
      END IF;
    END LOOP;
  END LOOP;

  strongest_overlap_len := GREATEST(longest_exact_len, longest_prefix_len);
  coverage_ratio := strongest_overlap_len::NUMERIC / query_len::NUMERIC;

  whole_signal_avg := (COALESCE(sig_trgm, 0) + COALESCE(sig_jw, 0) + COALESCE(sig_lev, 0)) / 3.0;
  score_gap := COALESCE(sig_token, 0) - whole_signal_avg;

  -- Brand family extension exception: single-token query appears as first full token.
  -- Examples: "samsung" -> "samsung health", "apple" -> "apple pay"
  IF q_count = 1 AND m_count > 1 AND m_tokens[1] = q_tokens[1] THEN
    brand_family_extension := TRUE;
  END IF;

  has_single_dominant_overlap := (
    (exact_matched_tokens = 1 AND q_count <= 2)
    OR (exact_matched_tokens = 0 AND longest_prefix_len > 0)
  );

  suspicious_short_overlap := strongest_overlap_len > 0 AND strongest_overlap_len <= 4;
  prefix_only_overlap := exact_matched_tokens = 0 AND longest_prefix_len > 0;

  IF NOT brand_family_extension
     AND has_single_dominant_overlap
     AND (suspicious_short_overlap OR prefix_only_overlap)
     AND coverage_ratio >= 0.30
     AND COALESCE(sig_token, 0) >= 0.45
     AND score_gap >= 0.18 THEN
    -- Moderate penalties: stronger for shorter/prefix-only overlaps
    IF strongest_overlap_len <= 2 THEN
      penalty := 0.75;
    ELSIF strongest_overlap_len = 3 THEN
      penalty := 0.82;
    ELSE
      penalty := 0.88;
    END IF;
  END IF;

  RETURN penalty;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- -----------------------------------------------------
-- Final hybrid score
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION trademark_similarity_v2(
  query_text TEXT,
  mark_text TEXT,
  trgm_score NUMERIC DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  q_clean TEXT := normalize_search_text(query_text);
  m_clean TEXT := normalize_search_text(mark_text);
  q_nospace TEXT := normalize_search_text_nospace(query_text);
  m_nospace TEXT := normalize_search_text_nospace(mark_text);
  q_len_nospace INT;
  m_len_nospace INT;
  sig_trgm NUMERIC;
  sig_jw NUMERIC;
  sig_lev NUMERIC;
  sig_phone NUMERIC;
  sig_token NUMERIC;
  compound_sim NUMERIC;
  bonus_compound NUMERIC := 0;
  short_mark_penalty NUMERIC := 1.0;
  dominant_token_penalty NUMERIC := 1.0;
  final_score NUMERIC;
BEGIN
  IF q_clean = '' OR m_clean = '' THEN
    RETURN 0;
  END IF;

  IF q_clean = m_clean THEN
    RETURN 1.0;
  END IF;

  sig_trgm := COALESCE(trgm_score, similarity(q_clean, m_clean));
  sig_jw := jaro_winkler(q_clean, m_clean);
  sig_lev := normalized_levenshtein_similarity(q_clean, m_clean);
  sig_phone := phonetic_similarity(q_clean, m_clean);
  sig_token := token_overlap_similarity_v2(query_text, mark_text);

  q_len_nospace := length(q_nospace);
  m_len_nospace := length(m_nospace);

  compound_sim := similarity(q_nospace, m_nospace);
  IF compound_sim > sig_trgm + 0.1 THEN
    bonus_compound := LEAST(0.1, compound_sim - sig_trgm);
  END IF;

  dominant_token_penalty := dominant_token_penalty_v2(
    query_text,
    mark_text,
    sig_token,
    sig_trgm,
    sig_jw,
    sig_lev
  );

  final_score := (
    0.25 * sig_jw
    + 0.20 * sig_lev
    + 0.20 * sig_phone
    + 0.20 * sig_trgm
    + 0.15 * sig_token
    + bonus_compound
  );

  -- Penalize very short candidate marks against longer queries (e.g. "TR" vs "TRAVELER")
  IF m_len_nospace <= 3 AND q_len_nospace > 3 THEN
    short_mark_penalty := 0.7;
  END IF;

  final_score := final_score * short_mark_penalty * dominant_token_penalty;

  RETURN LEAST(1.0, GREATEST(0.0, final_score));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Overload for pg_trgm similarity() return type (real/float4)
CREATE OR REPLACE FUNCTION trademark_similarity_v2(
  query_text TEXT,
  mark_text TEXT,
  trgm_score REAL
)
RETURNS NUMERIC AS $$
  SELECT trademark_similarity_v2(query_text, mark_text, trgm_score::NUMERIC);
$$ LANGUAGE SQL IMMUTABLE;

COMMENT ON FUNCTION trademark_similarity_v2(TEXT, TEXT, NUMERIC) IS
'Hybrid trademark score: Jaro-Winkler, Levenshtein, phonetic, trigram, token overlap, plus compound-word bonus.';

COMMENT ON FUNCTION trademark_similarity_v2(TEXT, TEXT, REAL) IS
'Overload wrapper for pg_trgm similarity() float4 output.';

-- -----------------------------------------------------
-- Optional speedups for phonetic + compound retrieval
-- -----------------------------------------------------

ALTER TABLE public.trademarks
  ADD COLUMN IF NOT EXISTS mark_text_dmetaphone TEXT
  GENERATED ALWAYS AS (dmetaphone(normalize_search_text(COALESCE(mark_text, '')))) STORED;

CREATE INDEX IF NOT EXISTS idx_trademarks_mark_text_dmetaphone
  ON public.trademarks(mark_text_dmetaphone);

CREATE INDEX IF NOT EXISTS idx_trademarks_mark_text_nospace_trgm
  ON public.trademarks
  USING GIN ((LOWER(REPLACE(COALESCE(mark_text, ''), ' ', ''))) gin_trgm_ops);
