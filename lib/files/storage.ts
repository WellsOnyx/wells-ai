// @ts-nocheck
/**
 * File Storage Abstraction
 * Handles file uploads to Vercel Blob storage with metadata management
 */

import { put, del, head, list } from '@vercel/blob';
import { sql } from '@vercel/postgres';

// ============================================================================
// TYPES
// ============================================================================

export interface FileMetadata {
  userId: string;
  filename: string;
  contentType: string;
  size: number;
  purpose?: 'chat' | 'document' | 'analysis' | 'attachment';
  conversationId?: string;
  tags?: string[];
  customMetadata?: Record<string, any>;
}

export interface UploadedFile {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  userId: string;
  extractedText?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface FileUploadResult {
  success: boolean;
  file?: UploadedFile;
  error?: string;
}

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  spreadsheets: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  text: ['text/plain', 'text/markdown', 'application/json'],
} as const;

export const ALL_SUPPORTED_TYPES = [
  ...SUPPORTED_FILE_TYPES.images,
  ...SUPPORTED_FILE_TYPES.documents,
  ...SUPPORTED_FILE_TYPES.spreadsheets,
  ...SUPPORTED_FILE_TYPES.audio,
  ...SUPPORTED_FILE_TYPES.video,
  ...SUPPORTED_FILE_TYPES.text,
];

// Max file sizes by type (in bytes)
export const MAX_FILE_SIZES = {
  images: 10 * 1024 * 1024,       // 10MB
  documents: 50 * 1024 * 1024,    // 50MB
  spreadsheets: 25 * 1024 * 1024, // 25MB
  audio: 100 * 1024 * 1024,       // 100MB
  video: 500 * 1024 * 1024,       // 500MB
  text: 5 * 1024 * 1024,          // 5MB
  default: 50 * 1024 * 1024,      // 50MB
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getFileCategory(contentType: string): keyof typeof SUPPORTED_FILE_TYPES | null {
  for (const [category, types] of Object.entries(SUPPORTED_FILE_TYPES)) {
    if ((types as readonly string[]).includes(contentType)) {
      return category as keyof typeof SUPPORTED_FILE_TYPES;
    }
  }
  return null;
}

export function isFileSizeValid(size: number, contentType: string): boolean {
  const category = getFileCategory(contentType);
  const maxSize = category ? MAX_FILE_SIZES[category] : MAX_FILE_SIZES.default;
  return size <= maxSize;
}

export function isFileTypeSupported(contentType: string): boolean {
  return ALL_SUPPORTED_TYPES.includes(contentType as any);
}

function generateFilePath(userId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `files/${userId}/${timestamp}-${sanitizedFilename}`;
}

// ============================================================================
// FILE STORAGE OPERATIONS
// ============================================================================

/**
 * Upload a file to Vercel Blob storage
 */
export async function uploadFile(
  file: File | Buffer | ArrayBuffer,
  metadata: FileMetadata
): Promise<FileUploadResult> {
  try {
    // Validate file type
    if (!isFileTypeSupported(metadata.contentType)) {
      return {
        success: false,
        error: `Unsupported file type: ${metadata.contentType}. Supported types: ${ALL_SUPPORTED_TYPES.join(', ')}`,
      };
    }

    // Validate file size
    if (!isFileSizeValid(metadata.size, metadata.contentType)) {
      const category = getFileCategory(metadata.contentType);
      const maxSize = category ? MAX_FILE_SIZES[category] : MAX_FILE_SIZES.default;
      return {
        success: false,
        error: `File size exceeds maximum allowed (${Math.round(maxSize / 1024 / 1024)}MB for ${category || 'this file type'})`,
      };
    }

    // Generate file path
    const path = generateFilePath(metadata.userId, metadata.filename);

    // Upload to Vercel Blob
    const blob = await put(path, file, {
      access: 'public',
      contentType: metadata.contentType,
      addRandomSuffix: true,
    });

    // Store file record in database
    const result = await sql`
      INSERT INTO files (
        user_id,
        filename,
        content_type,
        size,
        url,
        metadata,
        created_at
      ) VALUES (
        ${metadata.userId},
        ${metadata.filename},
        ${metadata.contentType},
        ${metadata.size},
        ${blob.url},
        ${JSON.stringify({
          purpose: metadata.purpose,
          conversationId: metadata.conversationId,
          tags: metadata.tags,
          blobPathname: blob.pathname,
          ...metadata.customMetadata,
        })}::jsonb,
        NOW()
      )
      RETURNING *
    `;

    const uploadedFile = mapFileFromDb(result.rows[0]);

    return {
      success: true,
      file: uploadedFile,
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload file',
    };
  }
}

/**
 * Delete a file from Vercel Blob storage
 */
export async function deleteFile(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete from Vercel Blob
    await del(url);

    // Delete from database
    await sql`
      DELETE FROM files WHERE url = ${url}
    `;

    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete file',
    };
  }
}

/**
 * Delete a file by its database ID
 */
export async function deleteFileById(fileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get file URL first
    const file = await getFileById(fileId);
    if (!file) {
      return { success: false, error: 'File not found' };
    }

    // Delete from Vercel Blob
    await del(file.url);

    // Delete from database
    await sql`
      DELETE FROM files WHERE id = ${fileId}
    `;

    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete file',
    };
  }
}

/**
 * Get file metadata from Vercel Blob
 */
export async function getFileMetadata(url: string): Promise<{
  size: number;
  contentType: string;
  uploadedAt: Date;
  pathname: string;
} | null> {
  try {
    const blobMetadata = await head(url);
    return {
      size: blobMetadata.size,
      contentType: blobMetadata.contentType,
      uploadedAt: new Date(blobMetadata.uploadedAt),
      pathname: blobMetadata.pathname,
    };
  } catch (error) {
    console.error('Error getting file metadata:', error);
    return null;
  }
}

/**
 * Get file by ID from database
 */
export async function getFileById(fileId: string): Promise<UploadedFile | null> {
  try {
    const result = await sql`
      SELECT * FROM files WHERE id = ${fileId}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return mapFileFromDb(result.rows[0]);
  } catch (error) {
    console.error('Error getting file:', error);
    return null;
  }
}

/**
 * Get file by URL from database
 */
export async function getFileByUrl(url: string): Promise<UploadedFile | null> {
  try {
    const result = await sql`
      SELECT * FROM files WHERE url = ${url}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return mapFileFromDb(result.rows[0]);
  } catch (error) {
    console.error('Error getting file:', error);
    return null;
  }
}

/**
 * Get all files for a user
 */
export async function getUserFiles(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    contentType?: string;
    purpose?: string;
    conversationId?: string;
  }
): Promise<{ files: UploadedFile[]; total: number }> {
  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    let whereClause = 'user_id = $1';
    const params: any[] = [userId];

    if (options?.contentType) {
      whereClause += ` AND content_type LIKE $${params.length + 1}`;
      params.push(`${options.contentType}%`);
    }

    if (options?.purpose) {
      whereClause += ` AND metadata->>'purpose' = $${params.length + 1}`;
      params.push(options.purpose);
    }

    if (options?.conversationId) {
      whereClause += ` AND metadata->>'conversationId' = $${params.length + 1}`;
      params.push(options.conversationId);
    }

    // Get total count
    const countResult = await sql.query(
      `SELECT COUNT(*) as count FROM files WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get files
    const filesResult = await sql.query(
      `SELECT * FROM files WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return {
      files: filesResult.rows.map(mapFileFromDb),
      total,
    };
  } catch (error) {
    console.error('Error getting user files:', error);
    return { files: [], total: 0 };
  }
}

/**
 * Update file extracted text
 */
export async function updateFileExtractedText(
  fileId: string,
  extractedText: string
): Promise<boolean> {
  try {
    await sql`
      UPDATE files
      SET extracted_text = ${extractedText}
      WHERE id = ${fileId}
    `;
    return true;
  } catch (error) {
    console.error('Error updating file extracted text:', error);
    return false;
  }
}

/**
 * Update file metadata
 */
export async function updateFileMetadata(
  fileId: string,
  metadata: Record<string, any>
): Promise<boolean> {
  try {
    await sql`
      UPDATE files
      SET metadata = metadata || ${JSON.stringify(metadata)}::jsonb
      WHERE id = ${fileId}
    `;
    return true;
  } catch (error) {
    console.error('Error updating file metadata:', error);
    return false;
  }
}

/**
 * List all blobs for a user (from Vercel Blob directly)
 */
export async function listUserBlobs(userId: string): Promise<{
  blobs: Array<{
    url: string;
    pathname: string;
    size: number;
    uploadedAt: Date;
  }>;
}> {
  try {
    const { blobs } = await list({
      prefix: `files/${userId}/`,
    });

    return {
      blobs: blobs.map(blob => ({
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: new Date(blob.uploadedAt),
      })),
    };
  } catch (error) {
    console.error('Error listing user blobs:', error);
    return { blobs: [] };
  }
}

// ============================================================================
// DATABASE MAPPING
// ============================================================================

function mapFileFromDb(row: any): UploadedFile {
  return {
    id: row.id,
    url: row.url,
    filename: row.filename,
    contentType: row.content_type,
    size: row.size,
    userId: row.user_id,
    extractedText: row.extracted_text,
    metadata: row.metadata || {},
    createdAt: new Date(row.created_at),
  };
}

export default {
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
};
