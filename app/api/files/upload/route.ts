// @ts-nocheck
/**
 * File Upload API Endpoint
 * POST: Accept multipart form data, store file, return URL and metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  uploadFile,
  isFileTypeSupported,
  isFileSizeValid,
  getFileCategory,
  MAX_FILE_SIZES,
  ALL_SUPPORTED_TYPES,
} from '@/lib/files/storage';
import { extractText } from '@/lib/files/processors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Increase body size limit for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Get optional metadata from form
    const purpose = (formData.get('purpose') as string) || 'attachment';
    const conversationId = formData.get('conversationId') as string | null;
    const tagsString = formData.get('tags') as string | null;
    const tags = tagsString ? tagsString.split(',').map(t => t.trim()) : undefined;
    const extractTextOption = formData.get('extractText') !== 'false'; // Default to true

    // Validate file type
    const contentType = file.type || 'application/octet-stream';
    if (!isFileTypeSupported(contentType)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${contentType}`,
          supportedTypes: ALL_SUPPORTED_TYPES,
        },
        { status: 400 }
      );
    }

    // Validate file size
    const fileSize = file.size;
    if (!isFileSizeValid(fileSize, contentType)) {
      const category = getFileCategory(contentType);
      const maxSize = category ? MAX_FILE_SIZES[category] : MAX_FILE_SIZES.default;
      return NextResponse.json(
        {
          error: `File size (${Math.round(fileSize / 1024 / 1024)}MB) exceeds maximum allowed (${Math.round(maxSize / 1024 / 1024)}MB)`,
          maxSize,
        },
        { status: 400 }
      );
    }

    // Convert File to Buffer for processing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload file
    const result = await uploadFile(buffer, {
      userId,
      filename: file.name,
      contentType,
      size: fileSize,
      purpose: purpose as any,
      conversationId: conversationId || undefined,
      tags,
    });

    if (!result.success || !result.file) {
      return NextResponse.json(
        { error: result.error || 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Extract text in the background if requested
    let extractedText: string | null = null;
    if (extractTextOption) {
      try {
        const extraction = await extractText(buffer, contentType);
        if (extraction.success && extraction.text) {
          extractedText = extraction.text;
          // Update file with extracted text (async, don't await)
          fetch(`${request.nextUrl.origin}/api/files/${result.file.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extractedText }),
          }).catch(console.error);
        }
      } catch (error) {
        console.error('Error extracting text:', error);
        // Don't fail the upload if text extraction fails
      }
    }

    return NextResponse.json({
      success: true,
      file: {
        ...result.file,
        extractedText: extractedText ? extractedText.substring(0, 500) + '...' : null,
        hasExtractedText: !!extractedText,
      },
    });
  } catch (error) {
    console.error('Error in file upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
