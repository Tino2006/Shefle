import vision from "@google-cloud/vision";

interface VisionServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

function parseCredentialsJson(
  raw: string,
  source: string,
): VisionServiceAccountCredentials {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `[Vision API] Invalid ${source}: expected valid JSON service account credentials`,
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`[Vision API] Invalid ${source}: JSON must be an object`);
  }

  const credentials = parsed as Record<string, unknown>;
  const clientEmail = credentials.client_email;
  const privateKey = credentials.private_key;
  const projectId = credentials.project_id;

  if (typeof clientEmail !== "string" || clientEmail.trim().length === 0) {
    throw new Error(`[Vision API] Invalid ${source}: missing client_email`);
  }

  if (typeof privateKey !== "string" || privateKey.trim().length === 0) {
    throw new Error(`[Vision API] Invalid ${source}: missing private_key`);
  }

  return {
    client_email: clientEmail.trim(),
    // Support envs where newline escapes are pasted literally.
    private_key: privateKey.replace(/\\n/g, "\n"),
    project_id: typeof projectId === "string" ? projectId : undefined,
  };
}

function loadVisionCredentialsFromEnv(): VisionServiceAccountCredentials | null {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  if (credentialsJson && credentialsJson.trim().length > 0) {
    return parseCredentialsJson(credentialsJson, "GOOGLE_CREDENTIALS_JSON");
  }

  const inlineGoogleApplicationCredentials =
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (
    inlineGoogleApplicationCredentials &&
    inlineGoogleApplicationCredentials.trim().startsWith("{")
  ) {
    return parseCredentialsJson(
      inlineGoogleApplicationCredentials,
      "GOOGLE_APPLICATION_CREDENTIALS",
    );
  }

  const base64Credentials = process.env.GOOGLE_CREDENTIALS_BASE64;

  if (base64Credentials && base64Credentials.trim().length > 0) {
    const decoded = Buffer.from(base64Credentials, "base64").toString("utf8");

    return parseCredentialsJson(decoded, "GOOGLE_CREDENTIALS_BASE64");
  }

  return null;
}

function getVisionClient() {
  const credentials = loadVisionCredentialsFromEnv();

  if (credentials) {
    return new vision.ImageAnnotatorClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      projectId: credentials.project_id,
    });
  }

  if (process.env.VERCEL || process.env.VERCEL_ENV === "production") {
    throw new Error(
      "[Vision API] Missing credentials in Vercel runtime. Set GOOGLE_CREDENTIALS_JSON to the full service account JSON in Vercel Project Settings > Environment Variables, then redeploy.",
    );
  }

  // Local dev fallback with gcloud ADC.
  return new vision.ImageAnnotatorClient();
}

/**
 * Words that are too generic to be useful brand identifiers.
 * These are filtered out from Vision web entity results.
 */
const GENERIC_WORDS = new Set([
  "logo",
  "image",
  "black",
  "white",
  "font",
  "brand",
  "design",
  "icon",
  "text",
  "graphic",
  "vector",
  "symbol",
  "product",
  "color",
  "colour",
  "background",
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "purple",
  "photography",
  "stock photography",
  "clip art",
  "illustration",
  "picture",
  "photo",
  "photograph",
  "trademark",
  "registered",
  "copyright",
  "drawing",
  "sketch",
  "artwork",
  "digital art",
  "watercolor",
  "graphics",
  "stock image",
  "stock photo",
  // SEO noise commonly appended by Google's bestGuessLabels (file extensions
  // and download/preview descriptors). Never legitimate brand identifiers.
  "png",
  "jpg",
  "jpeg",
  "svg",
  "webp",
  "gif",
  "ico",
  "pdf",
  "download",
]);

/** Labels too vague to drive a trademark search (applies to best-guess and entities). */
export function isGenericVisionLabel(text: string): boolean {
  const d = text.trim().toLowerCase();

  if (d.length === 0) return true;
  if (GENERIC_WORDS.has(d)) return true;
  const words = d.split(/\s+/).filter(Boolean);

  if (words.length > 1 && words.every((w) => GENERIC_WORDS.has(w))) return true;

  return false;
}

/**
 * Drop generic tokens (logo, png, transparent, etc.) from a multi-word label
 * and return the cleaned remainder. Tokens are matched case-insensitively
 * against GENERIC_WORDS after stripping non-alphanumeric chars, so
 * "Mercedes-Benz logo PNG" → "Mercedes-Benz". Returns empty string if every
 * token was generic.
 */
export function stripGenericTokens(text: string): string {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const kept = tokens.filter((token) => {
    const normalized = token.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (!normalized) return false;

    return !GENERIC_WORDS.has(normalized);
  });

  return kept.join(" ").trim();
}

/**
 * Pull likely brand/mark strings from Vision TEXT_DETECTION (full document string).
 * Short lines and ALL-CAPS tokens (e.g. WMA) are preferred over long body copy.
 */
function extractTextBrandCandidates(fullText: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string) => {
    const t = raw.trim();

    if (t.length < 2 || t.length > 48) return;
    const lower = t.toLowerCase();

    if (isGenericVisionLabel(t) || seen.has(lower)) return;
    seen.add(lower);
    out.push(t);
  };

  const lines = fullText
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const linesByLength = [...lines].sort((a, b) => a.length - b.length);

  for (const line of linesByLength) {
    const compact = line.replace(/\s+/g, " ");

    if (
      compact.length <= 28 &&
      /^[A-Za-z0-9][A-Za-z0-9&.\s'-]*$/.test(compact)
    ) {
      push(compact);
    }
  }

  const tokens = fullText.match(/[A-Za-z][A-Za-z0-9&]*/g) ?? [];
  const acronyms = tokens.filter((w) => /^[A-Z]{2,8}$/.test(w));

  acronyms.sort((a, b) => a.length - b.length || a.localeCompare(b));
  for (const w of acronyms) push(w);

  for (const w of tokens) {
    if (w.length >= 3 && w.length <= 24 && /^[A-Za-z][A-Za-z0-9]*$/.test(w)) {
      push(w);
    }
  }

  return out;
}

export interface WebEntity {
  description: string;
  score: number;
}

export interface BestGuessLabel {
  label: string;
}

export interface ImageMatch {
  url: string;
  pageUrl?: string;
}

export interface VisionDetectionResult {
  webEntities: WebEntity[];
  bestGuessLabels: BestGuessLabel[];
  /** On-image text strings likely to be a mark name (from TEXT_DETECTION). */
  textBrandCandidates: string[];
  fullMatchingImages: ImageMatch[];
  partialMatchingImages: ImageMatch[];
  visuallySimilarImages: ImageMatch[];
  pagesWithMatchingImages: string[];
}

/**
 * Call Google Vision Web Detection on an image buffer.
 *
 * Returns:
 * - webEntities: filtered to those with a description and score > 0.5,
 *   excluding generic words
 * - bestGuessLabels: the Vision API's best-guess labels for the image
 * - fullMatchingImages: exact visual matches
 * - partialMatchingImages: partial visual matches
 * - visuallySimilarImages: visually similar images
 * - pagesWithMatchingImages: page URLs containing the image
 */
export async function detectImageEntities(
  imageBuffer: Buffer,
): Promise<VisionDetectionResult> {
  const client = getVisionClient();
  const extractPageUrl = (img: unknown): string | undefined => {
    if (!img || typeof img !== "object") return undefined;
    const candidate = (img as Record<string, unknown>).pageUrl;

    if (typeof candidate !== "string") return undefined;
    const trimmed = candidate.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  };

  const [result] = await client.annotateImage({
    image: { content: imageBuffer.toString("base64") },
    features: [{ type: "WEB_DETECTION" }, { type: "TEXT_DETECTION" }],
  });

  const webDetection = result.webDetection;

  const fullTextBlock = result.textAnnotations?.[0]?.description?.trim() ?? "";
  const textBrandCandidates = fullTextBlock
    ? extractTextBrandCandidates(fullTextBlock)
    : [];

  const webEntities: WebEntity[] = (webDetection?.webEntities ?? [])
    .filter((entity) => {
      const desc = (entity.description ?? "").trim();
      const score = entity.score ?? 0;

      return desc.length > 0 && score > 0.5 && !isGenericVisionLabel(desc);
    })
    .map((entity) => ({
      description: entity.description!.trim(),
      score: entity.score!,
    }));

  const bestGuessLabels: BestGuessLabel[] = (
    webDetection?.bestGuessLabels ?? []
  )
    .filter((label) => (label.label ?? "").trim().length > 0)
    .map((label) => ({ label: label.label!.trim() }));

  const fullMatchingImages: ImageMatch[] = (
    webDetection?.fullMatchingImages ?? []
  )
    .filter((img) => (img.url ?? "").trim().length > 0)
    .map((img) => ({
      url: img.url!.trim(),
      pageUrl: extractPageUrl(img),
    }));

  const partialMatchingImages: ImageMatch[] = (
    webDetection?.partialMatchingImages ?? []
  )
    .filter((img) => (img.url ?? "").trim().length > 0)
    .map((img) => ({
      url: img.url!.trim(),
      pageUrl: extractPageUrl(img),
    }));

  const visuallySimilarImages: ImageMatch[] = (
    webDetection?.visuallySimilarImages ?? []
  )
    .filter((img) => (img.url ?? "").trim().length > 0)
    .map((img) => ({
      url: img.url!.trim(),
      pageUrl: extractPageUrl(img),
    }));

  const pagesWithMatchingImages: string[] = (
    webDetection?.pagesWithMatchingImages ?? []
  )
    .filter((page) => (page.url ?? "").trim().length > 0)
    .map((page) => page.url!.trim());

  return {
    webEntities,
    bestGuessLabels,
    textBrandCandidates,
    fullMatchingImages,
    partialMatchingImages,
    visuallySimilarImages,
    pagesWithMatchingImages,
  };
}
