// Load environment variables for standalone script execution
// This is safe to include - Next.js will ignore it in API routes
import { config } from 'dotenv';
import { resolve } from 'path';

// Load from .env.local (Next.js convention) if running as standalone script
if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
  config({ path: resolve(process.cwd(), '.env.local') });
}

import { Pool, QueryResult, QueryResultRow } from 'pg';

/**
 * PostgreSQL connection pool for direct database access
 * Used for USPTO trademark search queries that require pg_trgm and custom SQL
 */

let pool: Pool | null = null;

function isTransientConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('connection terminated due to connection timeout') ||
    message.includes('connection terminated unexpectedly') ||
    message.includes('ecconnreset') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout')
  );
}

/**
 * Get or create a PostgreSQL connection pool
 * Uses DATABASE_URL from environment variables
 */
export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL environment variable is not set. ' +
        'Please add it to your .env.local file.'
      );
    }

    pool = new Pool({
      connectionString: databaseUrl,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Allow extra time for Supabase pooler under load
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  return pool;
}

/**
 * Execute a SQL query with parameters
 * Provides automatic connection management and error handling
 * 
 * @param text - SQL query string
 * @param params - Query parameters (uses $1, $2, etc. placeholders)
 * @returns Query result
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const executeQuery = async (): Promise<QueryResult<T>> => {
    const start = Date.now();
  
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (> 1000ms) in development
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      console.warn('Slow query detected:', {
        duration: `${duration}ms`,
        query: text.substring(0, 100),
        rowCount: result.rowCount,
      });
    }
    return result;
  };

  try {
    return await executeQuery();
  } catch (error) {
    // Retry once for transient network/pooler failures
    if (isTransientConnectionError(error)) {
      console.warn('Transient database error, retrying once:', {
        query: text.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return await executeQuery();
    }

    console.error('Database query error:', {
      query: text.substring(0, 100),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Execute a query and return only the rows
 * Convenient wrapper for common use case
 */
export async function queryRows<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/**
 * Execute a query and return a single row
 * Returns null if no rows found
 */
export async function queryOne<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Close the connection pool
 * Should be called when the application is shutting down
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Test database connection
 * Useful for health checks
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as current_time');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Check if required extensions are installed
 */
export async function checkExtensions(): Promise<{
  pg_trgm: boolean;
}> {
  try {
    const result = await query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'"
    );
    
    return {
      pg_trgm: result.rows.length > 0,
    };
  } catch (error) {
    console.error('Failed to check extensions:', error);
    return {
      pg_trgm: false,
    };
  }
}
