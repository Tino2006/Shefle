import fs from 'fs';

/**
 * End-to-end test of Vision + Logo Similarity pipeline
 * 
 * Flow:
 * 1. Upload Nike logo to /api/ocr
 * 2. Get Vision detection results (text + image URLs)
 * 3. Call /api/logo-similarity with image + candidate URLs
 * 4. Display visual similarity results
 */

async function testFullFlow() {
  try {
    console.log('=== Step 1: Upload to /api/ocr ===');
    const imageBuffer = fs.readFileSync('/Users/etiennetabchoury/Downloads/nike.jpeg');
    
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('image', blob, 'nike.jpeg');

    const ocrResponse = await fetch('http://localhost:3001/api/ocr', {
      method: 'POST',
      body: formData,
    });

    if (!ocrResponse.ok) {
      throw new Error(`OCR failed: ${ocrResponse.status}`);
    }

    const ocrData = await ocrResponse.json();
    console.log(`✓ Query: "${ocrData.query}"`);
    console.log(`✓ Source: ${ocrData.source}`);
    console.log(`✓ Full matching images: ${ocrData.imageMatches.fullMatching.length}`);
    console.log(`✓ Partial matching images: ${ocrData.imageMatches.partialMatching.length}`);
    console.log(`✓ Visually similar images: ${ocrData.imageMatches.visuallySimilar.length}`);
    console.log(`✓ Pages with matching images: ${ocrData.pagesWithMatchingImages.length}`);

    if (ocrData.imageMatches.fullMatching.length === 0 && 
        ocrData.imageMatches.partialMatching.length === 0 && 
        ocrData.imageMatches.visuallySimilar.length === 0) {
      console.log('\n⚠ No candidate images found. Skipping similarity test.');
      return;
    }

    console.log('\n=== Step 2: Test logo similarity ===');
    
    // Build candidates from Vision results
    const candidates: Array<{
      url: string;
      pageUrl?: string;
      source: 'fullMatch' | 'partialMatch' | 'visuallySimilar';
    }> = [];

    ocrData.imageMatches.fullMatching.forEach((img: any) => {
      candidates.push({ ...img, source: 'fullMatch' });
    });

    ocrData.imageMatches.partialMatching.forEach((img: any) => {
      candidates.push({ ...img, source: 'partialMatch' });
    });

    ocrData.imageMatches.visuallySimilar.forEach((img: any) => {
      candidates.push({ ...img, source: 'visuallySimilar' });
    });

    // Test with first 3 candidates
    const testCandidates = candidates.slice(0, 3);
    console.log(`Testing with ${testCandidates.length} candidates...`);

    const imageBase64 = imageBuffer.toString('base64');
    const similarityResponse = await fetch('http://localhost:3001/api/logo-similarity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        candidates: testCandidates,
      }),
    });

    if (!similarityResponse.ok) {
      const errorText = await similarityResponse.text();
      throw new Error(`Similarity failed: ${similarityResponse.status} - ${errorText}`);
    }

    const similarityData = await similarityResponse.json();
    console.log(`\n✓ Found ${similarityData.count} visual matches`);
    
    if (similarityData.results.length > 0) {
      console.log('\nTop matches:');
      similarityData.results.forEach((result: any, idx: number) => {
        console.log(
          `  ${idx + 1}. ${(result.similarityScore * 100).toFixed(1)}% - ${result.source} - ${result.url.substring(0, 80)}...`
        );
      });
    }

    console.log('\n=== Test Complete ===');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testFullFlow();
