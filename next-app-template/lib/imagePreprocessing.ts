/**
 * Image preprocessing utilities for OCR accuracy improvement
 */

import sharp from 'sharp';

export interface PreprocessingOptions {
  targetWidth?: number;
  threshold?: number;
  invert?: boolean;
}

/**
 * Preprocess image for OCR with sharp pipeline
 * 
 * Pipeline:
 * 1. Auto-rotate based on EXIF orientation
 * 2. Resize to target width (1200-2000px, keep aspect ratio)
 * 3. Convert to grayscale
 * 4. Normalize contrast
 * 5. Apply threshold (binarization)
 * 6. Optional: invert colors (for white-on-dark logos)
 * 
 * @param buffer - Input image buffer
 * @param options - Preprocessing options
 * @returns Processed PNG buffer
 */
export async function preprocessImageForOCR(
  buffer: Buffer,
  options: PreprocessingOptions = {}
): Promise<Buffer> {
  const {
    targetWidth = 1600,
    threshold = 160,
    invert = false,
  } = options;

  let pipeline = sharp(buffer)
    // Step 1: Auto-rotate based on EXIF orientation
    .rotate()
    // Step 2: Resize to target width (keep aspect ratio, allow enlargement)
    .resize(targetWidth, null, {
      fit: 'inside',
      withoutEnlargement: false,
    })
    // Step 3: Convert to grayscale
    .grayscale()
    // Step 4: Normalize contrast (stretches histogram)
    .normalize();

  // Step 5: Apply threshold (binarization)
  // This converts to pure black/white which helps OCR
  pipeline = pipeline.threshold(threshold);

  // Step 6: Optional invert (for white-on-dark logos)
  if (invert) {
    pipeline = pipeline.negate();
  }

  // Output as PNG buffer
  return await pipeline.png().toBuffer();
}

/**
 * Run dual-pass OCR with normal and inverted preprocessing
 * Returns the result with higher confidence and longer text
 */
export async function createPreprocessingVariants(
  buffer: Buffer
): Promise<{ normal: Buffer; inverted: Buffer }> {
  const [normal, inverted] = await Promise.all([
    preprocessImageForOCR(buffer, { threshold: 160, invert: false }),
    preprocessImageForOCR(buffer, { threshold: 160, invert: true }),
  ]);

  return { normal, inverted };
}
