import { NextRequest, NextResponse } from "next/server";

import { normalizeText } from "@/lib/normalizeText";
import { detectImageEntities, stripGenericTokens } from "@/lib/googleVision";

/**
 * OCR API with Google Vision Web Detection
 * POST /api/ocr
 *
 * Accepts multipart/form-data with 'image' field
 *
 * Flow:
 * 1. Validate image (type, size)
 * 2. Call Google Vision Web Detection
 * 3. Extract brand candidates from bestGuessLabels + webEntities
 * 4. Return { query, source: "vision", candidates, rawLabel }
 *
 * Note: Tesseract.js server-side OCR removed due to Node.js worker path issues.
 * Client-side OCR still available via /api/preprocess-image if needed.
 */

interface ImageMatch {
  url: string;
  pageUrl?: string;
}

interface VisionResult {
  query: string;
  source: "vision";
  candidates: string[];
  rawLabel: string;
  imageMatches: {
    fullMatching: ImageMatch[];
    partialMatching: ImageMatch[];
    visuallySimilar: ImageMatch[];
  };
  pagesWithMatchingImages: string[];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Missing image file" },
        { status: 400 },
      );
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload PNG, JPG, or WEBP images." },
        { status: 400 },
      );
    }

    const maxSize = 8 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 8MB.`,
        },
        { status: 400 },
      );
    }

    console.log(
      `[Vision API] Processing ${file.name} (${file.type}, ${(file.size / 1024).toFixed(2)}KB)`,
    );
    const startTime = Date.now();

    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // ── Call Google Vision Web Detection ─────────────────────────────────────
    console.log("[Vision API] Running Google Vision Web Detection...");

    const visionData = await detectImageEntities(imageBuffer);

    console.log(
      `[Vision API] Vision result: bestGuessLabels=${JSON.stringify(visionData.bestGuessLabels)}, ` +
        `webEntities=${JSON.stringify(visionData.webEntities.slice(0, 5))}`,
    );

    // Build raw candidate list: on-image text first, then non-generic best guess, then web entities
    const rawCandidates: string[] = [];

    const pushUnique = (label: string) => {
      const trimmed = label.trim();

      if (!trimmed) return;
      const lower = trimmed.toLowerCase();

      if (rawCandidates.some((c) => c.toLowerCase() === lower)) return;
      rawCandidates.push(trimmed);
    };

    for (const t of visionData.textBrandCandidates) {
      pushUnique(t);
    }

    // bestGuessLabels are SEO-derived and often append junk like
    // "logo png" / "transparent download". Strip those tokens so we don't
    // search for "mercedes logo png" when the user uploaded a Mercedes star.
    for (const label of visionData.bestGuessLabels) {
      const cleaned = stripGenericTokens(label.label);

      if (cleaned) pushUnique(cleaned);
    }

    for (const entity of visionData.webEntities) {
      const cleaned = stripGenericTokens(entity.description);

      if (cleaned) pushUnique(cleaned);
    }

    const query =
      rawCandidates.length > 0 ? normalizeText(rawCandidates[0]) : "";
    const normalizedCandidates = rawCandidates
      .map((c) => normalizeText(c))
      .filter((c) => c.length > 0);
    const rawLabel = rawCandidates[0] ?? "";

    const duration = Date.now() - startTime;

    console.log(
      `[Vision API] Chosen query: "${query}", rawLabel="${rawLabel}", ` +
        `candidates=${JSON.stringify(normalizedCandidates)}, duration=${duration}ms`,
    );

    const result: VisionResult = {
      query,
      source: "vision",
      candidates: normalizedCandidates,
      rawLabel,
      imageMatches: {
        fullMatching: visionData.fullMatchingImages,
        partialMatching: visionData.partialMatchingImages,
        visuallySimilar: visionData.visuallySimilarImages,
      },
      pagesWithMatchingImages: visionData.pagesWithMatchingImages,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Vision API] Error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Vision processing failed", message: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred while processing the image.",
      },
      { status: 500 },
    );
  }
}
