import { NextRequest, NextResponse } from 'next/server';
import {
  generateImageEmbedding,
  generateImageEmbeddingFromUrl,
  cosineSimilarity,
} from '@/lib/imageEmbeddings';

/**
 * Logo Similarity API
 * POST /api/logo-similarity
 *
 * Accepts:
 * - multipart/form-data with 'image' field (uploaded logo)
 * - JSON body with 'candidateUrls' array
 *
 * Returns ranked list of visual matches with similarity scores
 */

interface CandidateImage {
  url: string;
  pageUrl?: string;
  entityLabel?: string;
  source: 'fullMatch' | 'partialMatch' | 'visuallySimilar';
}

interface SimilarityResult {
  url: string;
  pageUrl?: string;
  entityLabel?: string;
  source: 'fullMatch' | 'partialMatch' | 'visuallySimilar';
  similarityScore: number;
}

interface SimilarityResponse {
  count: number;
  results: SimilarityResult[];
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let uploadedImageBuffer: Buffer;
    let candidates: CandidateImage[];

    // Parse request based on content type
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('image') as File;
      const candidatesJson = formData.get('candidates') as string;

      if (!file) {
        return NextResponse.json({ error: 'Missing image file' }, { status: 400 });
      }

      if (!candidatesJson) {
        return NextResponse.json(
          { error: 'Missing candidates parameter' },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      uploadedImageBuffer = Buffer.from(arrayBuffer);
      candidates = JSON.parse(candidatesJson);
    } else if (contentType.includes('application/json')) {
      const body = await request.json();

      if (!body.imageBase64) {
        return NextResponse.json(
          { error: 'Missing imageBase64 parameter' },
          { status: 400 }
        );
      }

      if (!body.candidates || !Array.isArray(body.candidates)) {
        return NextResponse.json(
          { error: 'Missing or invalid candidates array' },
          { status: 400 }
        );
      }

      uploadedImageBuffer = Buffer.from(body.imageBase64, 'base64');
      candidates = body.candidates;
    } else {
      return NextResponse.json(
        { error: 'Invalid content type. Use multipart/form-data or application/json' },
        { status: 400 }
      );
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
      });
    }

    console.log(
      `[Logo Similarity] Processing uploaded image (${uploadedImageBuffer.length}B) against ${candidates.length} candidates`
    );
    const startTime = Date.now();

    // Generate embedding for uploaded image
    console.log('[Logo Similarity] Generating embedding for uploaded image...');
    const uploadedEmbedding = await generateImageEmbedding(uploadedImageBuffer);
    console.log(`[Logo Similarity] Uploaded image embedding: ${uploadedEmbedding.length}D`);

    // Fetch candidate images and generate embeddings
    const results: SimilarityResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const candidate of candidates) {
      try {
        console.log(`[Logo Similarity] Fetching candidate: ${candidate.url.substring(0, 80)}...`);
        
        const candidateEmbedding = await generateImageEmbeddingFromUrl(candidate.url);
        const similarity = cosineSimilarity(uploadedEmbedding, candidateEmbedding);

        results.push({
          url: candidate.url,
          pageUrl: candidate.pageUrl,
          entityLabel: candidate.entityLabel,
          source: candidate.source,
          similarityScore: similarity,
        });

        successCount++;
        console.log(
          `[Logo Similarity] ✓ ${candidate.url.substring(0, 60)}... → similarity=${similarity.toFixed(3)}`
        );
      } catch (error) {
        failCount++;
        console.warn(
          `[Logo Similarity] ✗ Failed to process ${candidate.url.substring(0, 60)}...:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarityScore - a.similarityScore);

    const duration = Date.now() - startTime;
    console.log(
      `[Logo Similarity] Complete: ${successCount} succeeded, ${failCount} failed, ` +
        `top similarity=${results[0]?.similarityScore.toFixed(3) ?? 'N/A'}, duration=${duration}ms`
    );

    const response: SimilarityResponse = {
      count: results.length,
      results,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Logo Similarity] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Logo similarity processing failed', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing logo similarity.',
      },
      { status: 500 }
    );
  }
}
