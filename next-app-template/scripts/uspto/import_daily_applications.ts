#!/usr/bin/env node
/**
 * USPTO Daily Applications Importer
 * 
 * Downloads and imports USPTO trademark daily application files into the database.
 * Uses the USPTO Bulk Datasets API (api.uspto.gov).
 * 
 * Usage:
 *   # Download from API
 *   npx tsx scripts/uspto/import_daily_applications.ts --from=YYYY-MM-DD --to=YYYY-MM-DD
 * 
 *   # Import local ZIP file
 *   npx tsx scripts/uspto/import_daily_applications.ts --zip=/path/to/file.zip
 * 
 * Examples:
 *   npx tsx scripts/uspto/import_daily_applications.ts --from=2025-02-10 --to=2025-02-13
 *   npx tsx scripts/uspto/import_daily_applications.ts --zip=./downloads/apc260212.zip
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { parseTrademarkXML } from './xml_parser';
import { 
  createImportRun, 
  completeImportRun, 
  BatchAccumulator,
  getSampleTrademarks,
  getTrademarkCount,
} from './db_operations';
import { 
  IMPORTER_CONFIG,
  listAvailableFiles,
  filterFilesByDateRange,
  downloadFile as downloadFileFromAPI,
  formatDateForAPI,
  parseReleaseDate,
  type USPTOFile,
} from './uspto_sources';

/**
 * Parse command line arguments
 */
function parseArgs(): { mode: 'api'; from: Date; to: Date } | { mode: 'manual'; zipPath: string } {
  const args = process.argv.slice(2);
  
  let fromDate: Date | null = null;
  let toDate: Date | null = null;
  let zipPath: string | null = null;

  for (const arg of args) {
    if (arg.startsWith('--from=')) {
      fromDate = new Date(arg.substring(7));
    } else if (arg.startsWith('--to=')) {
      toDate = new Date(arg.substring(5));
    } else if (arg.startsWith('--zip=')) {
      zipPath = arg.substring(6);
    }
  }

  // Manual ZIP mode
  if (zipPath) {
    // Resolve path relative to current working directory
    const resolvedPath = path.resolve(process.cwd(), zipPath);
    
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: ZIP file not found: ${resolvedPath}`);
      process.exit(1);
    }

    if (!resolvedPath.toLowerCase().endsWith('.zip')) {
      console.error('Error: File must be a .zip file');
      process.exit(1);
    }

    return { mode: 'manual', zipPath: resolvedPath };
  }

  // API download mode - require --from and --to
  if (!fromDate || isNaN(fromDate.getTime())) {
    console.error('Error: --from=YYYY-MM-DD is required (or use --zip for manual import)');
    process.exit(1);
  }

  if (!toDate || isNaN(toDate.getTime())) {
    console.error('Error: --to=YYYY-MM-DD is required (or use --zip for manual import)');
    process.exit(1);
  }

  if (toDate < fromDate) {
    console.error('Error: --to date must be after --from date');
    process.exit(1);
  }

  const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 7) {
    console.error('Error: Date range must be 7 days or less (use multiple runs for larger ranges)');
    process.exit(1);
  }

  return { mode: 'api', from: fromDate, to: toDate };
}

/**
 * Extract ZIP file to directory
 */
async function extractZip(zipPath: string, extractDir: string): Promise<string[]> {
  console.log(`  📦 Extracting ZIP...`);
  
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  
  const xmlFiles: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.xml')) {
      const extractPath = path.join(extractDir, entry.entryName);
      zip.extractEntryTo(entry, extractDir, false, true);
      xmlFiles.push(extractPath);
      console.log(`     ✓ Extracted: ${entry.entryName}`);
    }
  }

  return xmlFiles;
}

/**
 * Process a single file
 */
async function processFile(
  file: USPTOFile,
  accumulator: BatchAccumulator
): Promise<{ processed: number; skipped: boolean }> {
  const releaseDate = parseReleaseDate(file);
  const dateStr = formatDateForAPI(releaseDate);
  
  console.log(`\n📅 Processing file: ${file.fileName}`);
  console.log(`   Release date: ${dateStr}`);

  // Create temp directory for this file
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), IMPORTER_CONFIG.tempDirPrefix)
  );

  try {
    // Download file
    const zipPath = path.join(tempDir, file.fileName);
    const downloadResult = await downloadFileFromAPI(file.fileName, zipPath);
    
    if (!downloadResult.success) {
      console.log(`   ⏭️  Skipping ${file.fileName} (download failed)`);
      return { processed: 0, skipped: true };
    }

    if (downloadResult.redirectUrl) {
      console.log(`   📍 Final resolved URL: ${downloadResult.redirectUrl}`);
    }

    if (downloadResult.contentType) {
      console.log(`   📄 Content-Type: ${downloadResult.contentType}`);
    }

    // Extract ZIP
    const xmlFiles = await extractZip(zipPath, tempDir);
    if (xmlFiles.length === 0) {
      console.log(`   ⚠️  No XML files found in ZIP`);
      return { processed: 0, skipped: true };
    }

    // Process each XML file
    let fileProcessed = 0;
    for (const xmlFile of xmlFiles) {
      console.log(`   📄 Parsing: ${path.basename(xmlFile)}`);
      
      const stream = fs.createReadStream(xmlFile);
      
      const { totalRecords, errors } = await parseTrademarkXML(stream, async (record) => {
        await accumulator.add(record);
        fileProcessed++;
      });

      console.log(`   ✓ Parsed ${totalRecords} records (${errors} errors)`);
      
      // CRITICAL: Wait for any pending flush operations
      await accumulator.waitForIdle();
    }

    // CRITICAL: Flush any remaining records in the final batch
    console.log(`\n   🔄 Flushing final batch...`);
    await accumulator.flush();
    
    // CRITICAL: Wait for all operations to complete
    await accumulator.waitForIdle();

    return { processed: fileProcessed, skipped: false };

  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`   ⚠️  Failed to cleanup temp directory: ${tempDir}`);
    }
  }
}

/**
 * Process a manual ZIP file
 */
async function processManualZip(
  zipPath: string,
  accumulator: BatchAccumulator
): Promise<{ processed: number }> {
  const fileName = path.basename(zipPath);
  
  console.log(`\n📦 Processing manual ZIP: ${fileName}`);
  console.log(`   Path: ${zipPath}`);

  // Get file size
  const stats = fs.statSync(zipPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`   Size: ${sizeMB} MB`);

  // Create temp directory
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), IMPORTER_CONFIG.tempDirPrefix)
  );

  try {
    // Extract ZIP
    const xmlFiles = await extractZip(zipPath, tempDir);
    if (xmlFiles.length === 0) {
      console.log(`   ⚠️  No XML files found in ZIP`);
      return { processed: 0 };
    }

    // Process each XML file
    let totalProcessed = 0;
    for (const xmlFile of xmlFiles) {
      console.log(`   📄 Parsing: ${path.basename(xmlFile)}`);
      
      const stream = fs.createReadStream(xmlFile);
      
      const { totalRecords, errors } = await parseTrademarkXML(stream, async (record) => {
        await accumulator.add(record);
        totalProcessed++;
      });

      console.log(`   ✓ Parsed ${totalRecords} records (${errors} errors)`);
      
      // CRITICAL: Wait for any pending flush operations
      await accumulator.waitForIdle();
    }

    // CRITICAL: Flush any remaining records in the final batch
    console.log(`\n   🔄 Flushing final batch...`);
    await accumulator.flush();
    
    // CRITICAL: Wait for all operations to complete
    await accumulator.waitForIdle();

    return { processed: totalProcessed };

  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`   ⚠️  Failed to cleanup temp directory: ${tempDir}`);
    }
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 USPTO Daily Applications Importer\n');

  // Parse arguments
  const args = parseArgs();

  // Manual ZIP mode
  if (args.mode === 'manual') {
    console.log('Mode: Manual ZIP Import\n');
    console.log('═'.repeat(60));

    try {
      // Create import run
      const importRunId = await createImportRun('USPTO', 'manual-zip');
      console.log(`\nImport run ID: ${importRunId}\n`);

      // Create batch accumulator
      const accumulator = new BatchAccumulator(
        importRunId,
        IMPORTER_CONFIG.batchSize,
        'USPTO',
        'manual-zip'
      );

      // Get initial count
      const initialCount = await getTrademarkCount();
      console.log(`Database: ${initialCount.toLocaleString()} trademarks before import\n`);
      console.log('═'.repeat(60));

      // Process the ZIP file
      const result = await processManualZip(args.zipPath, accumulator);

      // Get batch statistics
      const stats = accumulator.getStats();

      // Mark as completed
      await completeImportRun(importRunId, 'COMPLETED');

      // Print summary
      console.log('\n✅ Import completed successfully!\n');
      console.log('═'.repeat(60));
      console.log('Summary:');
      console.log('─'.repeat(60));
      
      const finalCount = await getTrademarkCount();
      // 🔧 FIX 4: Guard against NaN with null coalescing
      console.log(`Records emitted by parser: ${(stats.emitted ?? 0).toLocaleString()}`);
      console.log(`Records inserted to DB:    ${(stats.inserted ?? 0).toLocaleString()}`);
      console.log(`Records pending:           ${(stats.pending ?? 0).toLocaleString()}`);
      console.log(`Database before:           ${initialCount.toLocaleString()} trademarks`);
      console.log(`Database after:            ${finalCount.toLocaleString()} trademarks`);
      console.log(`Net change:                +${(finalCount - initialCount).toLocaleString()}`);
      console.log(`Import run ID:             ${importRunId}`);
      console.log(`Source file:               ${path.basename(args.zipPath)}`);
      
      // Verify emitted vs inserted
      if (stats.emitted !== stats.inserted) {
        console.log(`\n⚠️  WARNING: Emitted (${stats.emitted ?? 0}) != Inserted (${stats.inserted ?? 0})`);
        console.log(`   This may indicate records were lost during import.`);
      } else {
        console.log(`\n✓ All emitted records were successfully inserted (${stats.emitted ?? 0} = ${stats.inserted ?? 0})`);
      };
      
      // Get sample records
      console.log('\n📊 Sample imported trademarks:');
      console.log('─'.repeat(60));
      const samples = await getSampleTrademarks(3);
      for (const sample of samples) {
        console.log(`Serial: ${sample.serial_number}`);
        console.log(`  Mark: ${sample.mark_text || '(no text)'}`);
        console.log(`  Status: ${sample.status_norm || 'N/A'}`);
        console.log(`  Owner: ${sample.owner_name || 'N/A'}`);
        console.log(`  Filed: ${sample.filing_date || 'N/A'}`);
        console.log();
      }

      console.log('═'.repeat(60));
      console.log('\n🔍 Test search API:');
      if (samples.length > 0 && samples[0].mark_text) {
        const searchTerm = samples[0].mark_text.split(' ')[0].toLowerCase();
        console.log(`  curl "http://localhost:3000/api/trademarks/search?query=${searchTerm}"`);
      }
      console.log();

    } catch (error) {
      console.error('\n❌ Import failed:', error);
      process.exit(1);
    }
    
    return;
  }

  // API download mode
  console.log('Mode: API Download\n');
  console.log('Using USPTO Bulk Datasets API (api.uspto.gov)\n');

  console.log(`Date range: ${formatDateForAPI(args.from)} to ${formatDateForAPI(args.to)}\n`);

  try {
    // Step 1: List available files from USPTO API
    console.log('Step 1: Fetching available files from USPTO API...\n');
    const allFiles = await listAvailableFiles();

    // Step 2: Filter files by date range
    console.log('\nStep 2: Filtering files by date range...\n');
    const matchingFiles = filterFilesByDateRange(allFiles, args.from, args.to);

    if (matchingFiles.length === 0) {
      console.log('⚠️  No files found for the specified date range.');
      console.log('   Try a different date range or check USPTO API for available dates.');
      process.exit(0);
    }

    console.log(`✓ Found ${matchingFiles.length} file(s) matching date range:\n`);
    for (const file of matchingFiles) {
      console.log(`   • ${file.fileName}`);
      console.log(`     Release date: ${file.releaseDate}`);
      if (file.fileSize) {
        console.log(`     Size: ${(file.fileSize / 1024 / 1024).toFixed(2)} MB`);
      }
    }

    // Create import run
    console.log('\n' + '═'.repeat(60));
    const importRunId = await createImportRun('USPTO', 'uspto-daily-api');
    console.log(`\nImport run ID: ${importRunId}\n`);

    // Create batch accumulator
    const accumulator = new BatchAccumulator(
      importRunId,
      IMPORTER_CONFIG.batchSize,
      'USPTO',
      'uspto-daily-api'
    );

    let totalProcessed = 0;
    let skippedFiles = 0;

    // Get initial count
    const initialCount = await getTrademarkCount();
    console.log(`Database: ${initialCount.toLocaleString()} trademarks before import\n`);
    console.log('═'.repeat(60));

    // Step 3: Process each file
    for (const file of matchingFiles) {
      const result = await processFile(file, accumulator);
      totalProcessed += result.processed;
      if (result.skipped) skippedFiles++;
    }

    // CRITICAL: Final flush to ensure all records are written
    console.log('\n🔄 Flushing final batch...');
    await accumulator.flush();
    
    // CRITICAL: Wait for all pending operations
    await accumulator.waitForIdle();

    // Get batch statistics
    const stats = accumulator.getStats();

    // Mark as completed
    await completeImportRun(importRunId, 'COMPLETED');

    // Print summary
    console.log('\n✅ Import completed successfully!\n');
    console.log('═'.repeat(60));
    console.log('Summary:');
    console.log('─'.repeat(60));
    
    const finalCount = await getTrademarkCount();
    // 🔧 FIX 4: Guard against NaN with null coalescing
    console.log(`Records emitted by parser: ${(stats.emitted ?? 0).toLocaleString()}`);
    console.log(`Records inserted to DB:    ${(stats.inserted ?? 0).toLocaleString()}`);
    console.log(`Records pending:           ${(stats.pending ?? 0).toLocaleString()}`);
    console.log(`Database before:           ${initialCount.toLocaleString()} trademarks`);
    console.log(`Database after:            ${finalCount.toLocaleString()} trademarks`);
    console.log(`Net change:                +${(finalCount - initialCount).toLocaleString()}`);
    console.log(`Files processed:           ${matchingFiles.length - skippedFiles}/${matchingFiles.length}`);
    console.log(`Import run ID:             ${importRunId}`);
    
    // Verify emitted vs inserted
    if (stats.emitted !== stats.inserted) {
      console.log(`\n⚠️  WARNING: Emitted (${stats.emitted ?? 0}) != Inserted (${stats.inserted ?? 0})`);
      console.log(`   This may indicate records were lost during import.`);
    } else {
      console.log(`\n✓ All emitted records were successfully inserted (${stats.emitted ?? 0} = ${stats.inserted ?? 0})`);
    };
    
    // Get sample records
    console.log('\n📊 Sample imported trademarks:');
    console.log('─'.repeat(60));
    const samples = await getSampleTrademarks(3);
    for (const sample of samples) {
      console.log(`Serial: ${sample.serial_number}`);
      console.log(`  Mark: ${sample.mark_text || '(no text)'}`);
      console.log(`  Status: ${sample.status_norm || 'N/A'}`);
      console.log(`  Owner: ${sample.owner_name || 'N/A'}`);
      console.log(`  Filed: ${sample.filing_date || 'N/A'}`);
      console.log();
    }

    console.log('═'.repeat(60));
    console.log('\n🔍 Test search API:');
    if (samples.length > 0 && samples[0].mark_text) {
      const searchTerm = samples[0].mark_text.split(' ')[0].toLowerCase();
      console.log(`  curl "http://localhost:3000/api/trademarks/search?query=${searchTerm}"`);
    }
    console.log();

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    
    // Try to mark import as failed if we have an ID
    try {
      const importRunId = await createImportRun('USPTO', 'uspto-daily-api');
      await completeImportRun(
        importRunId, 
        'FAILED', 
        error instanceof Error ? error.message : 'Unknown error'
      );
    } catch {
      // Ignore errors during error handling
    }

    process.exit(1);
  }
}

// Run the importer
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
