// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

/**
 * Simple test script to verify USPTO Trademark Search setup
 * 
 * Run this script to test:
 * 1. Database connection
 * 2. Required extensions (pg_trgm)
 * 3. Tables exist
 * 4. Indexes are created
 * 5. Search API endpoint responds
 * 
 * Usage:
 *   npx tsx test-uspto-setup.ts
 */

import { testConnection, checkExtensions, query, queryRows } from './lib/db/postgres';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${emoji} ${result.name}: ${result.message}`);
}

async function testDatabaseConnection() {
  try {
    const connected = await testConnection();
    if (connected) {
      logResult({
        name: 'Database Connection',
        status: 'PASS',
        message: 'Successfully connected to PostgreSQL database',
      });
      return true;
    } else {
      logResult({
        name: 'Database Connection',
        status: 'FAIL',
        message: 'Failed to connect to database',
      });
      return false;
    }
  } catch (error) {
    logResult({
      name: 'Database Connection',
      status: 'FAIL',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

async function testExtensions() {
  try {
    const extensions = await checkExtensions();
    if (extensions.pg_trgm) {
      logResult({
        name: 'pg_trgm Extension',
        status: 'PASS',
        message: 'pg_trgm extension is installed',
      });
      return true;
    } else {
      logResult({
        name: 'pg_trgm Extension',
        status: 'FAIL',
        message: 'pg_trgm extension is NOT installed. Run the migration file.',
      });
      return false;
    }
  } catch (error) {
    logResult({
      name: 'pg_trgm Extension',
      status: 'FAIL',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

async function testTables() {
  try {
    const tables = await queryRows<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_name IN ('trademarks', 'trademark_classes', 'import_runs')
       ORDER BY table_name`
    );

    const tableNames = tables.map(t => t.table_name);
    const expectedTables = ['import_runs', 'trademark_classes', 'trademarks'];
    const allExist = expectedTables.every(t => tableNames.includes(t));

    if (allExist) {
      logResult({
        name: 'Tables Created',
        status: 'PASS',
        message: `All tables exist: ${tableNames.join(', ')}`,
      });
      return true;
    } else {
      const missing = expectedTables.filter(t => !tableNames.includes(t));
      logResult({
        name: 'Tables Created',
        status: 'FAIL',
        message: `Missing tables: ${missing.join(', ')}. Run the migration file.`,
      });
      return false;
    }
  } catch (error) {
    logResult({
      name: 'Tables Created',
      status: 'FAIL',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

async function testIndexes() {
  try {
    const indexes = await queryRows<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes 
       WHERE tablename = 'trademarks' 
       AND indexname IN ('idx_trademarks_mark_text_tsv', 'idx_trademarks_mark_text_trgm')
       ORDER BY indexname`
    );

    const indexNames = indexes.map(i => i.indexname);
    const expectedIndexes = ['idx_trademarks_mark_text_trgm', 'idx_trademarks_mark_text_tsv'];
    const allExist = expectedIndexes.every(i => indexNames.includes(i));

    if (allExist) {
      logResult({
        name: 'Search Indexes',
        status: 'PASS',
        message: `All search indexes exist: ${indexNames.join(', ')}`,
      });
      return true;
    } else {
      const missing = expectedIndexes.filter(i => !indexNames.includes(i));
      logResult({
        name: 'Search Indexes',
        status: 'FAIL',
        message: `Missing indexes: ${missing.join(', ')}. Run the migration file.`,
      });
      return false;
    }
  } catch (error) {
    logResult({
      name: 'Search Indexes',
      status: 'FAIL',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

async function testSearchFunction() {
  try {
    const result = await query(
      `SELECT EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname = 'search_trademarks'
      ) as exists`
    );

    if (result.rows[0]?.exists) {
      logResult({
        name: 'Search Function',
        status: 'PASS',
        message: 'search_trademarks() function exists',
      });
      return true;
    } else {
      logResult({
        name: 'Search Function',
        status: 'FAIL',
        message: 'search_trademarks() function not found. Run the migration file.',
      });
      return false;
    }
  } catch (error) {
    logResult({
      name: 'Search Function',
      status: 'FAIL',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

async function testDataCount() {
  try {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*)::text as count FROM public.trademarks'
    );

    const count = parseInt(result.rows[0]?.count || '0', 10);
    
    if (count > 0) {
      logResult({
        name: 'Trademark Data',
        status: 'PASS',
        message: `Database contains ${count.toLocaleString()} trademark records`,
      });
    } else {
      logResult({
        name: 'Trademark Data',
        status: 'SKIP',
        message: 'No trademark data imported yet (this is expected for Step 1)',
      });
    }
    return true;
  } catch (error) {
    logResult({
      name: 'Trademark Data',
      status: 'FAIL',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

async function testAPIEndpoint() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(
      `${baseUrl}/api/trademarks/search?query=test&limit=5`
    );

    if (response.ok) {
      const data = await response.json();
      logResult({
        name: 'API Endpoint',
        status: 'PASS',
        message: `Search API is responding (found ${data.count || 0} results)`,
      });
      return true;
    } else {
      const error = await response.text();
      logResult({
        name: 'API Endpoint',
        status: 'FAIL',
        message: `API returned ${response.status}: ${error.substring(0, 100)}`,
      });
      return false;
    }
  } catch (error) {
    logResult({
      name: 'API Endpoint',
      status: 'SKIP',
      message: 'Cannot test API endpoint (dev server may not be running)',
    });
    return true; // Don't fail the test suite
  }
}

async function runTests() {
  console.log('🔍 USPTO Trademark Search Engine - Setup Verification\n');
  console.log('═'.repeat(60));
  console.log();

  // Test 1: Database connection
  const connectionOk = await testDatabaseConnection();
  if (!connectionOk) {
    console.log('\n❌ Database connection failed. Please check your DATABASE_URL in .env.local');
    console.log('   Get your connection string from: https://supabase.com/dashboard/project/_/settings/database');
    process.exit(1);
  }

  console.log();

  // Test 2: Extensions
  await testExtensions();

  // Test 3: Tables
  await testTables();

  // Test 4: Indexes
  await testIndexes();

  // Test 5: Functions
  await testSearchFunction();

  console.log();

  // Test 6: Data count
  await testDataCount();

  // Test 7: API endpoint (optional)
  console.log();
  await testAPIEndpoint();

  // Summary
  console.log();
  console.log('═'.repeat(60));
  console.log();

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`📊 Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log();

  if (failed > 0) {
    console.log('❌ Some tests failed. Please run the migration file:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/_/sql/new');
    console.log('   2. Copy contents of: uspto-trademark-schema.sql');
    console.log('   3. Paste and run in SQL Editor');
    console.log();
    process.exit(1);
  } else if (passed >= 5) {
    console.log('✅ Setup verification complete! Your trademark search engine is ready.');
    console.log();
    console.log('Next steps:');
    console.log('   1. Start dev server: pnpm dev');
    console.log('   2. Test search: curl "http://localhost:3000/api/trademarks/search?query=test"');
    console.log('   3. Import USPTO data (Step 2 - not yet implemented)');
    console.log();
  }

  process.exit(0);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
