// @ts-nocheck
/**
 * File Operations API Endpoint
 * GET: Get file metadata
 * PATCH: Update file metadata/extracted text
 * DELETE: Delete file
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getFileById,
  deleteFileById,
  updateFileExtractedText,
  updateFileMetadata,
} from '@/lib/files/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: Get file metadata
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const file = await getFileById(id);
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Check if user owns the file
    if (file.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to access this file' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      file: {
        id: file.id,
        url: file.url,
        filename: file.filename,
        contentType: file.contentType,
        size: file.size,
        hasExtractedText: !!file.extractedText,
        extractedTextPreview: file.extractedText
          ? file.extractedText.substring(0, 500) + (file.extractedText.length > 500 ? '...' : '')
          : null,
        metadata: file.metadata,
        createdAt: file.createdAt,
      },
    });
  } catch (error) {
    console.error('Error getting file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get file' },
      { status: 500 }
    );
  }
}

// PATCH: Update file metadata or extracted text
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { extractedText, metadata } = body as {
      extractedText?: string;
      metadata?: Record<string, any>;
    };

    // Get file to verify ownership
    const file = await getFileById(id);
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    if (file.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to modify this file' },
        { status: 403 }
      );
    }

    // Update extracted text
    if (extractedText !== undefined) {
      const success = await updateFileExtractedText(id, extractedText);
      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update extracted text' },
          { status: 500 }
        );
      }
    }

    // Update metadata
    if (metadata !== undefined) {
      const success = await updateFileMetadata(id, metadata);
      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update metadata' },
          { status: 500 }
        );
      }
    }

    // Fetch updated file
    const updatedFile = await getFileById(id);

    return NextResponse.json({
      success: true,
      file: updatedFile,
    });
  } catch (error) {
    console.error('Error updating file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update file' },
      { status: 500 }
    );
  }
}

// DELETE: Delete file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get file to verify ownership
    const file = await getFileById(id);
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    if (file.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this file' },
        { status: 403 }
      );
    }

    // Delete file
    const result = await deleteFileById(id);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete file' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete file' },
      { status: 500 }
    );
  }
}
