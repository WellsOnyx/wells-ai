/**
 * Storage utilities for Wells AI
 *
 * Handles persistent file storage using Vercel Blob
 * Supports document uploads, generated documents, and file retrieval
 */

import { put, del, head } from '@vercel/blob'

// Storage configuration
const STORAGE_CONFIG = {
  maxFileSizeMB: 10,
  defaultExpiration: 30 * 24 * 60 * 60, // 30 days in seconds
  allowedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/markdown',
    'text/html',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/json'
  ]
}

export interface StorageMetadata {
  documentId: string
  filename: string
  mimeType: string
  size: number
  uploadedBy?: string
  createdAt: string
  expiresAt?: string
  documentType?: string
}

export interface StoredFile {
  url: string
  downloadUrl: string
  pathname: string
  metadata: StorageMetadata
}

export interface UploadResult {
  success: boolean
  file?: StoredFile
  error?: string
}

/**
 * Upload a file to Vercel Blob storage
 */
export async function uploadFile(
  file: Buffer | string,
  metadata: {
    documentId: string
    filename: string
    mimeType: string
    uploadedBy?: string
    documentType?: string
    expiresInDays?: number
  }
): Promise<UploadResult> {
  try {
    // Validate file size
    const fileSize = typeof file === 'string' ? Buffer.from(file).length : file.length
    const maxSize = STORAGE_CONFIG.maxFileSizeMB * 1024 * 1024

    if (fileSize > maxSize) {
      return {
        success: false,
        error: `File too large. Maximum size is ${STORAGE_CONFIG.maxFileSizeMB}MB. File is ${(fileSize / 1024 / 1024).toFixed(2)}MB.`
      }
    }

    // Validate MIME type
    if (!STORAGE_CONFIG.allowedMimeTypes.includes(metadata.mimeType)) {
      return {
        success: false,
        error: `Unsupported file type: ${metadata.mimeType}. Supported types: PDF, images, text, HTML, DOCX.`
      }
    }

    // Prepare file buffer
    const buffer = typeof file === 'string' ? Buffer.from(file, 'utf-8') : file

    // Generate storage path
    const timestamp = Date.now()
    const sanitizedFilename = sanitizeFilename(metadata.filename)
    const pathname = `wells-ai/${metadata.documentId}/${timestamp}-${sanitizedFilename}`

    // Calculate expiration
    const expiresInSeconds = metadata.expiresInDays
      ? metadata.expiresInDays * 24 * 60 * 60
      : STORAGE_CONFIG.defaultExpiration

    const createdAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

    // Upload to Vercel Blob
    const blob = await put(pathname, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: metadata.mimeType,
      // Store metadata with the blob
      token: process.env.BLOB_READ_WRITE_TOKEN
    })

    // Construct result with metadata
    const storageMetadata: StorageMetadata = {
      documentId: metadata.documentId,
      filename: metadata.filename,
      mimeType: metadata.mimeType,
      size: fileSize,
      uploadedBy: metadata.uploadedBy,
      createdAt,
      expiresAt,
      documentType: metadata.documentType
    }

    const result: StoredFile = {
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      metadata: storageMetadata
    }

    console.log('[STORAGE] File uploaded:', {
      documentId: metadata.documentId,
      filename: metadata.filename,
      size: fileSize,
      url: blob.url
    })

    return {
      success: true,
      file: result
    }

  } catch (error: any) {
    console.error('[STORAGE] Upload error:', error)
    return {
      success: false,
      error: error.message || 'Failed to upload file'
    }
  }
}

/**
 * Upload HTML document (for generated documents)
 */
export async function uploadHTMLDocument(
  html: string,
  metadata: {
    documentId: string
    title: string
    documentType: string
    createdBy?: string
  }
): Promise<UploadResult> {
  const filename = `${sanitizeFilename(metadata.title)}.html`

  return uploadFile(html, {
    documentId: metadata.documentId,
    filename,
    mimeType: 'text/html',
    uploadedBy: metadata.createdBy,
    documentType: metadata.documentType,
    expiresInDays: 30
  })
}

/**
 * Check if a file exists in storage
 */
export async function fileExists(pathname: string): Promise<boolean> {
  try {
    await head(pathname, {
      token: process.env.BLOB_READ_WRITE_TOKEN
    })
    return true
  } catch (error) {
    return false
  }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(pathname: string): Promise<{ success: boolean; error?: string }> {
  try {
    await del(pathname, {
      token: process.env.BLOB_READ_WRITE_TOKEN
    })

    console.log('[STORAGE] File deleted:', pathname)

    return { success: true }
  } catch (error: any) {
    console.error('[STORAGE] Delete error:', error)
    return {
      success: false,
      error: error.message || 'Failed to delete file'
    }
  }
}

/**
 * Delete all files for a document
 */
export async function deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // List all files for this document
    const { list } = await import('@vercel/blob')
    const { blobs } = await list({
      prefix: `wells-ai/${documentId}/`,
      token: process.env.BLOB_READ_WRITE_TOKEN
    })

    // Delete each file
    for (const blob of blobs) {
      await del(blob.url, {
        token: process.env.BLOB_READ_WRITE_TOKEN
      })
    }

    console.log('[STORAGE] Document deleted:', { documentId, filesDeleted: blobs.length })

    return { success: true }
  } catch (error: any) {
    console.error('[STORAGE] Delete document error:', error)
    return {
      success: false,
      error: error.message || 'Failed to delete document'
    }
  }
}

/**
 * Get file info from storage
 */
export async function getFileInfo(pathname: string): Promise<{
  exists: boolean
  size?: number
  contentType?: string
  uploadedAt?: Date
}> {
  try {
    const info = await head(pathname, {
      token: process.env.BLOB_READ_WRITE_TOKEN
    })

    return {
      exists: true,
      size: info.size,
      contentType: info.contentType,
      uploadedAt: info.uploadedAt
    }
  } catch (error) {
    return { exists: false }
  }
}

/**
 * List all files for a document
 */
export async function listDocumentFiles(documentId: string): Promise<{
  success: boolean
  files?: Array<{
    url: string
    pathname: string
    size: number
    uploadedAt: Date
  }>
  error?: string
}> {
  try {
    const { list } = await import('@vercel/blob')
    const { blobs } = await list({
      prefix: `wells-ai/${documentId}/`,
      token: process.env.BLOB_READ_WRITE_TOKEN
    })

    const files = blobs.map(blob => ({
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt
    }))

    return {
      success: true,
      files
    }
  } catch (error: any) {
    console.error('[STORAGE] List files error:', error)
    return {
      success: false,
      error: error.message || 'Failed to list files'
    }
  }
}

/**
 * Generate a temporary signed URL for secure downloads
 * Note: Vercel Blob public URLs are already secure and don't expire by default
 */
export function getDownloadUrl(url: string): string {
  // For Vercel Blob, the downloadUrl is already provided
  // We can add query params to force download behavior
  return url
}

/**
 * Validate file before upload
 */
export function validateFile(
  size: number,
  mimeType: string
): { valid: boolean; error?: string } {
  const maxSize = STORAGE_CONFIG.maxFileSizeMB * 1024 * 1024

  if (size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${STORAGE_CONFIG.maxFileSizeMB}MB. File is ${(size / 1024 / 1024).toFixed(2)}MB.`
    }
  }

  if (!STORAGE_CONFIG.allowedMimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}`
    }
  }

  return { valid: true }
}

/**
 * Sanitize filename for safe storage
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/html': 'html',
    'application/json': 'json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
  }

  return mimeToExt[mimeType] || 'bin'
}

export { STORAGE_CONFIG }
