/**
 * Test script for /api/trademarks/search endpoint validation
 * 
 * Tests that optional parameters (status, classes) are properly handled:
 * - Accepts requests without status/classes
 * - Accepts empty string for status/classes
 * - Validates only when parameters are provided and non-empty
 * 
 * Usage:
 *   node test-search-validation.mjs
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testEndpoint(description, url, expectedStatus) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    const passed = response.status === expectedStatus;
    const emoji = passed ? '✅' : '❌';
    
    console.log(`${emoji} ${description}`);
    console.log(`   URL: ${url}`);
    console.log(`   Expected: ${expectedStatus}, Got: ${response.status}`);
    
    if (!passed || response.status >= 400) {
      console.log(`   Response:`, JSON.stringify(data, null, 2));
    }
    console.log();
    
    return passed;
  } catch (error) {
    console.log(`❌ ${description}`);
    console.log(`   Error: ${error.message}`);
    console.log();
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing /api/trademarks/search validation\n');
  console.log('═'.repeat(60));
  console.log();

  const tests = [
    // Valid requests
    {
      description: 'Valid: query only',
      url: `${BASE_URL}/api/trademarks/search?query=test`,
      expectedStatus: 200,
    },
    {
      description: 'Valid: query with limit',
      url: `${BASE_URL}/api/trademarks/search?query=test&limit=10`,
      expectedStatus: 200,
    },
    {
      description: 'Valid: query with status=ACTIVE',
      url: `${BASE_URL}/api/trademarks/search?query=test&status=ACTIVE`,
      expectedStatus: 200,
    },
    {
      description: 'Valid: query with classes=9,25',
      url: `${BASE_URL}/api/trademarks/search?query=test&classes=9,25`,
      expectedStatus: 200,
    },
    {
      description: 'Valid: query with status and classes',
      url: `${BASE_URL}/api/trademarks/search?query=test&status=PENDING&classes=9`,
      expectedStatus: 200,
    },
    {
      description: 'Valid: empty status parameter (should be ignored)',
      url: `${BASE_URL}/api/trademarks/search?query=test&status=`,
      expectedStatus: 200,
    },
    {
      description: 'Valid: empty classes parameter (should be ignored)',
      url: `${BASE_URL}/api/trademarks/search?query=test&classes=`,
      expectedStatus: 200,
    },
    {
      description: 'Valid: both empty parameters (should be ignored)',
      url: `${BASE_URL}/api/trademarks/search?query=test&status=&classes=`,
      expectedStatus: 200,
    },

    // Invalid requests - query validation
    {
      description: 'Invalid: missing query',
      url: `${BASE_URL}/api/trademarks/search`,
      expectedStatus: 400,
    },
    {
      description: 'Invalid: query too short (1 char)',
      url: `${BASE_URL}/api/trademarks/search?query=a`,
      expectedStatus: 400,
    },
    {
      description: 'Invalid: empty query',
      url: `${BASE_URL}/api/trademarks/search?query=`,
      expectedStatus: 400,
    },

    // Invalid requests - filter validation
    {
      description: 'Invalid: bad status value',
      url: `${BASE_URL}/api/trademarks/search?query=test&status=INVALID`,
      expectedStatus: 400,
    },
    {
      description: 'Invalid: bad classes value (non-numeric)',
      url: `${BASE_URL}/api/trademarks/search?query=test&classes=abc`,
      expectedStatus: 400,
    },
    {
      description: 'Invalid: bad classes value (out of range)',
      url: `${BASE_URL}/api/trademarks/search?query=test&classes=999`,
      expectedStatus: 400,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await testEndpoint(test.description, test.url, test.expectedStatus);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('═'.repeat(60));
  console.log();
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  console.log();

  if (failed === 0) {
    console.log('✅ All tests passed!');
  } else {
    console.log('❌ Some tests failed. Check the output above.');
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    await fetch(`${BASE_URL}/api/trademarks/search?query=test`);
    return true;
  } catch (error) {
    console.error('❌ Cannot connect to server.');
    console.error(`   Make sure the dev server is running: pnpm dev`);
    console.error(`   Expected URL: ${BASE_URL}`);
    process.exit(1);
  }
}

// Run tests
checkServer().then(() => runTests());
