// @ts-nocheck
/**
 * File Processing Utilities
 * Handles text extraction from various file formats
 */

import OpenAI from 'openai';

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionResult {
  success: boolean;
  text?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SpreadsheetData {
  sheets: Array<{
    name: string;
    rows: any[][];
    headers?: string[];
  }>;
  metadata?: Record<string, any>;
}

export interface ImageAnalysisResult {
  success: boolean;
  description?: string;
  extractedText?: string;
  analysis?: string;
  error?: string;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  duration?: number;
  language?: string;
  error?: string;
}

// ============================================================================
// PDF EXTRACTION
// ============================================================================

/**
 * Extract text from a PDF file
 * Uses pdf-parse library for server-side extraction
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<ExtractionResult> {
  try {
    // Dynamic import to avoid bundling issues
    const pdfParse = (await import('pdf-parse')).default;

    const data = await pdfParse(buffer);

    return {
      success: true,
      text: data.text,
      metadata: {
        numPages: data.numpages,
        info: data.info,
        version: data.version,
      },
    };
  } catch (error) {
    console.error('Error extracting text from PDF:', error);

    // If pdf-parse is not installed, provide helpful error
    if ((error as any).code === 'MODULE_NOT_FOUND') {
      return {
        success: false,
        error: 'PDF parsing library not installed. Run: npm install pdf-parse',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract text from PDF',
    };
  }
}

// ============================================================================
// DOCUMENT EXTRACTION (Word, etc.)
// ============================================================================

/**
 * Extract text from a Word document (.docx)
 * Uses mammoth library for extraction
 */
export async function extractTextFromDoc(buffer: Buffer): Promise<ExtractionResult> {
  try {
    // Dynamic import to avoid bundling issues
    const mammoth = await import('mammoth');

    const result = await mammoth.extractRawText({ buffer });

    return {
      success: true,
      text: result.value,
      metadata: {
        messages: result.messages,
      },
    };
  } catch (error) {
    console.error('Error extracting text from document:', error);

    if ((error as any).code === 'MODULE_NOT_FOUND') {
      return {
        success: false,
        error: 'Document parsing library not installed. Run: npm install mammoth',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract text from document',
    };
  }
}

/**
 * Extract HTML from a Word document (.docx)
 * Preserves more formatting than plain text extraction
 */
export async function extractHtmlFromDoc(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const mammoth = await import('mammoth');

    const result = await mammoth.convertToHtml({ buffer });

    return {
      success: true,
      text: result.value,
      metadata: {
        format: 'html',
        messages: result.messages,
      },
    };
  } catch (error) {
    console.error('Error extracting HTML from document:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract HTML from document',
    };
  }
}

// ============================================================================
// SPREADSHEET PARSING
// ============================================================================

/**
 * Parse a spreadsheet file (Excel, CSV)
 * Uses xlsx library for parsing
 */
export async function parseSpreadsheet(
  buffer: Buffer,
  options?: {
    headerRow?: boolean;
    sheetIndex?: number;
    maxRows?: number;
  }
): Promise<{ success: boolean; data?: SpreadsheetData; error?: string }> {
  try {
    // Dynamic import to avoid bundling issues
    const XLSX = await import('xlsx');

    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const sheets = workbook.SheetNames.map((sheetName, index) => {
      // Skip if specific sheet index is requested and this isn't it
      if (options?.sheetIndex !== undefined && index !== options.sheetIndex) {
        return null;
      }

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      }) as any[][];

      // Limit rows if specified
      const rows = options?.maxRows
        ? jsonData.slice(0, options.maxRows)
        : jsonData;

      // Extract headers if first row is header
      const headers = options?.headerRow !== false && rows.length > 0
        ? rows[0].map(String)
        : undefined;

      return {
        name: sheetName,
        rows: options?.headerRow !== false && rows.length > 0 ? rows.slice(1) : rows,
        headers,
      };
    }).filter(Boolean) as SpreadsheetData['sheets'];

    return {
      success: true,
      data: {
        sheets,
        metadata: {
          sheetCount: workbook.SheetNames.length,
          sheetNames: workbook.SheetNames,
        },
      },
    };
  } catch (error) {
    console.error('Error parsing spreadsheet:', error);

    if ((error as any).code === 'MODULE_NOT_FOUND') {
      return {
        success: false,
        error: 'Spreadsheet parsing library not installed. Run: npm install xlsx',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse spreadsheet',
    };
  }
}

/**
 * Convert spreadsheet to text format for AI processing
 */
export async function spreadsheetToText(
  buffer: Buffer,
  options?: { maxRows?: number; format?: 'markdown' | 'csv' | 'plain' }
): Promise<ExtractionResult> {
  const result = await parseSpreadsheet(buffer, { maxRows: options?.maxRows });

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error,
    };
  }

  const format = options?.format || 'markdown';
  let text = '';

  for (const sheet of result.data.sheets) {
    text += `## Sheet: ${sheet.name}\n\n`;

    if (format === 'markdown') {
      // Create markdown table
      if (sheet.headers) {
        text += '| ' + sheet.headers.join(' | ') + ' |\n';
        text += '| ' + sheet.headers.map(() => '---').join(' | ') + ' |\n';
      }

      for (const row of sheet.rows) {
        text += '| ' + row.map(cell => String(cell).replace(/\|/g, '\\|')).join(' | ') + ' |\n';
      }
    } else if (format === 'csv') {
      if (sheet.headers) {
        text += sheet.headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n';
      }
      for (const row of sheet.rows) {
        text += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
      }
    } else {
      // Plain text
      if (sheet.headers) {
        text += sheet.headers.join('\t') + '\n';
      }
      for (const row of sheet.rows) {
        text += row.map(cell => String(cell)).join('\t') + '\n';
      }
    }

    text += '\n';
  }

  return {
    success: true,
    text,
    metadata: result.data.metadata,
  };
}

// ============================================================================
// IMAGE TEXT EXTRACTION (OCR)
// ============================================================================

/**
 * Extract text from an image using OpenAI Vision API
 * This provides better accuracy than traditional OCR
 */
export async function extractImageText(
  buffer: Buffer,
  contentType: string
): Promise<ExtractionResult> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Convert buffer to base64
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64Image}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text visible in this image. Maintain the original formatting and structure as much as possible. If there is no text, respond with "No text found in image."',
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    const extractedText = response.choices[0]?.message?.content || '';

    return {
      success: true,
      text: extractedText,
      metadata: {
        model: 'gpt-4o',
        tokensUsed: response.usage?.total_tokens,
      },
    };
  } catch (error) {
    console.error('Error extracting text from image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract text from image',
    };
  }
}

// ============================================================================
// IMAGE ANALYSIS
// ============================================================================

/**
 * Analyze an image using OpenAI Vision API
 */
export async function analyzeImage(
  buffer: Buffer,
  contentType: string,
  prompt: string
): Promise<ImageAnalysisResult> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Convert buffer to base64
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64Image}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    const analysis = response.choices[0]?.message?.content || '';

    return {
      success: true,
      analysis,
    };
  } catch (error) {
    console.error('Error analyzing image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze image',
    };
  }
}

/**
 * Describe an image
 */
export async function describeImage(
  buffer: Buffer,
  contentType: string
): Promise<ImageAnalysisResult> {
  return analyzeImage(
    buffer,
    contentType,
    'Provide a detailed description of this image. Include information about the main subjects, colors, composition, and any notable details.'
  );
}

// ============================================================================
// AUDIO TRANSCRIPTION
// ============================================================================

/**
 * Transcribe audio using OpenAI Whisper API
 * Links to the voice module for processing
 */
export async function transcribeAudio(
  buffer: Buffer,
  contentType: string,
  options?: {
    language?: string;
    prompt?: string;
    temperature?: number;
  }
): Promise<TranscriptionResult> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create a File-like object from the buffer
    // OpenAI SDK expects File or ReadStream
    const file = new File([buffer], 'audio.mp3', { type: contentType });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: options?.language,
      prompt: options?.prompt,
      temperature: options?.temperature,
      response_format: 'verbose_json',
    });

    return {
      success: true,
      text: transcription.text,
      duration: (transcription as any).duration,
      language: (transcription as any).language,
    };
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to transcribe audio',
    };
  }
}

// ============================================================================
// TEXT FILE PROCESSING
// ============================================================================

/**
 * Extract text from plain text files
 */
export function extractTextFromTextFile(buffer: Buffer): ExtractionResult {
  try {
    const text = buffer.toString('utf-8');
    return {
      success: true,
      text,
      metadata: {
        length: text.length,
        lines: text.split('\n').length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read text file',
    };
  }
}

/**
 * Parse JSON file
 */
export function parseJsonFile(buffer: Buffer): { success: boolean; data?: any; text?: string; error?: string } {
  try {
    const text = buffer.toString('utf-8');
    const data = JSON.parse(text);
    return {
      success: true,
      data,
      text: JSON.stringify(data, null, 2),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse JSON file',
    };
  }
}

// ============================================================================
// UNIFIED EXTRACTION
// ============================================================================

/**
 * Auto-detect file type and extract text
 */
export async function extractText(
  buffer: Buffer,
  contentType: string
): Promise<ExtractionResult> {
  // PDF
  if (contentType === 'application/pdf') {
    return extractTextFromPDF(buffer);
  }

  // Word documents
  if (
    contentType === 'application/msword' ||
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return extractTextFromDoc(buffer);
  }

  // Spreadsheets
  if (
    contentType === 'application/vnd.ms-excel' ||
    contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    contentType === 'text/csv'
  ) {
    return spreadsheetToText(buffer);
  }

  // Images
  if (contentType.startsWith('image/')) {
    return extractImageText(buffer, contentType);
  }

  // Audio
  if (contentType.startsWith('audio/')) {
    const result = await transcribeAudio(buffer, contentType);
    return {
      success: result.success,
      text: result.text,
      error: result.error,
      metadata: {
        duration: result.duration,
        language: result.language,
      },
    };
  }

  // Plain text, markdown, JSON
  if (
    contentType === 'text/plain' ||
    contentType === 'text/markdown' ||
    contentType === 'application/json'
  ) {
    if (contentType === 'application/json') {
      const result = parseJsonFile(buffer);
      return {
        success: result.success,
        text: result.text,
        error: result.error,
      };
    }
    return extractTextFromTextFile(buffer);
  }

  return {
    success: false,
    error: `Unsupported content type for text extraction: ${contentType}`,
  };
}

export default {
  extractTextFromPDF,
  extractTextFromDoc,
  extractHtmlFromDoc,
  parseSpreadsheet,
  spreadsheetToText,
  extractImageText,
  analyzeImage,
  describeImage,
  transcribeAudio,
  extractTextFromTextFile,
  parseJsonFile,
  extractText,
};
