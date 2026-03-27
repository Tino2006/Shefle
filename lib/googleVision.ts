import vision from '@google-cloud/vision';

function getVisionClient() {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (credentialsJson) {
    const credentials = JSON.parse(credentialsJson);
    return new vision.ImageAnnotatorClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      projectId: credentials.project_id,
    });
  }
  // Falls back to Application Default Credentials (local dev with gcloud CLI)
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
