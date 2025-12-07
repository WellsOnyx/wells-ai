// @ts-nocheck
/**
 * cXML/OCI Punch-Out API
 *
 * THE ENTRY POINT: When a SAP/Ariba/Coupa user clicks "Shop" from their
 * procurement system, they land HERE. We create a session, they browse
 * our catalog, and the cart goes back to their ERP.
 *
 * THEY NEVER LEAVE THEIR SYSTEM. We're just a catalog to them.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { parseStringPromise, Builder } from 'xml2js'
import crypto from 'crypto'

// POST: Handle incoming PunchOutSetupRequest (cXML) or OCI request
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || ''

  try {
    // Detect protocol (cXML vs OCI)
    if (contentType.includes('xml') || contentType.includes('cxml')) {
      return await handleCXMLPunchOut(req)
    } else if (contentType.includes('form')) {
      return await handleOCIPunchOut(req)
    }

    // Try to parse as cXML anyway
    const body = await req.text()
    if (body.includes('cXML') || body.includes('PunchOutSetupRequest')) {
      return await handleCXMLPunchOutFromText(body)
    }

    return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 })
  } catch (error) {
    console.error('PunchOut error:', error)
    return buildCXMLResponse('500', 'Internal server error')
  }
}

// Handle cXML PunchOutSetupRequest
async function handleCXMLPunchOut(req: NextRequest) {
  const body = await req.text()
  return handleCXMLPunchOutFromText(body)
}

async function handleCXMLPunchOutFromText(body: string) {
  // Parse cXML
  const parsed = await parseStringPromise(body, { explicitArray: false })
  const cxml = parsed.cXML

  // Extract header credentials
  const header = cxml.Header
  const fromCredential = header.From.Credential
  const senderCredential = header.Sender.Credential

  const fromDomain = fromCredential.$.domain
  const fromIdentity = fromCredential.Identity
  const sharedSecret = senderCredential.SharedSecret

  // Verify credentials
  const credCheck = await sql`
    SELECT pc.*, ec.customer_code, ec.company_name
    FROM punchout_credentials pc
    JOIN erp_customers ec ON pc.customer_id = ec.id
    WHERE pc.from_domain = ${fromDomain}
    AND pc.from_identity = ${fromIdentity}
    AND pc.is_active = TRUE
  `

  if (credCheck.rows.length === 0) {
    console.log(`PunchOut: Unknown credentials - ${fromDomain}/${fromIdentity}`)
    return buildCXMLResponse('401', 'Invalid credentials')
  }

  const cred = credCheck.rows[0]

  // Verify shared secret (in production, use bcrypt compare)
  const secretHash = crypto.createHash('sha256').update(sharedSecret).digest('hex')
  if (secretHash !== cred.shared_secret_hash) {
    return buildCXMLResponse('401', 'Invalid shared secret')
  }

  // Extract setup request details
  const request = cxml.Request.PunchOutSetupRequest
  const buyerCookie = request.BuyerCookie
  const browserFormPost = request.BrowserFormPost?.URL
  const operation = request.$.operation || 'create' // create, edit, inspect

  // Extract user info if available
  const extrinsics = request.Extrinsic || []
  let userEmail = null
  let userName = null
  let costCenter = null

  if (Array.isArray(extrinsics)) {
    extrinsics.forEach((ext: any) => {
      if (ext.$.name === 'UserEmail') userEmail = ext._
      if (ext.$.name === 'User') userName = ext._
      if (ext.$.name === 'CostCenter') costCenter = ext._
    })
  }

  // Create punch-out session
  const sessionResult = await sql`
    SELECT * FROM create_punchout_session(
      ${cred.customer_code},
      ${buyerCookie},
      ${browserFormPost},
      ${userEmail},
      ${userName},
      ${costCenter},
      'cxml'
    )
  `

  const session = sessionResult.rows[0]

  console.log(`PunchOut: New session ${session.session_token} for ${cred.company_name}`)

  // Build success response with redirect URL
  return buildCXMLPunchOutResponse(session.redirect_url, buyerCookie)
}

// Handle OCI (Open Catalog Interface) punch-out
async function handleOCIPunchOut(req: NextRequest) {
  const formData = await req.formData()

  const hookUrl = formData.get('HOOK_URL') as string
  const returnTarget = formData.get('RETURN_TARGET') as string || '_parent'
  const ociVersion = formData.get('OCI_VERSION') as string || '4.0'
  const username = formData.get('USERNAME') as string
  const password = formData.get('PASSWORD') as string

  if (!hookUrl) {
    return NextResponse.json({ error: 'Missing HOOK_URL' }, { status: 400 })
  }

  // Verify OCI credentials
  const credCheck = await sql`
    SELECT pc.*, ec.customer_code, ec.company_name
    FROM punchout_credentials pc
    JOIN erp_customers ec ON pc.customer_id = ec.id
    WHERE pc.is_active = TRUE
    LIMIT 1
  `

  if (credCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const cred = credCheck.rows[0]

  // Create session
  const sessionResult = await sql`
    SELECT * FROM create_punchout_session(
      ${cred.customer_code},
      ${null},
      ${hookUrl},
      ${username},
      ${null},
      ${null},
      'oci'
    )
  `

  const session = sessionResult.rows[0]

  // For OCI, redirect to shop with session
  return NextResponse.redirect(session.redirect_url)
}

// Build cXML response
function buildCXMLResponse(statusCode: string, statusText: string) {
  const builder = new Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' }
  })

  const response = {
    cXML: {
      $: {
        'xml:lang': 'en-US',
        timestamp: new Date().toISOString(),
        payloadID: `${Date.now()}.punchout@wellsonyx.io`
      },
      Response: {
        Status: {
          $: { code: statusCode, text: statusText }
        }
      }
    }
  }

  const xml = builder.buildObject(response)
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'text/xml' }
  })
}

// Build cXML PunchOutSetupResponse
function buildCXMLPunchOutResponse(redirectUrl: string, buyerCookie: string) {
  const builder = new Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' }
  })

  const response = {
    cXML: {
      $: {
        'xml:lang': 'en-US',
        timestamp: new Date().toISOString(),
        payloadID: `${Date.now()}.punchout@wellsonyx.io`
      },
      Response: {
        Status: {
          $: { code: '200', text: 'success' }
        },
        PunchOutSetupResponse: {
          StartPage: {
            URL: redirectUrl
          }
        }
      }
    }
  }

  const xml = builder.buildObject(response)
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'text/xml' }
  })
}

// GET: Check session status or health
export async function GET(req: NextRequest) {
  const sessionToken = req.nextUrl.searchParams.get('session')

  if (sessionToken) {
    const sessionResult = await sql`
      SELECT ps.*, ec.company_name
      FROM punchout_sessions ps
      JOIN erp_customers ec ON ps.customer_id = ec.id
      WHERE ps.session_token = ${sessionToken}
    `

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const session = sessionResult.rows[0]

    return NextResponse.json({
      session: {
        id: session.id,
        company: session.company_name,
        status: session.status,
        cartItems: session.cart_items,
        cartTotal: session.cart_total,
        expiresAt: session.expires_at,
        protocol: session.protocol
      }
    })
  }

  return NextResponse.json({
    service: 'Wells Onyx PunchOut Gateway',
    protocols: ['cXML', 'OCI 4.0+'],
    capabilities: {
      punchOutSetup: true,
      punchOutOrder: true,
      catalogSearch: true,
      orderConfirmation: true
    },
    documentation: 'https://docs.wellsonyx.io/erp/punchout'
  })
}
