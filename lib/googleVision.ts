import vision from '@google-cloud/vision';

interface VisionServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

function parseCredentialsJson(
  raw: string,
  source: string
): VisionServiceAccountCredentials {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `[Vision API] Invalid ${source}: expected valid JSON service account credentials`
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(
      `[Vision API] Invalid ${source}: JSON must be an object`
    );
  }

  const credentials = parsed as Record<string, unknown>;
  const clientEmail = credentials.client_email;
  const privateKey = credentials.private_key;
  const projectId = credentials.project_id;

  if (typeof clientEmail !== 'string' || clientEmail.trim().length === 0) {
    throw new Error(
      `[Vision API] Invalid ${source}: missing client_email`
    );
  }

  if (typeof privateKey !== 'string' || privateKey.trim().length === 0) {
    throw new Error(
      `[Vision API] Invalid ${source}: missing private_key`
    );
  }

  return {
    client_email: clientEmail.trim(),
    // Support envs where newline escapes are pasted literally.
    private_key: privateKey.replace(/\\n/g, '\n'),
    project_id: typeof projectId === 'string' ? projectId : undefined,
  };
}

function loadVisionCredentialsFromEnv():
  | VisionServiceAccountCredentials
  | null {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (credentialsJson && credentialsJson.trim().length > 0) {
    return parseCredentialsJson(credentialsJson, 'GOOGLE_CREDENTIALS_JSON');
  }

  const inlineGoogleApplicationCredentials =
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (
    inlineGoogleApplicationCredentials &&
    inlineGoogleApplicationCredentials.trim().startsWith('{')
  ) {
    return parseCredentialsJson(
      inlineGoogleApplicationCredentials,
      'GOOGLE_APPLICATION_CREDENTIALS'
    );
  }

  const base64Credentials = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (base64Credentials && base64Credentials.trim().length > 0) {
    const decoded = Buffer.from(base64Credentials, 'base64').toString('utf8');
    return parseCredentialsJson(decoded, 'GOOGLE_CREDENTIALS_BASE64');
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

  if (process.env.VERCEL || process.env.VERCEL_ENV === 'production') {
    throw new Error(
      '[Vision API] Missing credentials in Vercel runtime. Set GOOGLE_CREDENTIALS_JSON to the full service account JSON in Vercel Project Settings > Environment Variables, then redeploy.'
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
  'logo',
  'image',
  'black',
  'white',
  'font',
  'brand',
  'design',
  'icon',
  'text',
  'graphic',
  'vector',
  'symbol',
  'product',
  'color',
  'colour',
  'background',
  'red',
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'photography',
  'stock photography',
  'clip art',
  'illustration',
  'picture',
  'photo',
  'photograph',
  'trademark',
  'registered',
  'copyright',
]);

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
  imageBuffer: Buffer
): Promise<VisionDetectionResult> {
  const client = getVisionClient();
  const extractPageUrl = (img: unknown): string | undefined => {
    if (!img || typeof img !== 'object') return undefined;
    const candidate = (img as Record<string, unknown>).pageUrl;
    if (typeof candidate !== 'string') return undefined;
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const [result] = await client.webDetection({
    image: { content: imageBuffer.toString('base64') },
  });

  const webDetection = result.webDetection;

  const webEntities: WebEntity[] = (webDetection?.webEntities ?? [])
    .filter((entity) => {
      const desc = (entity.description ?? '').trim().toLowerCase();
      const score = entity.score ?? 0;
      return desc.length > 0 && score > 0.5 && !GENERIC_WORDS.has(desc);
    })
    .map((entity) => ({
      description: entity.description!.trim(),
      score: entity.score!,
    }));

  const bestGuessLabels: BestGuessLabel[] = (
    webDetection?.bestGuessLabels ?? []
  )
    .filter((label) => (label.label ?? '').trim().length > 0)
    .map((label) => ({ label: label.label!.trim() }));

  const fullMatchingImages: ImageMatch[] = (
    webDetection?.fullMatchingImages ?? []
  )
    .filter((img) => (img.url ?? '').trim().length > 0)
    .map((img) => ({
      url: img.url!.trim(),
      pageUrl: extractPageUrl(img),
    }));

  const partialMatchingImages: ImageMatch[] = (
    webDetection?.partialMatchingImages ?? []
  )
    .filter((img) => (img.url ?? '').trim().length > 0)
    .map((img) => ({
      url: img.url!.trim(),
      pageUrl: extractPageUrl(img),
    }));

  const visuallySimilarImages: ImageMatch[] = (
    webDetection?.visuallySimilarImages ?? []
  )
    .filter((img) => (img.url ?? '').trim().length > 0)
    .map((img) => ({
      url: img.url!.trim(),
      pageUrl: extractPageUrl(img),
    }));

  const pagesWithMatchingImages: string[] = (
    webDetection?.pagesWithMatchingImages ?? []
  )
    .filter((page) => (page.url ?? '').trim().length > 0)
    .map((page) => page.url!.trim());

  return {
    webEntities,
    bestGuessLabels,
    fullMatchingImages,
    partialMatchingImages,
    visuallySimilarImages,
    pagesWithMatchingImages,
  };
}
