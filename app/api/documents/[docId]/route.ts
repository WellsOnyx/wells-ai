import { NextResponse } from 'next/server'
import { listDocumentFiles } from '@/lib/storage'

/**
 * Document Retrieval API
 *
 * GET /api/documents/[docId]
 * Returns document metadata and access URLs
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params

    if (!docId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Validate document ID format
    if (!docId.match(/^doc_\d+_[a-z0-9]+$/)) {
      return NextResponse.json(
        { error: 'Invalid document ID format' },
        { status: 400 }
      )
    }

    // List all files for this document
    const result = await listDocumentFiles(docId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to retrieve document' },
        { status: 500 }
      )
    }

    if (!result.files || result.files.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Get the primary HTML document (usually the first one)
    const primaryFile = result.files.find(f => f.pathname.endsWith('.html')) || result.files[0]

    console.log('[DOCUMENTS] Retrieved document:', {
      docId,
      filesCount: result.files.length,
      primaryFile: primaryFile.pathname
    })

    return NextResponse.json({
      success: true,
      document: {
        id: docId,
        url: primaryFile.url,
        downloadUrl: `/api/documents/${docId}/download`,
        files: result.files.map(f => ({
          url: f.url,
          pathname: f.pathname,
          size: f.size,
          uploadedAt: f.uploadedAt
        }))
      }
    })

  } catch (error: any) {
    console.error('[DOCUMENTS] Error retrieving document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve document' },
      { status: 500 }
    )
  }
}

/**
 * Delete a document
 *
 * DELETE /api/documents/[docId]
 * Removes document and all associated files from storage
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params

    if (!docId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Import deleteDocument function
    const { deleteDocument } = await import('@/lib/storage')

    // Delete all files for this document
    const result = await deleteDocument(docId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete document' },
        { status: 500 }
      )
    }

    console.log('[DOCUMENTS] Deleted document:', { docId })

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })

  } catch (error: any) {
    console.error('[DOCUMENTS] Error deleting document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete document' },
      { status: 500 }
    )
  }
}
