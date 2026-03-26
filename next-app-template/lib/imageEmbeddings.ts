import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
} from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Image embedding service using CLIP (Contrastive Language-Image Pre-training)
 * Generates 512-dimensional embeddings for visual similarity comparison
 */

let processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | null = null;
let visionModel: Awaited<ReturnType<typeof CLIPVisionModelWithProjection.from_pretrained>> | null = null;

/**
 * Initialize CLIP model (lazy-loaded on first use)
 */
async function initializeModel() {
  if (!processor || !visionModel) {
    console.log('[ImageEmbeddings] Loading CLIP model...');
    const startTime = Date.now();
    
    processor = await AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch16');
    visionModel = await CLIPVisionModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch16');
    
    const duration = Date.now() - startTime;
    console.log(`[ImageEmbeddings] CLIP model loaded in ${duration}ms`);
  }
  return { processor, visionModel };
}

/**
 * Generate embedding for an image buffer
 * Returns a 512-dimensional float32 array
 */
export async function generateImageEmbedding(imageBuffer: Buffer): Promise<Float32Array> {
  const { processor, visionModel } = await initializeModel();

  // RawImage.read() only supports URLs and file paths, not buffers or data URLs
  // Write to temp file, process, then clean up
  const tempFile = path.join(os.tmpdir(), `clip-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  
  try {
    const imageBytes = new Uint8Array(
      imageBuffer.buffer,
      imageBuffer.byteOffset,
      imageBuffer.byteLength
    );
    fs.writeFileSync(tempFile, imageBytes);
    
    const image = await RawImage.read(tempFile);
    const imageInputs = await processor(image);
    const { image_embeds } = await visionModel(imageInputs);

    // Extract the embedding as Float32Array
    // image_embeds is a Tensor with shape [1, 512]
    const embedding = image_embeds.data as Float32Array;
    
    return embedding;
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(tempFile);
    } catch (err) {
      console.warn(`[ImageEmbeddings] Failed to delete temp file ${tempFile}:`, err);
    }
  }
}

/**
 * Generate embedding for an image URL
 * Fetches the image, then generates embedding
 */
export async function generateImageEmbeddingFromUrl(imageUrl: string): Promise<Float32Array> {
  const { processor, visionModel } = await initializeModel();

  const image = await RawImage.read(imageUrl);
  const imageInputs = await processor(image);
  const { image_embeds } = await visionModel(imageInputs);

  const embedding = image_embeds.data as Float32Array;
  
  return embedding;
}

/**
 * Compute cosine similarity between two embeddings
 * Returns a value between -1 and 1 (higher = more similar)
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}
