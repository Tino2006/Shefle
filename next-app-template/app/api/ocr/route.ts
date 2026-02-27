import { NextRequest, NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';
import { normalizeText } from '@/lib/normalizeText';
import { generateCandidateQueries } from '@/lib/queryGeneration';
import { createPreprocessingVariants } from '@/lib/imagePreprocessing';

/**
 * OCR API with Image Preprocessing
 * POST /api/ocr
 * 
 * Accepts multipart/form-data with 'image' field
 * 
 * Features:
 * - Image preprocessing with sharp (rotate, resize, grayscale, normalize, threshold)
 * - Dual-pass OCR: normal + inverted (for white-on-dark logos)
 * - Returns best result based on confidence + text length
 * - Generates candidate search queries
 */

interface OCRResult {
  text: string;
  confidence: number;
  normalized_text: string;
  candidates: string[];
  preprocessing: 'normal' | 'inverted';
}

interface OCRPassResult {
  text: string;
  confidence: number;
  preprocessing: 'normal' | 'inverted';
}

async function runOCRPass(imageBuffer: Buffer, preprocessing: 'normal' | 'inverted'): Promise<OCRPassResult> {
  // For Next.js API routes, we need to configure Tesseract to use browser-compatible paths
  // even though we're on the server, because Next.js bundles it for edge runtime
  const result = await Tesseract.recognize(imageBuffer, 'eng', {
    workerPath: '/tesseract/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/tesseract-core-lstm.wasm.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`[OCR ${preprocessing}] Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  return {
    text: result.data.text.trim(),
    confidence: result.data.confidence,
    preprocessing,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Missing image file' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PNG, JPG, or WEBP images.' },
        { status: 400 }
      );
    }

    // Validate file size (8MB max)
    const maxSize = 8 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 8MB.` },
        { status: 400 }
      );
    }

    console.log(`[OCR API] Processing ${file.name} (${file.type}, ${(file.size / 1024).toFixed(2)}KB)`);
    const startTime = Date.now();

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    // Create preprocessing variants (normal + inverted)
    console.log('[OCR API] Creating preprocessing variants...');
    let normal: Buffer, inverted: Buffer;
    try {
      const variants = await createPreprocessingVariants(originalBuffer);
      normal = variants.normal;
      inverted = variants.inverted;
      console.log(`[OCR API] Preprocessing complete: normal=${normal.length} bytes, inverted=${inverted.length} bytes`);
    } catch (preprocessError) {
      console.error('[OCR API] Preprocessing failed:', preprocessError);
      throw new Error('Image preprocessing failed. Please try a different image.');
    }

    // Run dual-pass OCR
    console.log('[OCR API] Running dual-pass OCR...');
    const [passA, passB] = await Promise.all([
      runOCRPass(normal, 'normal'),
      runOCRPass(inverted, 'inverted'),
    ]);

    console.log(`[OCR API] Pass A (normal): confidence=${passA.confidence.toFixed(2)}%, text="${passA.text.substring(0, 50)}"`);
    console.log(`[OCR API] Pass B (inverted): confidence=${passB.confidence.toFixed(2)}%, text="${passB.text.substring(0, 50)}"`);

    // Pick the best result based on:
    // 1. Higher confidence
    // 2. If confidence is close (within 5%), prefer longer text
    let bestPass: OCRPassResult;
    const confidenceDiff = Math.abs(passA.confidence - passB.confidence);

    if (confidenceDiff < 5) {
      // Confidence is similar, pick the one with longer text
      bestPass = passA.text.length >= passB.text.length ? passA : passB;
      console.log(`[OCR API] Similar confidence, chose ${bestPass.preprocessing} (longer text)`);
    } else {
      // Pick the one with higher confidence
      bestPass = passA.confidence > passB.confidence ? passA : passB;
      console.log(`[OCR API] Chose ${bestPass.preprocessing} (higher confidence)`);
    }

    // Normalize text
    const normalized = normalizeText(bestPass.text);

    // Generate candidate queries
    const candidates = generateCandidateQueries(normalized);

    const duration = Date.now() - startTime;
    console.log(
      `[OCR API] Success: confidence=${bestPass.confidence.toFixed(2)}%, ` +
      `preprocessing=${bestPass.preprocessing}, ` +
      `normalized="${normalized}", ` +
      `candidates=${JSON.stringify(candidates)}, ` +
      `duration=${duration}ms`
    );

    const result: OCRResult = {
      text: bestPass.text,
      confidence: bestPass.confidence / 100,
      normalized_text: normalized,
      candidates,
      preprocessing: bestPass.preprocessing,
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('[OCR API] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'OCR processing failed',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing the image.',
      },
      { status: 500 }
    );
  }
}
