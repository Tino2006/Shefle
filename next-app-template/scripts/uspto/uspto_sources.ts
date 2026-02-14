/**
 * USPTO Data Sources Configuration
 * 
 * Uses the USPTO Bulk Datasets API (api.uspto.gov) to fetch trademark data files.
 * The old bulkdata.uspto.gov domain is deprecated.
 */

/**
 * USPTO Bulk Datasets API Configuration
 */
export const USPTO_API = {
  baseUrl: 'https://api.uspto.gov/api/v1/datasets',
  
  // Product IDs for different datasets
  products: {
    dailyApplications: 'TRTDXFAP', // Trademark Daily XML - Applications
  },
  
  // API endpoints
  endpoints: {
    listFiles: (productId: string) => 
      `${USPTO_API.baseUrl}/products/${productId}`,
    downloadFile: (productId: string, fileName: string) =>
      `${USPTO_API.baseUrl}/products/files/${productId}/${fileName}`,
  },
};

/**
 * File metadata from USPTO API
 */
export interface USPTOFile {
  fileName: string;
  releaseDate: string; // ISO date string
  fileSize?: number;
  description?: string;
}

/**
 * Response from listing files
 */
export interface USPTOFilesResponse {
  product: {
    productId: string;
    productName: string;
    description: string;
  };
  files: USPTOFile[];
}

/**
 * Configuration for the importer
 */
export const IMPORTER_CONFIG = {
  // Maximum number of records to batch before writing to DB
  batchSize: 1000,
  
  // Request timeout for downloads (milliseconds)
  downloadTimeout: 300000, // 5 minutes
  
  // Retry configuration for failed downloads
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  
  // Temporary directory for extracted files
  tempDirPrefix: 'uspto-import-',
  
  // User agent for HTTP requests
  userAgent: 'Mozilla/5.0 (compatible; USPTO-Trademark-Importer/1.0)',
  
  // Default product to use
  defaultProductId: USPTO_API.products.dailyApplications,
  
  // XML file pattern for validation
  xmlFilePattern: /^apc\d{6}\.xml$/i,
};

/**
 * Status normalization mapping
 * Maps USPTO status codes/text to our normalized ACTIVE/PENDING/DEAD values
 */
export const STATUS_NORMALIZATION: Record<string, 'ACTIVE' | 'PENDING' | 'DEAD'> = {
  // Active statuses
  'REGISTERED': 'ACTIVE',
  'REGISTERED AND RENEWED': 'ACTIVE',
  'REGISTERED - PRINCIPAL': 'ACTIVE',
  'REGISTERED - SUPPLEMENTAL': 'ACTIVE',
  'LIVE': 'ACTIVE',
  
  // Pending statuses
  'NEW APPLICATION PROCESSING': 'PENDING',
  'AWAITING EXAMINATION': 'PENDING',
  'SUSPENDED': 'PENDING',
  'PUBLISHED FOR OPPOSITION': 'PENDING',
  'NOTICE OF ALLOWANCE ISSUED': 'PENDING',
  'PENDING': 'PENDING',
  
  // Dead statuses
  'ABANDONED': 'DEAD',
  'CANCELLED': 'DEAD',
  'EXPIRED': 'DEAD',
  'DEAD': 'DEAD',
  'ABANDONED - FAILURE TO RESPOND': 'DEAD',
  'ABANDONED - NO STATEMENT OF USE': 'DEAD',
  'CANCELLED - SECTION 8': 'DEAD',
};

/**
 * Normalize a USPTO status string to our standard values
 */
export function normalizeStatus(rawStatus: string | null | undefined): 'ACTIVE' | 'PENDING' | 'DEAD' | null {
  if (!rawStatus) return null;
  
  const normalized = rawStatus.trim().toUpperCase();
  
  // Direct match
  if (STATUS_NORMALIZATION[normalized]) {
    return STATUS_NORMALIZATION[normalized];
  }
  
  // Partial matching for common patterns
  if (normalized.includes('REGISTER') && !normalized.includes('ABANDON') && !normalized.includes('CANCEL')) {
    return 'ACTIVE';
  }
  if (normalized.includes('ABANDON') || normalized.includes('CANCEL') || normalized.includes('EXPIRED')) {
    return 'DEAD';
  }
  if (normalized.includes('PENDING') || normalized.includes('SUSPEND') || normalized.includes('PUBLISH')) {
    return 'PENDING';
  }
  
  // Default to PENDING if unknown
  return 'PENDING';
}

/**
 * List available files from USPTO Bulk Datasets API
 */
export async function listAvailableFiles(
  productId: string = USPTO_API.products.dailyApplications
): Promise<USPTOFile[]> {
  const url = USPTO_API.endpoints.listFiles(productId);
  
  console.log(`📋 Fetching file list from: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': IMPORTER_CONFIG.userAgent,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list files: HTTP ${response.status} ${response.statusText}`);
  }

  // Log response content type
  const contentType = response.headers.get('content-type') || 'unknown';
  console.log(`   Content-Type: ${contentType}`);

  const data: USPTOFilesResponse = await response.json();
  
  console.log(`✓ Found ${data.files.length} available files for ${data.product.productName}`);
  
  return data.files;
}

/**
 * Filter files by date range
 */
export function filterFilesByDateRange(
  files: USPTOFile[],
  fromDate: Date,
  toDate: Date
): USPTOFile[] {
  const filtered = files.filter(file => {
    const releaseDate = new Date(file.releaseDate);
    return releaseDate >= fromDate && releaseDate <= toDate;
  });

  // Sort by release date ascending
  filtered.sort((a, b) => 
    new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
  );

  return filtered;
}

/**
 * Get download URL for a file
 */
export function getDownloadUrl(
  fileName: string,
  productId: string = USPTO_API.products.dailyApplications
): string {
  return USPTO_API.endpoints.downloadFile(productId, fileName);
}

/**
 * Download a file from USPTO Bulk Datasets API
 * Returns the path to the downloaded file
 */
export async function downloadFile(
  fileName: string,
  destPath: string,
  productId: string = USPTO_API.products.dailyApplications
): Promise<{ success: boolean; redirectUrl?: string; contentType?: string }> {
  const url = getDownloadUrl(fileName, productId);
  
  console.log(`  📥 Downloading: ${fileName}`);
  console.log(`     URL: ${url}`);
  
  for (let attempt = 1; attempt <= IMPORTER_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': IMPORTER_CONFIG.userAgent,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(IMPORTER_CONFIG.downloadTimeout),
      });

      // Log content type
      const contentType = response.headers.get('content-type') || 'unknown';
      console.log(`     Content-Type: ${contentType}`);

      // Check if we were redirected
      if (response.redirected) {
        console.log(`     → Redirected to: ${response.url}`);
      }

      // Log final resolved URL after redirects
      console.log(`     📍 Final URL: ${response.url}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`     ⚠️  File not found (404)`);
          return { success: false };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const fs = await import('fs');
      fs.writeFileSync(destPath, new Uint8Array(buffer));
      
      const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2);
      console.log(`     ✓ Downloaded ${sizeMB} MB`);
      
      return { 
        success: true, 
        redirectUrl: response.redirected ? response.url : undefined,
        contentType,
      };

    } catch (error) {
      console.error(`     ✗ Attempt ${attempt}/${IMPORTER_CONFIG.maxRetries} failed:`, 
        error instanceof Error ? error.message : error);
      
      if (attempt < IMPORTER_CONFIG.maxRetries) {
        console.log(`     Retrying in ${IMPORTER_CONFIG.retryDelay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, IMPORTER_CONFIG.retryDelay));
      } else {
        throw error;
      }
    }
  }

  return { success: false };
}

/**
 * Format date as YYYY-MM-DD for API queries
 */
export function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse release date from file metadata
 */
export function parseReleaseDate(file: USPTOFile): Date {
  return new Date(file.releaseDate);
}
