/* eslint-disable no-console -- /api/ocr request + Vision diagnostics for production */
import { NextRequest, NextResponse } from "next/server";

import { getAllowedOrigins, isOriginAllowed } from "@/lib/allowedOrigins";
import { normalizeText } from "@/lib/normalizeText";
import {
  detectImageEntities,
  hasVisionCredentialEnvVar,
  requiresVisionCredentialsInEnv,
  stripGenericTokens,
} from "@/lib/googleVision";

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
 *
 * Env (Vision): GOOGLE_CREDENTIALS_JSON | GOOGLE_APPLICATION_CREDENTIALS (inline JSON)
 * | GOOGLE_CREDENTIALS_BASE64 — required on Vercel (see requiresVisionCredentialsInEnv).
 * Observability: NEXT_PUBLIC_APP_URL (logged only).
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

interface StructuredErrorBody {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
}

function serializeCaughtError(error: unknown): StructuredErrorBody {
  if (error instanceof Error) {
    const anyErr = error as Error & {
      code?: string | number;
      details?: unknown;
    };

    const message =
      typeof anyErr.message === "string" && anyErr.message.length > 0
        ? anyErr.message
        : "(Error with empty message)";

    const body: StructuredErrorBody = {
      error: "VISION_PROCESSING_FAILED",
      message,
    };

    if (anyErr.code !== undefined && anyErr.code !== null) {
      body.code = String(anyErr.code);
    }

    if (anyErr.details !== undefined) {
      body.details = anyErr.details;
    }

    return body;
  }

  return {
    error: "VISION_PROCESSING_FAILED",
    message: typeof error === "string" ? error : JSON.stringify(error, null, 0),
  };
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const referer = request.headers.get("referer");
  const forwardedHost = request.headers.get("x-forwarded-host");

  console.log("[Vision API] Request diagnostics:", {
    origin,
    host,
    referer,
    xForwardedHost: forwardedHost,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    allowedOriginsConfigured: getAllowedOrigins().length,
    originAllowedForApp: isOriginAllowed(origin),
    requiresVisionEnvCreds: requiresVisionCredentialsInEnv(),
    hasVisionCredentialEnvVar: hasVisionCredentialEnvVar(),
  });

  try {
    if (requiresVisionCredentialsInEnv() && !hasVisionCredentialEnvVar()) {
      const body: StructuredErrorBody = {
        error: "VISION_CREDENTIALS_MISSING",
        message:
          "No Google Vision credentials in environment. Set GOOGLE_CREDENTIALS_JSON (full service account JSON), or GOOGLE_CREDENTIALS_BASE64, or inline JSON in GOOGLE_APPLICATION_CREDENTIALS for this deployment.",
      };

      console.error("[Vision API]", body.error, body.message);

      return NextResponse.json(body, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json(
        { error: "MISSING_IMAGE", message: "Missing image file" },
        { status: 400 },
      );
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: "INVALID_FILE_TYPE",
          message: "Invalid file type. Please upload PNG, JPG, or WEBP images.",
        },
        { status: 400 },
      );
    }

    const maxSize = 8 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: "FILE_TOO_LARGE",
          message: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 8MB.`,
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

    let visionData;

    try {
      visionData = await detectImageEntities(imageBuffer);
    } catch (visionErr) {
      const structured = serializeCaughtError(visionErr);

      console.error(
        "[Vision API] detectImageEntities failed:",
        JSON.stringify(structured, null, 2),
      );
      console.error("[Vision API] Raw error:", visionErr);

      return NextResponse.json(structured, { status: 500 });
    }

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
    const structured = serializeCaughtError(error);

    console.error(
      "[Vision API] POST /api/ocr unexpected error:",
      JSON.stringify(structured, null, 2),
    );
    console.error("[Vision API] Raw error:", error);

    return NextResponse.json(structured, { status: 500 });
  }
}
