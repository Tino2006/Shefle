import fs from 'fs';

async function testLogoSimilarity() {
  try {
    const imageBuffer = fs.readFileSync('/Users/etiennetabchoury/Downloads/nike.jpeg');
    const imageBase64 = imageBuffer.toString('base64');

    const candidates = [
      {
        url: 'https://www.ideacn.com/uploadfile/2025/0826/20250826125221508.png',
        source: 'fullMatch',
      },
      {
        url: 'https://www.mcarthurglen.com/contentassets-v12/7e388430e2aa41a49d9b3c387b0b96bd/nike.jpg',
        source: 'fullMatch',
      },
    ];

    console.log('[Test] Calling /api/logo-similarity...');
    console.log(`[Test] Image size: ${imageBuffer.length} bytes`);
    console.log(`[Test] Candidates: ${candidates.length}`);

    const response = await fetch('http://localhost:3001/api/logo-similarity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        candidates,
      }),
    });

    console.log(`[Test] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Test] Error response:', errorText);
      process.exit(1);
    }

    const data = await response.json();
    console.log('[Test] Success:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[Test] Failed:', error);
    process.exit(1);
  }
}

testLogoSimilarity();
