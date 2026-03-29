/**
 * Database operations for USPTO trademark imports
 * 
 * Handles batch upserts, transaction management, and import run tracking.
 */

import { Pool, PoolClient } from 'pg';
import { getPool } from '../../lib/db/postgres';
import { TrademarkRecord } from './xml_parser';

/**
 * Import run status
 */
export type ImportRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

/**
 * Import run record
 */
export interface ImportRun {
  id: number;
  office: string;
  sourceVersion: string;
  status: ImportRunStatus;
  processedRows: number;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Create a new import run
 */
export async function createImportRun(
  office: string,
  sourceVersion: string
): Promise<number> {
  const pool = getPool();
  
  const result = await pool.query<{ id: number }>(
    `INSERT INTO public.import_runs 
     (office, source_version, status, processed_rows, started_at, created_at)
     VALUES ($1, $2, 'RUNNING', 0, NOW(), NOW())
     RETURNING id`,
    [office, sourceVersion]
  );

  return result.rows[0].id;
}

/**
 * Update import run progress
 */
export async function updateImportRunProgress(
  importRunId: number,
  processedRows: number
): Promise<void> {
  const pool = getPool();
  
  await pool.query(
    `UPDATE public.import_runs 
     SET processed_rows = $2
     WHERE id = $1`,
    [importRunId, processedRows]
  );
}

/**
 * Complete import run
 */
export async function completeImportRun(
  importRunId: number,
  status: 'COMPLETED' | 'FAILED',
  errorMessage?: string
): Promise<void> {
  const pool = getPool();
  
  await pool.query(
    `UPDATE public.import_runs 
     SET status = $2, error_message = $3, completed_at = NOW()
     WHERE id = $1`,
    [importRunId, status, errorMessage]
  );
}

/** Max rows per DB transaction — avoids long transactions that poolers (e.g. Supabase) terminate. */
const UPSERT_CHUNK_SIZE = 75;

async function upsertSingleRecord(
  client: PoolClient,
  record: TrademarkRecord,
  office: string,
  sourceVersion?: string
): Promise<void> {
  const trademarkResult = await client.query<{ id: number }>(
    `INSERT INTO public.trademarks (
          office,
          serial_number,
          registration_number,
          mark_text,
          status_raw,
          status_norm,
          filing_date,
          registration_date,
          owner_name,
          owner_country,
          goods_services_text,
          source_version,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (office, serial_number) 
        DO UPDATE SET
          registration_number = EXCLUDED.registration_number,
          mark_text = EXCLUDED.mark_text,
          status_raw = EXCLUDED.status_raw,
          status_norm = EXCLUDED.status_norm,
          filing_date = EXCLUDED.filing_date,
          registration_date = EXCLUDED.registration_date,
          owner_name = EXCLUDED.owner_name,
          owner_country = EXCLUDED.owner_country,
          goods_services_text = EXCLUDED.goods_services_text,
          source_version = EXCLUDED.source_version
        RETURNING id`,
    [
      office,
      record.serialNumber,
      record.registrationNumber || null,
      record.markText || null,
      record.statusRaw || null,
      record.statusNorm || null,
      record.filingDate || null,
      record.registrationDate || null,
      record.ownerName || null,
      record.ownerCountry || null,
      record.goodsServicesText || null,
      sourceVersion || null,
    ]
  );

  const trademarkId = trademarkResult.rows[0].id;

  if (record.niceClasses.length > 0) {
    await client.query('DELETE FROM public.trademark_classes WHERE trademark_id = $1', [
      trademarkId,
    ]);

    const classValues = record.niceClasses.map((cls, idx) => `($1, $${idx + 2})`).join(', ');

    if (classValues) {
      await client.query(
        `INSERT INTO public.trademark_classes (trademark_id, nice_class) 
             VALUES ${classValues}
             ON CONFLICT (trademark_id, nice_class) DO NOTHING`,
        [trademarkId, ...record.niceClasses]
      );
    }
  }
}

/**
 * Batch upsert trademarks with their classes.
 * Commits in small chunks so remote poolers do not kill long-running transactions.
 */
export async function batchUpsertTrademarks(
  records: TrademarkRecord[],
  office: string = 'USPTO',
  sourceVersion?: string
): Promise<number> {
  if (records.length === 0) return 0;

  const pool = getPool();
  const client = await pool.connect();

  let upsertedCount = 0;

  try {
    for (let offset = 0; offset < records.length; offset += UPSERT_CHUNK_SIZE) {
      const slice = records.slice(offset, offset + UPSERT_CHUNK_SIZE);
      await client.query('BEGIN');
      try {
        for (const record of slice) {
          await upsertSingleRecord(client, record, office, sourceVersion);
          upsertedCount++;
        }
        await client.query('COMMIT');
      } catch (chunkError) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Connection may already be dead; release below.
        }
        throw chunkError;
      }
    }

    return upsertedCount;
  } catch (error) {
    console.error('Batch upsert failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Batch accumulator for efficient database writes
 * Ensures only one flush operation runs at a time to prevent connection timeouts
 */
export class BatchAccumulator {
  private batch: TrademarkRecord[] = [];
  private totalProcessed = 0;
  // 🔧 FIX 4: Initialize counters to 0 to prevent NaN
  private totalEmitted = 0;
  private totalInserted = 0;
  private importRunId: number;
  private office: string;
  private sourceVersion: string;
  private flushPromise: Promise<number> | null = null;

  constructor(
    importRunId: number,
    private batchSize: number = 1000,
    office: string = 'USPTO',
    sourceVersion: string = 'daily'
  ) {
    this.importRunId = importRunId;
    this.office = office;
    this.sourceVersion = sourceVersion;
  }

  /**
   * Add a record to the batch
   * Automatically flushes when batch size is reached
   */
  async add(record: TrademarkRecord): Promise<void> {
    this.totalEmitted++;
    this.batch.push(record);

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush current batch to database
   * Ensures only one flush operation runs at a time
   */
  async flush(): Promise<number> {
    // If a flush is already in progress, wait for it to complete
    if (this.flushPromise) {
      return await this.flushPromise;
    }

    // No records to flush
    if (this.batch.length === 0) return 0;

    // Start new flush operation
    this.flushPromise = (async () => {
      const currentBatch = this.batch;
      this.batch = []; // Clear batch immediately to accept new records

      try {
        const upserted = await batchUpsertTrademarks(
          currentBatch,
          this.office,
          this.sourceVersion
        );

        this.totalProcessed += upserted;
        this.totalInserted += upserted;
        
        // Update import run progress
        await updateImportRunProgress(this.importRunId, this.totalProcessed);

        console.log(`   ✓ Upserted batch of ${upserted} records (total: ${this.totalProcessed})`);

        return upserted;
      } catch (error) {
        // Restore batch on error
        this.batch = [...currentBatch, ...this.batch];
        console.error('Failed to flush batch:', error);
        throw error;
      }
    })();

    try {
      const result = await this.flushPromise;
      return result;
    } finally {
      // Clear flush promise when done
      this.flushPromise = null;
    }
  }

  /**
   * Wait for any pending flush operations to complete
   */
  async waitForIdle(): Promise<void> {
    if (this.flushPromise) {
      await this.flushPromise;
    }
  }

  /**
   * Get total number of records processed
   */
  getTotalProcessed(): number {
    return this.totalProcessed;
  }

  /**
   * Get total number of records emitted by parser
   */
  getTotalEmitted(): number {
    return this.totalEmitted;
  }

  /**
   * Get total number of records inserted into database
   */
  getTotalInserted(): number {
    return this.totalInserted;
  }

  /**
   * Get current batch size
   */
  getCurrentBatchSize(): number {
    return this.batch.length;
  }

  /**
   * Get debug statistics
   */
  getStats(): { emitted: number; inserted: number; pending: number } {
    return {
      emitted: this.totalEmitted,
      inserted: this.totalInserted,
      pending: this.batch.length,
    };
  }
}

/**
 * Get sample trademarks from database (for verification)
 */
export async function getSampleTrademarks(limit: number = 3): Promise<any[]> {
  const pool = getPool();
  
  const result = await pool.query(
    `SELECT serial_number, mark_text, status_norm, owner_name, filing_date
     FROM public.trademarks
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

/**
 * Get trademark count
 */
export async function getTrademarkCount(): Promise<number> {
  const pool = getPool();
  
  const result = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text as count FROM public.trademarks'
  );

  return parseInt(result.rows[0].count, 10);
}

/**
 * Get import run statistics
 */
export async function getImportRunStats(importRunId: number): Promise<ImportRun | null> {
  const pool = getPool();
  
  const result = await pool.query<{
    id: number;
    office: string;
    source_version: string;
    status: ImportRunStatus;
    processed_rows: number;
    error_message: string | null;
    started_at: Date;
    completed_at: Date | null;
  }>(
    `SELECT id, office, source_version, status, processed_rows, 
            error_message, started_at, completed_at
     FROM public.import_runs
     WHERE id = $1`,
    [importRunId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    office: row.office,
    sourceVersion: row.source_version,
    status: row.status,
    processedRows: row.processed_rows,
    errorMessage: row.error_message || undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at || undefined,
  };
}
