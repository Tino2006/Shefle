import { NextRequest, NextResponse } from 'next/server';
import { createPreprocessingVariants } from '@/lib/imagePreprocessing';

/**
 * Image Preprocessing API
 * POST /api/preprocess-image
 * 
 * Accepts multipart/form-data with 'image' field
 * Returns preprocessed images (normal + inverted) as base64 data URLs
 * 
 * This separates preprocessing (server-side with sharp) from OCR (client-side with Tesseract)
 */

interface PreprocessResponse {
  normal: string; // base64 data URL
  inverted: string; // base64 data URL
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

    console.log(`[Preprocess API] Processing ${file.name} (${file.type}, ${(file.size / 1024).toFixed(2)}KB)`);
    const startTime = Date.now();

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    // Create preprocessing variants (normal + inverted)
    console.log('[Preprocess API] Creating preprocessing variants...');
    const { normal, inverted } = await createPreprocessingVariants(originalBuffer);

    const duration = Date.now() - startTime;
    console.log(`[Preprocess API] Success: normal=${normal.length} bytes, inverted=${inverted.length} bytes, duration=${duration}ms`);

    // Convert buffers to base64 data URLs
    const normalDataUrl = `data:image/png;base64,${normal.toString('base64')}`;
    const invertedDataUrl = `data:image/png;base64,${inverted.toString('base64')}`;

    const response: PreprocessResponse = {
      normal: normalDataUrl,
      inverted: invertedDataUrl,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Preprocess API] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Image preprocessing failed',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred while preprocessing the image.',
      },
      { status: 500 }
    );
  }
}
