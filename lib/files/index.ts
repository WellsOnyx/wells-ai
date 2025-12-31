// @ts-nocheck
/**
 * File Handling Module
 * Exports all file-related utilities and types
 */

// Storage
export {
  uploadFile,
  deleteFile,
  deleteFileById,
  getFileMetadata,
  getFileById,
  getFileByUrl,
  getUserFiles,
  updateFileExtractedText,
  updateFileMetadata,
  listUserBlobs,
  isFileTypeSupported,
  isFileSizeValid,
  getFileCategory,
  SUPPORTED_FILE_TYPES,
  ALL_SUPPORTED_TYPES,
  MAX_FILE_SIZES,
} from './storage';

export type {
  FileMetadata,
  UploadedFile,
  FileUploadResult,
} from './storage';

// Processors
export {
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
} from './processors';

export type {
  ExtractionResult,
  SpreadsheetData,
  ImageAnalysisResult,
  TranscriptionResult,
} from './processors';

// Analyzer
export {
  analyzeFile,
  summarizeDocument,
  extractData,
  compareDocuments,
  analyzeContract,
  analyzeFinancialDocument,
  analyzeResume,
  analyzeInvoice,
} from './analyzer';

export type {
  AnalysisResult,
  SummaryResult,
  ExtractedData,
  ComparisonResult,
  DataExtractionSchema,
} from './analyzer';
