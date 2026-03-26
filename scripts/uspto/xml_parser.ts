/**
 * USPTO XML Parser - Streaming trademark data extraction
 * 
 * This module provides streaming XML parsing for USPTO trademark data files.
 * Uses SAX parser to avoid loading entire XML files into memory.
 * 
 * Optimized for USPTO Daily Applications XML format (apc*.xml files)
 */

import * as sax from 'sax';

/**
 * Parsed trademark record
 */
export interface TrademarkRecord {
  serialNumber: string;
  registrationNumber?: string;
  markText?: string;
  statusRaw?: string;
  statusNorm?: 'ACTIVE' | 'PENDING' | 'DEAD';
  filingDate?: Date;
  registrationDate?: Date;
  statusDate?: Date;
  ownerName?: string;
  goodsServicesText?: string;
  niceClasses: number[];
}

/**
 * Parser state for tracking current position in XML
 */
interface ParserState {
  currentTag: string | null;
  currentTrademark: Partial<TrademarkRecord> | null;
  currentText: string;
  insideCaseFile: boolean;
  hasSeenPartyName: boolean;
}

/**
 * Debug statistics
 */
interface ParseStats {
  caseFilesStarted: number;
  recordsEmitted: number;
  skippedMissingSerial: number;
  skippedMissingMark: number;
  activeCount: number;
  pendingCount: number;
  deadCount: number;
}

/**
 * Normalize tag name (lowercase + strip namespace prefixes)
 */
function normalizeTagName(tagName: string): string {
  // Remove namespace prefix (e.g., "ns:tag-name" -> "tag-name")
  const withoutNamespace = tagName.includes(':') 
    ? tagName.split(':')[1] 
    : tagName;
  return withoutNamespace.toLowerCase();
}

/**
 * Parse date from YYYYMMDD format to Date object
 */
function parseDateYYYYMMDD(dateStr: string): Date | undefined {
  if (!dateStr || dateStr.length !== 8) return undefined;
  
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  
  // Validate date components
  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(day, 10);
  
  if (yearNum < 1900 || yearNum > 2100) return undefined;
  if (monthNum < 1 || monthNum > 12) return undefined;
  if (dayNum < 1 || dayNum > 31) return undefined;
  
  return new Date(`${year}-${month}-${day}`);
}

/**
 * Check if registration number is valid (not "0000000")
 */
function isValidRegistrationNumber(regNum: string | undefined): string | undefined {
  if (!regNum) return undefined;
  if (regNum === '0000000' || regNum === '00000000') return undefined;
  if (/^0+$/.test(regNum)) return undefined; // All zeros
  return regNum;
}

/**
 * Normalize trademark status based on registration number and live/dead indicator
 * 
 * Logic:
 * 1. If registration_number exists and is valid → ACTIVE
 * 2. Else if status indicates DEAD → DEAD
 * 3. Else → PENDING
 */
function normalizeTrademarkStatus(
  registrationNumber: string | undefined,
  statusRaw: string | undefined
): 'ACTIVE' | 'PENDING' | 'DEAD' {
  // Check if registration number exists and is valid
  const validRegNum = isValidRegistrationNumber(registrationNumber);
  if (validRegNum) {
    return 'ACTIVE';
  }

  // Check if status indicates DEAD
  if (statusRaw) {
    const normalized = statusRaw.trim().toUpperCase();
    
    // Check for DEAD indicators
    if (
      normalized === 'DEAD' ||
      normalized.includes('ABANDON') ||
      normalized.includes('CANCEL') ||
      normalized.includes('EXPIRED')
    ) {
      return 'DEAD';
    }
  }

  // Default to PENDING
  return 'PENDING';
}

/**
 * Stream parse USPTO trademark XML file with proper async handling
 * 
 * @param xmlStream - Readable stream of XML data
 * @param onRecord - Async callback for each parsed trademark record
 * @returns Promise that resolves when parsing is complete
 */
export async function parseTrademarkXML(
  xmlStream: NodeJS.ReadableStream,
  onRecord: (record: TrademarkRecord) => Promise<void>
): Promise<{ totalRecords: number; errors: number }> {
  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, {
      trim: true,
      normalize: true,
      lowercase: false,
      xmlns: false,
    });

    const state: ParserState = {
      currentTag: null,
      currentTrademark: null,
      currentText: '',
      insideCaseFile: false,
      hasSeenPartyName: false,
    };

    const stats: ParseStats = {
      caseFilesStarted: 0,
      recordsEmitted: 0,
      skippedMissingSerial: 0,
      skippedMissingMark: 0,
      activeCount: 0,
      pendingCount: 0,
      deadCount: 0,
    };

    let errors = 0;
    
    // Queue for async record processing with backpressure
    const pendingOperations: Promise<void>[] = [];
    const MAX_PENDING = 10; // Limit concurrent operations

    // Handle opening tags
    parser.on('opentag', (node) => {
      const normalizedTag = normalizeTagName(node.name);
      state.currentTag = normalizedTag;
      state.currentText = '';

      // Start of new case-file record
      if (normalizedTag === 'case-file') {
        stats.caseFilesStarted++;
        state.insideCaseFile = true;
        state.hasSeenPartyName = false;
        state.currentTrademark = {
          niceClasses: [],
        };
      }
    });

    // Handle text content
    parser.on('text', (text) => {
      if (state.insideCaseFile && state.currentTag) {
        state.currentText += text;
      }
    });

    // Handle CDATA
    parser.on('cdata', (cdata) => {
      if (state.insideCaseFile && state.currentTag) {
        state.currentText += cdata;
      }
    });

    // Handle closing tags with backpressure queue
    parser.on('closetag', (tagName) => {
      const normalizedTag = normalizeTagName(tagName);
      
      // End of case-file record
      if (normalizedTag === 'case-file') {
        state.insideCaseFile = false;
        
        if (state.currentTrademark) {
          // Validate required fields
          if (!state.currentTrademark.serialNumber) {
            stats.skippedMissingSerial++;
          } else if (!state.currentTrademark.markText) {
            stats.skippedMissingMark++;
          } else {
            // Normalize status using proper logic
            const statusNorm = normalizeTrademarkStatus(
              state.currentTrademark.registrationNumber,
              state.currentTrademark.statusRaw
            );

            // Count by status
            if (statusNorm === 'ACTIVE') {
              stats.activeCount++;
            } else if (statusNorm === 'PENDING') {
              stats.pendingCount++;
            } else if (statusNorm === 'DEAD') {
              stats.deadCount++;
            }

            // Emit valid record
            const record: TrademarkRecord = {
              serialNumber: state.currentTrademark.serialNumber,
              registrationNumber: isValidRegistrationNumber(state.currentTrademark.registrationNumber),
              markText: state.currentTrademark.markText,
              statusRaw: state.currentTrademark.statusRaw,
              statusNorm: statusNorm,
              filingDate: state.currentTrademark.filingDate,
              registrationDate: state.currentTrademark.registrationDate,
              statusDate: state.currentTrademark.statusDate,
              ownerName: state.currentTrademark.ownerName,
              goodsServicesText: state.currentTrademark.goodsServicesText?.substring(0, 5000),
              niceClasses: state.currentTrademark.niceClasses || [],
            };
            
            stats.recordsEmitted++;
            
            // Add async operation to queue
            const operation = (async () => {
              try {
                await onRecord(record);
              } catch (error) {
                errors++;
                console.error('Error processing record:', error);
              }
            })();
            
            pendingOperations.push(operation);
            
            // Backpressure: if too many pending, pause the stream and wait
            if (pendingOperations.length >= MAX_PENDING) {
              xmlStream.pause();
              
              Promise.all(pendingOperations.splice(0, pendingOperations.length))
                .then(() => {
                  xmlStream.resume();
                })
                .catch((error) => {
                  console.error('Error in pending operations:', error);
                  xmlStream.resume();
                });
            }
          }
        }
        
        state.currentTrademark = null;
        state.currentTag = null;
        state.currentText = '';
        return;
      }

      // Process field data
      if (state.insideCaseFile && state.currentTrademark && state.currentTag === normalizedTag) {
        const text = state.currentText.trim();
        
        if (text) {
          switch (normalizedTag) {
            case 'serial-number':
              state.currentTrademark.serialNumber = text;
              break;
              
            case 'registration-number':
              state.currentTrademark.registrationNumber = text;
              break;
              
            case 'mark-identification':
              state.currentTrademark.markText = text;
              break;
              
            case 'party-name':
              // Capture first party-name as owner
              if (!state.hasSeenPartyName) {
                state.currentTrademark.ownerName = text;
                state.hasSeenPartyName = true;
              }
              break;
              
            case 'filing-date':
              state.currentTrademark.filingDate = parseDateYYYYMMDD(text);
              break;
              
            case 'registration-date':
              state.currentTrademark.registrationDate = parseDateYYYYMMDD(text);
              break;
              
            case 'status-date':
              state.currentTrademark.statusDate = parseDateYYYYMMDD(text);
              break;
              
            case 'status-code':
            case 'mark-status':
              state.currentTrademark.statusRaw = text;
              // Don't normalize here - we'll do it at record emit time with registration number
              break;
              
            case 'international-class':
            case 'class-number':
              const classNum = parseInt(text, 10);
              if (classNum >= 1 && classNum <= 45) {
                if (!state.currentTrademark.niceClasses!.includes(classNum)) {
                  state.currentTrademark.niceClasses!.push(classNum);
                }
              }
              break;
              
            case 'goods-services':
            case 'gs-text':
              const existing = state.currentTrademark.goodsServicesText || '';
              state.currentTrademark.goodsServicesText = existing 
                ? `${existing} ${text}` 
                : text;
              break;
          }
        }
        
        state.currentTag = null;
        state.currentText = '';
      }
    });

    // Handle errors
    parser.on('error', (error) => {
      console.error('XML parsing error:', error);
      reject(error);
    });

    // Handle completion
    parser.on('end', async () => {
      // Wait for all pending operations to complete
      if (pendingOperations.length > 0) {
        try {
          await Promise.all(pendingOperations);
        } catch (error) {
          console.error('Error waiting for pending operations:', error);
        }
      }

      // Print debug statistics
      console.log('\n   📊 Parse Statistics:');
      console.log(`      Case files started:      ${stats.caseFilesStarted.toLocaleString()}`);
      console.log(`      Records emitted:         ${stats.recordsEmitted.toLocaleString()}`);
      console.log(`      Skipped (no serial):     ${stats.skippedMissingSerial.toLocaleString()}`);
      console.log(`      Skipped (no mark text):  ${stats.skippedMissingMark.toLocaleString()}`);
      console.log(`      Parsing errors:          ${errors.toLocaleString()}`);
      console.log('\n   📈 Status Breakdown:');
      console.log(`      ACTIVE:                  ${stats.activeCount.toLocaleString()} (${((stats.activeCount / stats.recordsEmitted) * 100).toFixed(1)}%)`);
      console.log(`      PENDING:                 ${stats.pendingCount.toLocaleString()} (${((stats.pendingCount / stats.recordsEmitted) * 100).toFixed(1)}%)`);
      console.log(`      DEAD:                    ${stats.deadCount.toLocaleString()} (${((stats.deadCount / stats.recordsEmitted) * 100).toFixed(1)}%)`);
      
      resolve({ totalRecords: stats.recordsEmitted, errors });
    });

    // Pipe the stream to the parser
    xmlStream.pipe(parser);
  });
}

/**
 * Helper to parse a file stream
 */
export async function parseTrademarkFile(
  filePath: string,
  onRecord: (record: TrademarkRecord) => Promise<void>
): Promise<{ totalRecords: number; errors: number }> {
  const fs = await import('fs');
  const stream = fs.createReadStream(filePath);
  return parseTrademarkXML(stream, onRecord);
}
