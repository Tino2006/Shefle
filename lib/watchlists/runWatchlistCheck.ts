import { query, queryOne, queryRows } from "@/lib/db/postgres";
import { detectImageEntities } from "@/lib/googleVision";
import {
  generateImageEmbedding,
  generateImageEmbeddingFromUrl,
  cosineSimilarity,
} from "@/lib/imageEmbeddings";
import {
  visualMatchDisplayPercent,
  VISUAL_MATCH_DISPLAY_THRESHOLD,
} from "@/lib/visualMatchDisplay";

interface TrademarkSearchResult {
  id: string;
  serial_number: string;
  mark_text: string | null;
  sim_trgm: number;
  sim_final: number;
  rank: number;
}

function calculateRiskLevel(
  similarity: number,
): "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW" {
  if (similarity >= 0.8) return "HIGH";
  if (similarity >= 0.6) return "MEDIUM";
  if (similarity >= 0.4) return "LOW";

  return "VERY_LOW";
}

export interface WatchlistCheckResult {
  success: true;
  checked_at: string;
  total_matches: number;
  new_hits: number;
  existing_hits: number;
  visual_matches: number;
  new_visual_hits: number;
}

export async function runWatchlistCheck(
  watchlistId: string,
): Promise<WatchlistCheckResult> {
  const watchlist = await queryOne<{
    id: string;
    query: string;
    image_base64: string | null;
    min_similarity: number;
    status_filter: string;
    class_filter: number[] | null;
  }>(
    `
      SELECT
        id::text,
        query,
        image_base64,
        min_similarity,
        status_filter,
        class_filter
      FROM public.watchlists
      WHERE id = $1
    `,
    [watchlistId],
  );

  if (!watchlist) {
    throw new Error("Watchlist not found");
  }

  const statusValues = watchlist.status_filter
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => ["ACTIVE", "PENDING", "DEAD"].includes(s));

  const searchQuery = `
    WITH candidates AS (
      SELECT
        t.id,
        t.serial_number,
        t.mark_text,
        similarity(
          LOWER(unaccent(COALESCE(t.mark_text, ''))),
          LOWER(unaccent($1))
        ) AS trgm_score,
        similarity(
          LOWER(unaccent(REPLACE(COALESCE(t.mark_text, ''), ' ', ''))),
          LOWER(unaccent(REPLACE($1, ' ', '')))
        ) AS trgm_nospace_score
      FROM public.trademarks t
      ${watchlist.class_filter ? "LEFT JOIN public.trademark_classes tc ON t.id = tc.trademark_id" : ""}
      WHERE
        t.mark_text IS NOT NULL
        AND (
          LOWER(unaccent(t.mark_text)) = LOWER(unaccent($1))
          OR LOWER(unaccent(t.mark_text)) LIKE LOWER(unaccent($1)) || '%'
          OR LOWER(unaccent(t.mark_text)) LIKE '%' || LOWER(unaccent($1)) || '%'
          OR t.mark_text_tsv @@ plainto_tsquery('simple', $1)
          OR similarity(
              LOWER(unaccent(t.mark_text)),
              LOWER(unaccent($1))
            ) > 0.15
          OR dmetaphone(LOWER(unaccent(t.mark_text))) = dmetaphone(LOWER(unaccent($1)))
          OR dmetaphone_alt(LOWER(unaccent(t.mark_text))) = dmetaphone_alt(LOWER(unaccent($1)))
          OR similarity(
              LOWER(unaccent(REPLACE(t.mark_text, ' ', ''))),
              LOWER(unaccent(REPLACE($1, ' ', '')))
            ) > 0.2
        )
        AND t.status_norm = ANY($2)
        ${watchlist.class_filter ? "AND tc.nice_class = ANY($3)" : ""}
      GROUP BY t.id
    )
    SELECT
      c.id::text,
      c.serial_number,
      c.mark_text,
      c.trgm_score AS sim_trgm,
      CASE
        WHEN LOWER(unaccent(c.mark_text)) = LOWER(unaccent($1)) THEN 1.0
        ELSE trademark_similarity_v2($1, c.mark_text, c.trgm_score::numeric)
      END AS sim_final,
      (
        CASE
          WHEN LOWER(unaccent(c.mark_text)) = LOWER(unaccent($1)) THEN 1000.0
          ELSE trademark_similarity_v2($1, c.mark_text, c.trgm_score::numeric) * 100.0
        END
        + ts_rank(
            to_tsvector('simple', COALESCE(c.mark_text, '')),
            plainto_tsquery('simple', $1)
          ) * 10.0
        + c.trgm_nospace_score * 5.0
      ) AS rank
    FROM candidates c
    WHERE
      CASE
        WHEN LOWER(unaccent(c.mark_text)) = LOWER(unaccent($1)) THEN 1.0
        ELSE trademark_similarity_v2($1, c.mark_text, c.trgm_score::numeric)
      END >= $${watchlist.class_filter ? "4" : "3"}
    ORDER BY rank DESC, sim_final DESC
    LIMIT 100
  `;

  const queryParams: any[] = [watchlist.query, statusValues];

  if (watchlist.class_filter) queryParams.push(watchlist.class_filter);
  queryParams.push(watchlist.min_similarity);

  const results = await queryRows<TrademarkSearchResult>(
    searchQuery,
    queryParams,
  );

  let insertedCount = 0;

  for (const hit of results) {
    try {
      const result = await query(
        `
          INSERT INTO public.watchlist_hits
            (watchlist_id, trademark_id, trademark_serial_number, similarity_score, risk_level)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (watchlist_id, trademark_serial_number) DO NOTHING
          RETURNING id
        `,
        [
          watchlistId,
          hit.id,
          hit.serial_number,
          hit.sim_final,
          calculateRiskLevel(hit.sim_final),
        ],
      );

      if (result.rowCount && result.rowCount > 0) insertedCount++;
    } catch (error) {
      console.error("Error inserting hit:", error);
    }
  }

  const totalHitsResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM public.watchlist_hits WHERE watchlist_id = $1`,
    [watchlistId],
  );
  const totalHits = parseInt(totalHitsResult?.count || "0", 10);

  let visualMatchCount = 0;
  let newVisualHits = 0;

  if (watchlist.image_base64) {
    try {
      const imageBuffer = Buffer.from(watchlist.image_base64, "base64");
      const visionData = await detectImageEntities(imageBuffer);

      const candidates: Array<{
        url: string;
        pageUrl?: string;
        source: "fullMatch" | "partialMatch" | "visuallySimilar";
      }> = [];

      for (const img of visionData.fullMatchingImages) {
        candidates.push({
          url: img.url,
          pageUrl: img.pageUrl,
          source: "fullMatch",
        });
      }
      for (const img of visionData.partialMatchingImages) {
        candidates.push({
          url: img.url,
          pageUrl: img.pageUrl,
          source: "partialMatch",
        });
      }
      for (const img of visionData.visuallySimilarImages) {
        candidates.push({
          url: img.url,
          pageUrl: img.pageUrl,
          source: "visuallySimilar",
        });
      }

      if (candidates.length > 0) {
        const uploadedEmbedding = await generateImageEmbedding(imageBuffer);

        for (const candidate of candidates.slice(0, 20)) {
          try {
            const candidateEmbedding = await generateImageEmbeddingFromUrl(
              candidate.url,
            );
            const similarity = cosineSimilarity(
              uploadedEmbedding,
              candidateEmbedding,
            );

            if (
              visualMatchDisplayPercent(similarity) <
              VISUAL_MATCH_DISPLAY_THRESHOLD
            )
              continue;
            visualMatchCount++;

            const entityLabel =
              visionData.webEntities.find((e) => e.score > 0.5)?.description ||
              null;

            const insertResult = await query(
              `
                INSERT INTO public.watchlist_visual_hits
                  (watchlist_id, image_url, page_url, entity_label, source, similarity_score)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (watchlist_id, image_url) DO NOTHING
                RETURNING id
              `,
              [
                watchlistId,
                candidate.url,
                candidate.pageUrl || null,
                entityLabel,
                candidate.source,
                similarity,
              ],
            );

            if (insertResult.rowCount && insertResult.rowCount > 0)
              newVisualHits++;
          } catch (err) {
            console.warn(
              `[Watchlist Check] Failed visual candidate: ${candidate.url.substring(0, 60)}...`,
              err instanceof Error ? err.message : err,
            );
          }
        }
      }
    } catch (err) {
      console.error("[Watchlist Check] Visual similarity pipeline error:", err);
    }
  }

  await query(
    `
      UPDATE public.watchlists
      SET last_checked_at = NOW()
      WHERE id = $1
    `,
    [watchlistId],
  );

  return {
    success: true,
    checked_at: new Date().toISOString(),
    total_matches: results.length,
    new_hits: insertedCount,
    existing_hits: totalHits - insertedCount,
    visual_matches: visualMatchCount,
    new_visual_hits: newVisualHits,
  };
}
