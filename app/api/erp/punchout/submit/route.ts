// @ts-nocheck
/**
 * PunchOut Cart Submission
 *
 * When the user finishes shopping and clicks "Return to Procurement",
 * we build a cXML PunchOutOrderMessage and POST it back to their ERP.
 *
 * The cart becomes a requisition in SAP/Ariba/Coupa.
 * They approve it. We get a PO. We capture margin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { Builder } from 'xml2js'

// POST: Submit cart back to ERP
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionToken, cartItems } = body

    if (!sessionToken || !cartItems) {
      return NextResponse.json({
        error: 'Missing sessionToken or cartItems'
      }, { status: 400 })
    }

    // Get session
    const sessionResult = await sql`
      SELECT ps.*, ec.company_name, ec.customer_code
      FROM punchout_sessions ps
      JOIN erp_customers ec ON ps.customer_id = ec.id
      WHERE ps.session_token = ${sessionToken}
      AND ps.status = 'active'
    `

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Invalid or expired session'
      }, { status: 400 })
    }

    const session = sessionResult.rows[0]

    // Update session with cart
    await sql`
      UPDATE punchout_sessions SET
        cart_items = ${JSON.stringify(cartItems)},
        cart_total = ${calculateCartTotal(cartItems)},
        status = 'submitted',
        submitted_at = NOW()
      WHERE id = ${session.id}
    `

    // Build return response based on protocol
    if (session.protocol === 'cxml') {
      const orderMessage = buildCXMLOrderMessage(session, cartItems)

      // Return the cXML for the browser to POST to the ERP
      return NextResponse.json({
        success: true,
        protocol: 'cxml',
        returnUrl: session.return_url,
        orderMessage,
        formFields: {
          cXML_URL_Encoded: encodeURIComponent(orderMessage)
        },
        instructions: 'POST cXML-urlencoded=<orderMessage> to returnUrl'
      })
    } else {
      // OCI response - return as form fields
      const ociFields = buildOCIResponse(session, cartItems)

      return NextResponse.json({
        success: true,
        protocol: 'oci',
        returnUrl: session.return_url,
        formFields: ociFields,
        instructions: 'Submit form with fields to returnUrl'
      })
    }
  } catch (error) {
    console.error('Cart submission error:', error)
    return NextResponse.json({ error: 'Failed to submit cart' }, { status: 500 })
  }
}

function calculateCartTotal(items: any[]): number {
  return items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice))
  }, 0)
}

// Build cXML PunchOutOrderMessage
function buildCXMLOrderMessage(session: any, items: any[]): string {
  const builder = new Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' }
  })

  const itemList = items.map((item, idx) => ({
    ItemIn: {
      $: { quantity: item.quantity },
      ItemID: {
        SupplierPartID: item.sku,
        SupplierPartAuxiliaryID: item.auxiliaryId || ''
      },
      ItemDetail: {
        UnitPrice: {
          Money: {
            $: { currency: 'USD' },
            _: item.unitPrice.toFixed(2)
          }
        },
        Description: {
          $: { 'xml:lang': 'en' },
          _: item.description
        },
        UnitOfMeasure: item.uom || 'EA',
        Classification: {
          $: { domain: 'UNSPSC' },
          _: item.unspsc || '00000000'
        },
        ManufacturerPartID: item.manufacturerSku || '',
        ManufacturerName: item.manufacturer || ''
      }
    }
  }))

  const message = {
    cXML: {
      $: {
        'xml:lang': 'en-US',
        timestamp: new Date().toISOString(),
        payloadID: `${Date.now()}.order@wellsonyx.io`
      },
      Header: {
        From: {
          Credential: {
            $: { domain: 'DUNS' },
            Identity: 'wellsonyx'
          }
        },
        To: {
          Credential: {
            $: { domain: 'DUNS' },
            Identity: session.customer_code
          }
        },
        Sender: {
          Credential: {
            $: { domain: 'NetworkID' },
            Identity: 'WellsOnyx'
          },
          UserAgent: 'Wells Onyx Procurement v1.0'
        }
      },
      Message: {
        PunchOutOrderMessage: {
          BuyerCookie: session.buyer_cookie,
          PunchOutOrderMessageHeader: {
            $: { operationAllowed: 'create' },
            Total: {
              Money: {
                $: { currency: 'USD' },
                _: calculateCartTotal(items).toFixed(2)
              }
            }
          },
          ItemIn: itemList.map(i => i.ItemIn)
        }
      }
    }
  }

  return builder.buildObject(message)
}

// Build OCI response fields
function buildOCIResponse(session: any, items: any[]): Record<string, string> {
  const fields: Record<string, string> = {
    'OK': '1'
  }

  items.forEach((item, idx) => {
    const prefix = `NEW_ITEM-${idx + 1}`
    fields[`${prefix}-DESCRIPTION`] = item.description
    fields[`${prefix}-MATNR`] = item.sku
    fields[`${prefix}-QUANTITY`] = item.quantity.toString()
    fields[`${prefix}-UNIT`] = item.uom || 'EA'
    fields[`${prefix}-PRICE`] = item.unitPrice.toFixed(2)
    fields[`${prefix}-PRICEUNIT`] = '1'
    fields[`${prefix}-CURRENCY`] = 'USD'
    fields[`${prefix}-VENDORMAT`] = item.sku
    fields[`${prefix}-MANUFACTCODE`] = item.manufacturer || ''
    fields[`${prefix}-MANUFACTMAT`] = item.manufacturerSku || ''
    fields[`${prefix}-MATGROUP`] = item.category || ''
    fields[`${prefix}-LONGTEXT`] = item.longDescription || item.description
  })

  return fields
}

// GET: Get cart for a session
export async function GET(req: NextRequest) {
  const sessionToken = req.nextUrl.searchParams.get('session')

  if (!sessionToken) {
    return NextResponse.json({ error: 'Missing session token' }, { status: 400 })
  }

  const sessionResult = await sql`
    SELECT cart_items, cart_total, status
    FROM punchout_sessions
    WHERE session_token = ${sessionToken}
  `

  if (sessionResult.rows.length === 0) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const session = sessionResult.rows[0]

  return NextResponse.json({
    cart: {
      items: session.cart_items,
      total: session.cart_total,
      status: session.status
    }
  })
}
