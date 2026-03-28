#!/usr/bin/env node
/**
 * Backfill owner_country from USPTO ZIP XML files.
 *
 * Usage:
 *   pnpm exec tsx scripts/uspto/backfill_owner_country.ts --zip=./downloads/apc260224.zip
 *   pnpm exec tsx scripts/uspto/backfill_owner_country.ts --zip=./downloads/apc260224.zip,./downloads/apc260203.zip
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import AdmZip from "adm-zip";
import { getPool } from "../../lib/db/postgres";
import { parseTrademarkXML } from "./xml_parser";

type Args = {
  zipPaths: string[];
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const zipArg = args.find((arg) => arg.startsWith("--zip="));

  if (!zipArg) {
    console.error("Missing required argument: --zip=/path/to/file.zip[,/path/to/other.zip]");
    process.exit(1);
  }

  const zipPaths = zipArg
    .substring("--zip=".length)
    .split(",")
    .map((p) => path.resolve(process.cwd(), p.trim()))
    .filter(Boolean);

  if (zipPaths.length === 0) {
    console.error("No ZIP files provided.");
    process.exit(1);
  }

  for (const zipPath of zipPaths) {
    if (!fs.existsSync(zipPath)) {
      console.error(`ZIP file not found: ${zipPath}`);
      process.exit(1);
    }
    if (!zipPath.toLowerCase().endsWith(".zip")) {
      console.error(`Not a ZIP file: ${zipPath}`);
      process.exit(1);
    }
  }

  return { zipPaths };
}

async function extractZip(zipPath: string, extractDir: string): Promise<string[]> {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const xmlFiles: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith(".xml")) {
      const extractPath = path.join(extractDir, entry.entryName);
      zip.extractEntryTo(entry, extractDir, false, true);
      xmlFiles.push(extractPath);
    }
  }

  return xmlFiles;
}

async function backfillBatch(serials: string[], countries: string[]): Promise<number> {
  if (serials.length === 0) return 0;

  const pool = getPool();
  const result = await pool.query(
    `
      UPDATE public.trademarks t
      SET owner_country = v.owner_country
      FROM (
        SELECT
          UNNEST($1::text[]) AS serial_number,
          UNNEST($2::text[]) AS owner_country
      ) AS v
      WHERE
        t.office = 'USPTO'
        AND t.serial_number = v.serial_number
        AND (t.owner_country IS NULL OR t.owner_country = '')
    `,
    [serials, countries]
  );

  return result.rowCount || 0;
}

async function processZip(zipPath: string): Promise<{ extracted: number; updated: number }> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uspto-country-backfill-"));
  let updated = 0;

  try {
    console.log(`\n📦 Processing: ${zipPath}`);
    const xmlFiles = await extractZip(zipPath, tempDir);
    if (xmlFiles.length === 0) {
      console.log("   No XML files found in ZIP.");
      return { extracted: 0, updated: 0 };
    }

    for (const xmlFile of xmlFiles) {
      console.log(`   Parsing XML: ${path.basename(xmlFile)}`);
      const countryBySerial = new Map<string, string>();
      const stream = fs.createReadStream(xmlFile);

      await parseTrademarkXML(stream, async (record) => {
        const serial = record.serialNumber?.trim();
        const country = record.ownerCountry?.trim();
        if (!serial || !country) return;

        // Keep first country for a serial in this file.
        if (!countryBySerial.has(serial)) {
          countryBySerial.set(serial, country);
        }
      });

      const entries = Array.from(countryBySerial.entries());
      const chunkSize = 5000;
      console.log(`   Found ${entries.length.toLocaleString()} serial->country mappings`);

      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const serials = chunk.map(([serial]) => serial);
        const countries = chunk.map(([, country]) => country);
        updated += await backfillBatch(serials, countries);
      }
    }

    return { extracted: xmlFiles.length, updated };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore temp cleanup failures.
    }
  }
}

async function main() {
  const { zipPaths } = parseArgs();
  console.log("🚀 USPTO owner_country backfill");
  let totalUpdated = 0;
  let totalExtracted = 0;

  for (const zipPath of zipPaths) {
    const result = await processZip(zipPath);
    totalExtracted += result.extracted;
    totalUpdated += result.updated;
  }

  const pool = getPool();
  const coverage = await pool.query<{
    total: string;
    with_country: string;
  }>(
    `
      SELECT
        COUNT(*)::text AS total,
        COUNT(owner_country)::text AS with_country
      FROM public.trademarks
    `
  );

  console.log("\n✅ Backfill complete");
  console.log(`XML files processed: ${totalExtracted}`);
  console.log(`Rows updated: ${totalUpdated.toLocaleString()}`);
  console.log(`Coverage now: ${coverage.rows[0].with_country} / ${coverage.rows[0].total}`);
}

main().catch((error) => {
  console.error("\n❌ Backfill failed:", error);
  process.exit(1);
});
