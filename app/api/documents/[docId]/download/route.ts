import { NextResponse } from 'next/server'
import { listDocumentFiles, getDownloadUrl } from '@/lib/storage'

/**
 * Document Download API
 *
 * GET /api/documents/[docId]/download
 * Returns the document file with proper content-disposition headers for download
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

    // Get the primary HTML document
    const primaryFile = result.files.find(f => f.pathname.endsWith('.html')) || result.files[0]

    // Extract filename from pathname
    const pathParts = primaryFile.pathname.split('/')
    const filename = pathParts[pathParts.length - 1]

    // Fetch the file content from Vercel Blob
    const fileResponse = await fetch(primaryFile.url)

    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch document from storage' },
        { status: 500 }
      )
    }

    const content = await fileResponse.text()

    console.log('[DOCUMENTS] Downloaded document:', {
      docId,
      filename,
      size: content.length
    })

    // Return the document with download headers
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': content.length.toString(),
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    })

  } catch (error: any) {
    console.error('[DOCUMENTS] Error downloading document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to download document' },
      { status: 500 }
    )
  }
}

/**
 * Preview endpoint - returns document for viewing in browser
 *
 * GET /api/documents/[docId]/download?preview=true
 * Returns HTML for inline viewing instead of download
 */
export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params
    const { searchParams } = new URL(request.url)
    const isPreview = searchParams.get('preview') === 'true'

    // List files to check if document exists
    const result = await listDocumentFiles(docId)

    if (!result.success || !result.files || result.files.length === 0) {
      return new NextResponse(null, { status: 404 })
    }

    const primaryFile = result.files.find(f => f.pathname.endsWith('.html')) || result.files[0]

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Length': primaryFile.size.toString(),
        'Last-Modified': primaryFile.uploadedAt.toUTCString()
      }
    })

  } catch (error: any) {
    console.error('[DOCUMENTS] Error checking document:', error)
    return new NextResponse(null, { status: 500 })
  }
}
