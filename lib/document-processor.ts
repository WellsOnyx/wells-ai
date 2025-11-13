/**
 * Document Processing for Wells AI
 *
 * Handles PDFs, images, DOCX, and other file formats
 * Extracts text and makes content available to Wells
 * Saves uploaded files to persistent storage (Vercel Blob)
 */

import Anthropic from '@anthropic-ai/sdk'
import { uploadFile, type StoredFile } from './storage'

export interface ProcessedDocument {
  success: boolean
  content?: string
  extracted_text?: string
  image_analysis?: string
  metadata?: {
    filename: string
    mimeType: string
    size: number
    pages?: number
  }
  storedFile?: StoredFile
  error?: string
}

/**
 * Process a document/image for Wells AI to read
 *
 * Supports:
 * - PDFs (text extraction + OCR)
 * - Images (PNG, JPG, WEBP - vision analysis)
 * - Plain text files
 * - (Future: DOCX, XLSX)
 *
 * @param file - File buffer or string content
 * @param mimeType - MIME type of the file
 * @param filename - Original filename
 * @param saveToStorage - Whether to save the file to persistent storage (default: true)
 * @param userId - Optional user ID for tracking uploads
 */
export async function processDocument(
  file: Buffer | string,
  mimeType: string,
  filename: string,
  saveToStorage: boolean = true,
  userId?: string
): Promise<ProcessedDocument> {
  console.log('[DOCUMENT] Processing:', { filename, mimeType, size: typeof file === 'string' ? file.length : file.length })

  try {
    // Generate a document ID for storage
    const docId = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`

    let processedResult: ProcessedDocument

    // Handle images with Claude's vision capability
    if (mimeType.startsWith('image/')) {
      processedResult = await processImage(file as Buffer, mimeType, filename)
    }
    // Handle PDFs
    else if (mimeType === 'application/pdf') {
      processedResult = await processPDF(file as Buffer, filename)
    }
    // Handle plain text
    else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      const text = typeof file === 'string' ? file : file.toString('utf-8')
      processedResult = {
        success: true,
        content: text,
        metadata: {
          filename,
          mimeType,
          size: text.length
        }
      }
    }
    // Unsupported format
    else {
      return {
        success: false,
        error: `Unsupported file type: ${mimeType}. Supported formats: PDF, images (PNG/JPG/WEBP), plain text.`
      }
    }

    // Save to storage if requested and processing was successful
    if (saveToStorage && processedResult.success) {
      const fileBuffer = typeof file === 'string' ? Buffer.from(file, 'utf-8') : file

      const uploadResult = await uploadFile(fileBuffer, {
        documentId: docId,
        filename,
        mimeType,
        uploadedBy: userId,
        documentType: 'upload',
        expiresInDays: 30
      })

      if (uploadResult.success && uploadResult.file) {
        processedResult.storedFile = uploadResult.file
        console.log('[DOCUMENT] Saved to storage:', {
          docId,
          filename,
          url: uploadResult.file.url
        })
      } else {
        console.warn('[DOCUMENT] Failed to save to storage:', uploadResult.error)
      }
    }

    return processedResult

  } catch (error: any) {
    console.error('[DOCUMENT] Processing error:', error)
    return {
      success: false,
      error: error.message || 'Failed to process document'
    }
  }
}

/**
 * Process image using Claude's vision capability
 */
async function processImage(
  imageBuffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ProcessedDocument> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      success: false,
      error: 'Anthropic API key not configured'
    }
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  })

  // Convert buffer to base64
  const base64Image = imageBuffer.toString('base64')

  // Use Claude to analyze the image
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Image
            }
          },
          {
            type: 'text',
            text: 'Analyze this image and provide:\n1. A detailed description of what you see\n2. Any text visible in the image (OCR)\n3. Key information or data points\n\nBe thorough and specific.'
          }
        ]
      }
    ]
  })

  const analysis = response.content.find(block => block.type === 'text')?.text || ''

  return {
    success: true,
    image_analysis: analysis,
    content: `[Image: ${filename}]\n\n${analysis}`,
    metadata: {
      filename,
      mimeType,
      size: imageBuffer.length
    }
  }
}

/**
 * Process PDF document
 */
async function processPDF(
  pdfBuffer: Buffer,
  filename: string
): Promise<ProcessedDocument> {
  // For PDFs, we can use Claude's PDF reading capability directly
  // by sending it as a document

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      success: false,
      error: 'Anthropic API key not configured'
    }
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  })

  // Convert PDF to base64
  const base64PDF = pdfBuffer.toString('base64')

  // Use Claude to read the PDF
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64PDF
            }
          },
          {
            type: 'text',
            text: 'Extract and summarize the content of this PDF. Include:\n1. Main topics/sections\n2. Key data points or numbers\n3. Any important details\n\nProvide a comprehensive extraction.'
          }
        ]
      }
    ]
  })

  const extracted = response.content.find(block => block.type === 'text')?.text || ''

  return {
    success: true,
    extracted_text: extracted,
    content: `[PDF Document: ${filename}]\n\n${extracted}`,
    metadata: {
      filename,
      mimeType: 'application/pdf',
      size: pdfBuffer.length
    }
  }
}

/**
 * Format document content for inclusion in chat
 */
export function formatDocumentForChat(doc: ProcessedDocument): string {
  if (!doc.success || !doc.content) {
    return `[Document processing failed: ${doc.error}]`
  }

  return `\n\n---\n**Document Attached: ${doc.metadata?.filename}**\n\n${doc.content}\n---\n\n`
}

/**
 * Validate file before processing
 */
export function validateDocument(
  size: number,
  mimeType: string
): { valid: boolean; error?: string } {
  // Max file size: 10MB
  const MAX_SIZE = 10 * 1024 * 1024

  if (size > MAX_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is 10MB. Your file is ${(size / 1024 / 1024).toFixed(2)}MB.`
    }
  }

  // Allowed MIME types
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/markdown'
  ]

  if (!ALLOWED_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}. Supported: PDF, images, text files.`
    }
  }

  return { valid: true }
}
