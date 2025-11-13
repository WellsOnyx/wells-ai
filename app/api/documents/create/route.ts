import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { uploadHTMLDocument } from '@/lib/storage'

/**
 * Document Creation API for Wells AI
 *
 * Allows Wells to create professional documents (proposals, one-pagers, briefs)
 * Documents are generated as HTML and stored in Vercel Blob for persistent access
 */

interface CreateDocumentRequest {
  title: string
  content: string
  type: 'proposal' | 'one_pager' | 'brief' | 'summary' | 'report'
  recipient?: string
  userId?: string
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    const body: CreateDocumentRequest = await request.json()

    const { title, content, type, recipient } = body

    if (!title || !content || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, type' },
        { status: 400 }
      )
    }

    // Generate document ID
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Convert markdown content to HTML
    const html = generateDocumentHTML({
      title,
      content,
      type,
      recipient,
      docId
    })

    // Upload HTML document to Vercel Blob storage
    const uploadResult = await uploadHTMLDocument(html, {
      documentId: docId,
      title,
      documentType: type,
      createdBy: userId || undefined
    })

    if (!uploadResult.success) {
      return NextResponse.json(
        { error: uploadResult.error || 'Failed to save document' },
        { status: 500 }
      )
    }

    const { file } = uploadResult
    const documentUrl = `/api/documents/${docId}`

    console.log('[DOCUMENTS] Created document:', {
      docId,
      title,
      type,
      userId,
      storageUrl: file?.url
    })

    return NextResponse.json({
      success: true,
      document: {
        id: docId,
        title,
        type,
        url: documentUrl,
        downloadUrl: `${documentUrl}/download`,
        storageUrl: file?.url,
        createdAt: new Date().toISOString(),
        expiresAt: file?.metadata.expiresAt
      },
      message: `Document created: ${title}. Download link: ${process.env.NEXT_PUBLIC_APP_URL}${documentUrl}/download`
    })

  } catch (error: any) {
    console.error('[DOCUMENTS] Error creating document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create document' },
      { status: 500 }
    )
  }
}

/**
 * Generate HTML document from markdown content
 */
function generateDocumentHTML(params: {
  title: string
  content: string
  type: string
  recipient?: string
  docId: string
}): string {
  const { title, content, type, recipient, docId } = params

  // Convert markdown to HTML (basic conversion)
  let htmlContent = content
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')

  // Wrap orphaned list items
  htmlContent = htmlContent.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')

  // Wrap in paragraphs
  htmlContent = `<p>${htmlContent}</p>`

  const typeLabel = type.replace('_', ' ').toUpperCase()
  const recipientLine = recipient ? `<p class="recipient"><strong>For:</strong> ${recipient}</p>` : ''

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 60px 40px;
      background: #ffffff;
    }

    header {
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #dba63f;
    }

    .doc-type {
      font-size: 12px;
      font-weight: 600;
      color: #dba63f;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    h1 {
      font-size: 32px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 16px;
      line-height: 1.2;
    }

    .recipient {
      color: #666;
      font-size: 14px;
      margin-top: 12px;
    }

    .content {
      margin-top: 40px;
    }

    h2 {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin-top: 32px;
      margin-bottom: 16px;
    }

    h3 {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
      margin-top: 24px;
      margin-bottom: 12px;
    }

    p {
      margin-bottom: 16px;
      color: #333;
    }

    ul {
      margin-bottom: 16px;
      padding-left: 24px;
    }

    li {
      margin-bottom: 8px;
      color: #333;
    }

    strong {
      font-weight: 600;
      color: #1a1a1a;
    }

    a {
      color: #dba63f;
      text-decoration: none;
      border-bottom: 1px solid #dba63f;
    }

    a:hover {
      border-bottom-width: 2px;
    }

    footer {
      margin-top: 60px;
      padding-top: 30px;
      border-top: 1px solid #e5e5e5;
      font-size: 14px;
      color: #999;
      text-align: center;
    }

    .logo {
      font-weight: 700;
      color: #dba63f;
    }

    @media print {
      body {
        padding: 40px;
      }

      footer {
        page-break-inside: avoid;
      }
    }

    @media (max-width: 600px) {
      body {
        padding: 30px 20px;
      }

      h1 {
        font-size: 24px;
      }

      h2 {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="doc-type">${typeLabel}</div>
    <h1>${title}</h1>
    ${recipientLine}
    <p style="color: #999; font-size: 14px; margin-top: 8px;">
      Created: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </p>
  </header>

  <div class="content">
    ${htmlContent}
  </div>

  <footer>
    <p><span class="logo">Wells Onyx</span></p>
    <p>Document ID: ${docId}</p>
    <p>Created via <a href="https://wellsai.vercel.app">wellsai.vercel.app</a></p>
  </footer>
</body>
</html>
  `.trim()
}
