import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import {
  BatchAccumulator,
  completeImportRun,
  createImportRun,
  getTrademarkCount,
} from '@/scripts/uspto/db_operations';
import { parseTrademarkXML } from '@/scripts/uspto/xml_parser';

const USPTO_DATASET_URL =
  'https://api.uspto.gov/api/v1/datasets/products/TRTDXFAP';

interface FileDataBagItem {
  fileName: string;
  fileReleaseDate?: string;
  fileSize?: number;
  fileDownloadURI?: string;
}

interface USPTOApiResponse {
  bulkDataProductBag?: Array<{
    productFileBag?: {
      fileDataBag?: FileDataBagItem[];
    };
  }>;
}

export interface DailyImportSummary {
  importRunId: number;
  fileName: string;
  recordsInserted: number;
  recordsEmitted: number;
  pendingRecords: number;
  beforeCount: number;
  afterCount: number;
  fileSizeMB: string;
}

function extractNumericDate(fileName: string): string | null {
  const match = fileName.match(/apc(\d{6})\.zip/i);
  return match ? match[1] : null;
}

function selectLatestFile(files: FileDataBagItem[]): FileDataBagItem | null {
  if (!files.length) return null;

  const byReleaseDate = files.filter((file) => file.fileReleaseDate);
  if (byReleaseDate.length > 0) {
    return byReleaseDate.sort((a, b) => {
      const aMs = new Date(a.fileReleaseDate!).getTime();
      const bMs = new Date(b.fileReleaseDate!).getTime();
      return bMs - aMs;
    })[0];
  }

  const byFilenameDate = files
    .map((file) => ({ file, date: extractNumericDate(file.fileName) }))
    .filter((item) => item.date !== null)
    .sort((a, b) => b.date!.localeCompare(a.date!));

  return byFilenameDate.length > 0 ? byFilenameDate[0].file : files[0];
}

async function fetchLatestFileMeta(apiKey: string): Promise<FileDataBagItem> {
  const response = await fetch(USPTO_DATASET_URL, {
    headers: {
      'X-API-KEY': apiKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `USPTO list request failed: HTTP ${response.status} ${response.statusText}`
    );
  }

  const payload = (await response.json()) as USPTOApiResponse;
  const files =
    payload.bulkDataProductBag?.[0]?.productFileBag?.fileDataBag ?? [];
  const latest = selectLatestFile(files);

  if (!latest) {
    throw new Error('No TRTDXFAP files found in USPTO response');
  }

  if (!latest.fileDownloadURI) {
    throw new Error(`Latest file ${latest.fileName} has no download URI`);
  }

  return latest;
}

async function downloadZip(
  downloadUri: string,
  destinationPath: string,
  apiKey: string
): Promise<void> {
  const response = await fetch(downloadUri, {
    headers: {
      'X-API-KEY': apiKey,
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(
      `USPTO download failed: HTTP ${response.status} ${response.statusText}`
    );
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destinationPath, new Uint8Array(buffer));
}

function extractXmlFiles(zipPath: string, outputDir: string): string[] {
  const zip = new AdmZip(zipPath);
  const entries = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory && entry.entryName.endsWith('.xml'));

  if (entries.length === 0) {
    throw new Error('No XML files found in USPTO ZIP');
  }

  const extracted: string[] = [];
  for (const entry of entries) {
    zip.extractEntryTo(entry, outputDir, false, true);
    extracted.push(path.join(outputDir, entry.entryName));
  }

  return extracted;
}

export async function runUSPTODailyImport(): Promise<DailyImportSummary> {
  const apiKey = process.env.USPTO_API_KEY;
  if (!apiKey) {
    throw new Error('USPTO_API_KEY is not set');
  }

  const latestFile = await fetchLatestFileMeta(apiKey);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uspto-cron-'));
  const zipPath = path.join(tempDir, latestFile.fileName);

  const sourceVersion = `uspto-vercel-cron:${latestFile.fileName}`;
  const importRunId = await createImportRun('USPTO', sourceVersion);
  const beforeCount = await getTrademarkCount();

  try {
    await downloadZip(latestFile.fileDownloadURI!, zipPath, apiKey);
    const xmlFiles = extractXmlFiles(zipPath, tempDir);

    const accumulator = new BatchAccumulator(
      importRunId,
      1000,
      'USPTO',
      sourceVersion
    );

    for (const xmlFile of xmlFiles) {
      const stream = fs.createReadStream(xmlFile);
      await parseTrademarkXML(stream, async (record) => {
        await accumulator.add(record);
      });
      await accumulator.waitForIdle();
    }

    await accumulator.flush();
    await accumulator.waitForIdle();

    await completeImportRun(importRunId, 'COMPLETED');
    const afterCount = await getTrademarkCount();
    const stats = accumulator.getStats();
    const fileBytes = fs.existsSync(zipPath) ? fs.statSync(zipPath).size : 0;

    return {
      importRunId,
      fileName: latestFile.fileName,
      recordsInserted: stats.inserted,
      recordsEmitted: stats.emitted,
      pendingRecords: stats.pending,
      beforeCount,
      afterCount,
      fileSizeMB: (fileBytes / 1024 / 1024).toFixed(2),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await completeImportRun(importRunId, 'FAILED', message);
    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
