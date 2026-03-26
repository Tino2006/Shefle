#!/usr/bin/env node
/**
 * USPTO TRTDXFAP Daily Zip Auto-Downloader
 * 
 * Automatically downloads the latest USPTO TRTDXFAP (Trademark Daily XML - Applications) 
 * file using the Bulk Datasets API and optionally imports it into the database.
 * 
 * API Details:
 *   - Endpoint: https://api.uspto.gov/api/v1/datasets/products/TRTDXFAP
 *   - Authentication: X-API-KEY header (not Authorization Bearer)
 *   - Response structure: bulkDataProductBag[0].productFileBag.fileDataBag[]
 * 
 * Usage:
 *   # Download and import the latest file (auto-cleanup old files)
 *   npx tsx scripts/uspto/download_latest_trtdxfap.ts
 * 
 *   # Dry-run mode (only show what would be downloaded)
 *   npx tsx scripts/uspto/download_latest_trtdxfap.ts --dry-run
 * 
 *   # Download only (skip import)
 *   npx tsx scripts/uspto/download_latest_trtdxfap.ts --no-import
 * 
 *   # Keep more files (default is 3)
 *   npx tsx scripts/uspto/download_latest_trtdxfap.ts --keep-files=5
 * 
 *   # Disable automatic cleanup
 *   npx tsx scripts/uspto/download_latest_trtdxfap.ts --no-cleanup
 * 
 * Environment Variables:
 *   USPTO_API_KEY - Required API key for USPTO Bulk Datasets API
 *                   Get yours at: https://developer.uspto.gov/
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Configuration
 */
const API_BASE_URL = 'https://api.uspto.gov/api/v1/datasets';
const PRODUCT_ID = 'TRTDXFAP';
const DOWNLOADS_DIR = path.resolve(process.cwd(), 'downloads');
const LOCK_FILE = path.join(DOWNLOADS_DIR, '.download.lock');

/**
 * API Response Types
 */
interface FileDataBagItem {
  fileName: string;
  fileReleaseDate?: string;
  fileSize?: number;
  fileDownloadURI?: string;
  fileDescription?: string;
}

interface APIResponse {
  fileDataBag?: FileDataBagItem[];
}

/**
 * Parse command line arguments
 */
function parseArgs(): { dryRun: boolean; noImport: boolean; keepFiles: number; noCleanup: boolean } {
  const args = process.argv.slice(2);
  
  // Parse --keep-files=N argument
  let keepFiles = 3; // Default: keep 3 most recent files
  const keepArg = args.find(arg => arg.startsWith('--keep-files='));
  if (keepArg) {
    const value = parseInt(keepArg.split('=')[1]);
    if (!isNaN(value) && value > 0) {
      keepFiles = value;
    }
  }
  
  return {
    dryRun: args.includes('--dry-run'),
    noImport: args.includes('--no-import'),
    noCleanup: args.includes('--no-cleanup'),
    keepFiles,
  };
}

/**
 * Check if lock file exists
 */
function isLocked(): boolean {
  return fs.existsSync(LOCK_FILE);
}

/**
 * Create lock file
 */
function createLock(): void {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }
  fs.writeFileSync(LOCK_FILE, JSON.stringify({
    pid: process.pid,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Remove lock file
 */
function removeLock(): void {
  if (fs.existsSync(LOCK_FILE)) {
    fs.unlinkSync(LOCK_FILE);
  }
}

/**
 * Extract numeric date from filename (e.g., apc260225.zip -> 260225)
 */
function extractNumericDate(fileName: string): string | null {
  const match = fileName.match(/apc(\d{6})\.zip/i);
  return match ? match[1] : null;
}

/**
 * Select the latest file from the API response
 */
function selectLatestFile(files: FileDataBagItem[]): FileDataBagItem | null {
  if (!files || files.length === 0) {
    return null;
  }

  // Try to sort by fileReleaseDate if available
  const filesWithDate = files.filter(f => f.fileReleaseDate);
  
  if (filesWithDate.length > 0) {
    filesWithDate.sort((a, b) => {
      const dateA = new Date(a.fileReleaseDate!).getTime();
      const dateB = new Date(b.fileReleaseDate!).getTime();
      return dateB - dateA; // Descending order (latest first)
    });
    return filesWithDate[0];
  }

  // Fallback: sort by numeric date in filename
  const filesWithNumericDate = files
    .map(f => ({ file: f, numericDate: extractNumericDate(f.fileName) }))
    .filter(item => item.numericDate !== null)
    .sort((a, b) => b.numericDate!.localeCompare(a.numericDate!)); // Descending

  if (filesWithNumericDate.length > 0) {
    return filesWithNumericDate[0].file;
  }

  // Last resort: return the first file
  return files[0];
}

/**
 * Fetch available files from USPTO API
 */
async function fetchAvailableFiles(): Promise<FileDataBagItem[]> {
  const apiKey = process.env.USPTO_API_KEY;
  
  if (!apiKey) {
    throw new Error('USPTO_API_KEY environment variable is not set');
  }

  const url = `${API_BASE_URL}/products/${PRODUCT_ID}`;
  
  console.log(`📋 Fetching file list from USPTO API...`);
  console.log(`   URL: ${url}`);

  const response = await fetch(url, {
    headers: {
      'X-API-KEY': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: HTTP ${response.status} ${response.statusText}`);
  }

  const data: any = await response.json();

  // Extract files from the nested structure
  let files: FileDataBagItem[] | undefined;
  
  if (data.bulkDataProductBag && 
      Array.isArray(data.bulkDataProductBag) && 
      data.bulkDataProductBag.length > 0) {
    const product = data.bulkDataProductBag[0];
    if (product.productFileBag && product.productFileBag.fileDataBag) {
      files = product.productFileBag.fileDataBag;
    }
  }

  if (!files || files.length === 0) {
    console.error('   Unexpected API response structure');
    console.error('   Response keys:', Object.keys(data).join(', '));
    throw new Error('No files found in API response');
  }

  console.log(`   ✓ Found ${files.length} available files\n`);

  return files;
}

/**
 * Download file using streaming with redirects
 */
async function downloadFile(
  downloadUri: string,
  fileName: string,
  fileSize?: number
): Promise<void> {
  const apiKey = process.env.USPTO_API_KEY;
  
  if (!apiKey) {
    throw new Error('USPTO_API_KEY environment variable is not set');
  }

  const destPath = path.join(DOWNLOADS_DIR, fileName);
  const tempPath = `${destPath}.tmp`;

  console.log(`📥 Downloading: ${fileName}`);
  console.log(`   URI: ${downloadUri}`);
  if (fileSize) {
    console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  }

  // Ensure downloads directory exists
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }

  // Fetch with redirect following and authentication
  const response = await fetch(downloadUri, {
    headers: {
      'X-API-KEY': apiKey,
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
  }

  if (response.redirected) {
    console.log(`   → Redirected to: ${response.url}`);
  }

  // Stream to temp file
  const fileStream = fs.createWriteStream(tempPath);
  
  if (!response.body) {
    throw new Error('Response body is null');
  }

  // Convert ReadableStream to Node.js stream
  const reader = response.body.getReader();
  let downloadedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      fileStream.write(value);
      downloadedBytes += value.length;
      
      // Log progress every 10MB
      if (fileSize && downloadedBytes % (10 * 1024 * 1024) < value.length) {
        const progress = ((downloadedBytes / fileSize) * 100).toFixed(1);
        console.log(`   Progress: ${progress}%`);
      }
    }

    fileStream.end();

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    // Rename temp file to final destination
    fs.renameSync(tempPath, destPath);

    const finalSizeMB = (downloadedBytes / 1024 / 1024).toFixed(2);
    console.log(`   ✓ Download complete: ${finalSizeMB} MB`);
    console.log(`   Saved to: ${destPath}\n`);

  } catch (error) {
    // Clean up temp file on error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}

/**
 * Clean up old ZIP files to save disk space
 * Keeps only the N most recent files
 */
function cleanupOldFiles(keepCount: number = 3): void {
  console.log(`\n🧹 Cleaning up old files (keeping ${keepCount} most recent)...`);

  if (!fs.existsSync(DOWNLOADS_DIR)) {
    return;
  }

  // Get all ZIP files
  const files = fs.readdirSync(DOWNLOADS_DIR)
    .filter(f => f.endsWith('.zip'))
    .map(f => ({
      name: f,
      path: path.join(DOWNLOADS_DIR, f),
      mtime: fs.statSync(path.join(DOWNLOADS_DIR, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first

  if (files.length <= keepCount) {
    console.log(`   ✓ Only ${files.length} file(s) found, no cleanup needed\n`);
    return;
  }

  // Delete old files
  const filesToDelete = files.slice(keepCount);
  let deletedSize = 0;

  for (const file of filesToDelete) {
    const stats = fs.statSync(file.path);
    deletedSize += stats.size;
    fs.unlinkSync(file.path);
    console.log(`   🗑️  Deleted: ${file.name} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  }

  console.log(`   ✓ Freed up ${(deletedSize / 1024 / 1024).toFixed(2)} MB of disk space\n`);
}

/**
 * Run the importer script
 */
async function runImporter(zipPath: string): Promise<void> {
  console.log(`📊 Running importer...`);
  console.log(`   ZIP: ${zipPath}\n`);

  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['tsx', 'scripts/uspto/import_daily_applications.ts', `--zip=${zipPath}`],
      {
        stdio: 'inherit',
        shell: true,
      }
    );

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Importer exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 USPTO TRTDXFAP Auto-Downloader\n');
  console.log('═'.repeat(60));

  const { dryRun, noImport, keepFiles, noCleanup } = parseArgs();

  if (dryRun) {
    console.log('Mode: DRY RUN (no download will occur)\n');
  }

  // Check for concurrent runs
  if (isLocked()) {
    console.error('❌ Another download is already in progress (lock file exists)');
    console.error(`   Lock file: ${LOCK_FILE}`);
    console.error('   If this is a stale lock, delete it manually and try again.');
    process.exit(1);
  }

  // Create lock file
  if (!dryRun) {
    createLock();
  }

  try {
    // Step 1: Fetch available files
    const files = await fetchAvailableFiles();

    // Step 2: Select the latest file
    const latestFile = selectLatestFile(files);

    if (!latestFile) {
      console.error('❌ No suitable file found');
      process.exit(1);
    }

    console.log('📄 Latest file selected:');
    console.log('─'.repeat(60));
    console.log(`   File name:     ${latestFile.fileName}`);
    
    if (latestFile.fileReleaseDate) {
      const releaseDate = new Date(latestFile.fileReleaseDate);
      console.log(`   Release date:  ${releaseDate.toISOString().split('T')[0]}`);
    } else {
      const numericDate = extractNumericDate(latestFile.fileName);
      if (numericDate) {
        console.log(`   Numeric date:  ${numericDate} (from filename)`);
      }
    }
    
    if (latestFile.fileSize) {
      console.log(`   Size:          ${(latestFile.fileSize / 1024 / 1024).toFixed(2)} MB`);
    }
    
    if (latestFile.fileDescription) {
      console.log(`   Description:   ${latestFile.fileDescription}`);
    }
    
    console.log('─'.repeat(60));
    console.log();

    // Dry run mode: exit here
    if (dryRun) {
      console.log('✓ Dry run complete. No files were downloaded.\n');
      return;
    }

    // Step 3: Check if file already exists
    const destPath = path.join(DOWNLOADS_DIR, latestFile.fileName);
    
    if (fs.existsSync(destPath)) {
      console.log(`✓ File already exists: ${destPath}`);
      console.log('   Skipping download.\n');
      
      // If import is requested and file exists, run importer
      if (!noImport) {
        await runImporter(destPath);
        
        // Clean up old files after successful import
        if (!noCleanup) {
          cleanupOldFiles(keepFiles);
        }
      }
      
      return;
    }

    // Step 4: Download the file
    if (!latestFile.fileDownloadURI) {
      throw new Error('No download URI available for the selected file');
    }

    await downloadFile(
      latestFile.fileDownloadURI,
      latestFile.fileName,
      latestFile.fileSize
    );

    // Step 5: Run importer (unless --no-import flag is set)
    if (!noImport) {
      await runImporter(destPath);
      
      // Step 6: Clean up old files after successful import
      if (!noCleanup) {
        cleanupOldFiles(keepFiles);
      }
    } else {
      console.log('⏭️  Skipping import (--no-import flag set)\n');
    }

    console.log('✅ Done!\n');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    // Always remove lock file
    if (!dryRun) {
      removeLock();
    }
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted by user');
  removeLock();
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Terminated');
  removeLock();
  process.exit(143);
});

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  removeLock();
  process.exit(1);
});
