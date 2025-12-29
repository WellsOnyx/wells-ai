// @ts-nocheck
/**
 * WellsAI Conversational ERP - Contacts/Vendors API
 *
 * CRUD operations for vendors/contacts with natural language support.
 * Contacts can be suppliers, customers, or both.
 *
 * GET /api/erp/wells/contacts - List contacts
 * POST /api/erp/wells/contacts - Add contact
 * PUT /api/erp/wells/contacts - Update contact
 * DELETE /api/erp/wells/contacts - Deactivate contact
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { WellsVendorRegistry, type CreateVendorRequest } from '@/lib/wells-erp/vendor-registry'
import { getWellsERP } from '@/lib/erp/wells-erp'

// ============================================================================
// GET - List/Search Contacts
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId') || 'default-user'
    const vendorType = searchParams.get('type') as 'supplier' | 'customer' | 'both' | null
    const status = searchParams.get('status')
    const query = searchParams.get('query') || searchParams.get('q')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const contactId = searchParams.get('id')

    // Get single contact by ID
    if (contactId) {
      const result = await sql`
        SELECT * FROM wells_vendors
        WHERE user_id = ${userId} AND id = ${contactId}
        LIMIT 1
      `

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Contact not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        contact: mapRowToContact(result.rows[0]),
      })
    }

    // Search with natural language query
    if (query) {
      const result = await WellsVendorRegistry.searchVendors(userId, {
        query,
        vendorType: vendorType || undefined,
        category: category || undefined,
      })

      return NextResponse.json({
        contacts: result.vendors.map(mapVendorToContact),
        summary: result.summary,
        total: result.vendors.length,
      })
    }

    // List all contacts with filters
    let whereClause = `WHERE user_id = $1`
    const params: unknown[] = [userId]

    if (vendorType) {
      whereClause += ` AND (vendor_type = $${params.length + 1} OR vendor_type = 'both')`
      params.push(vendorType)
    }

    if (status) {
      whereClause += ` AND status = $${params.length + 1}`
      params.push(status)
    }

    if (category) {
      whereClause += ` AND $${params.length + 1} = ANY(categories)`
      params.push(category)
    }

    const result = await sql.query(`
      SELECT * FROM wells_vendors
      ${whereClause}
      ORDER BY name ASC
      LIMIT ${limit} OFFSET ${offset}
    `, params)

    const countResult = await sql.query(`
      SELECT COUNT(*) as total FROM wells_vendors ${whereClause}
    `, params)

    return NextResponse.json({
      contacts: result.rows.map(mapRowToContact),
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
    })
  } catch (error) {
    console.error('Contacts GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Add Contact
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId = 'default-user', naturalLanguage, ...contactData } = body

    // Support natural language input
    if (naturalLanguage) {
      const erp = getWellsERP(userId)
      const contact = await erp.addVendor(naturalLanguage)

      return NextResponse.json({
        success: true,
        contact,
        message: `Contact ${contact.name} added successfully`,
      })
    }

    // Structured input
    const { name, vendorType, email, phone, website, paymentTerms, categories, addresses, contacts } = contactData

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    const createRequest: CreateVendorRequest = {
      name,
      vendorType: vendorType || 'supplier',
      email,
      phone,
      website,
      paymentTerms,
      categories,
    }

    const result = await WellsVendorRegistry.addVendor(userId, createRequest)

    // Update with additional data if provided
    if (addresses || contacts) {
      await sql`
        UPDATE wells_vendors
        SET
          addresses = ${JSON.stringify(addresses || [])},
          contacts = ${JSON.stringify(contacts || [])},
          updated_at = NOW()
        WHERE id = ${result.vendor.id}
      `
    }

    return NextResponse.json({
      success: true,
      contact: mapVendorToContact(result.vendor),
      message: result.message,
    })
  } catch (error) {
    console.error('Contacts POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add contact' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT - Update Contact
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId = 'default-user', contactId, action, ...updateData } = body

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      )
    }

    // Handle specific actions
    switch (action) {
      case 'rate':
        const rateResult = await WellsVendorRegistry.rateVendor(
          userId,
          contactId,
          updateData.rating,
          updateData.category || 'overall',
          updateData.comment
        )
        return NextResponse.json({
          success: true,
          contact: mapVendorToContact(rateResult.vendor),
          message: rateResult.message,
        })

      case 'add_note':
        await sql`
          UPDATE wells_vendors
          SET
            notes = COALESCE(notes, '') || E'\n' || ${updateData.note},
            updated_at = NOW()
          WHERE id = ${contactId} AND user_id = ${userId}
        `
        return NextResponse.json({
          success: true,
          message: 'Note added successfully',
        })

      case 'update_status':
        await sql`
          UPDATE wells_vendors
          SET status = ${updateData.status}, updated_at = NOW()
          WHERE id = ${contactId} AND user_id = ${userId}
        `
        return NextResponse.json({
          success: true,
          message: `Contact status updated to ${updateData.status}`,
        })

      default:
        // General update
        const updateFields: string[] = []
        const updateValues: unknown[] = []

        const allowedFields = ['name', 'display_name', 'email', 'phone', 'website', 'notes', 'internal_notes', 'vendor_type', 'status']

        for (const [key, value] of Object.entries(updateData)) {
          const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
          if (allowedFields.includes(dbKey)) {
            updateFields.push(`${dbKey} = $${updateValues.length + 1}`)
            updateValues.push(value)
          }
        }

        // Handle JSON fields
        if (updateData.addresses) {
          updateFields.push(`addresses = $${updateValues.length + 1}`)
          updateValues.push(JSON.stringify(updateData.addresses))
        }
        if (updateData.contacts) {
          updateFields.push(`contacts = $${updateValues.length + 1}`)
          updateValues.push(JSON.stringify(updateData.contacts))
        }
        if (updateData.categories) {
          updateFields.push(`categories = $${updateValues.length + 1}`)
          updateValues.push(updateData.categories)
        }
        if (updateData.paymentTerms) {
          updateFields.push(`payment_terms = $${updateValues.length + 1}`)
          updateValues.push(JSON.stringify(updateData.paymentTerms))
        }

        if (updateFields.length === 0) {
          return NextResponse.json(
            { error: 'No update fields provided' },
            { status: 400 }
          )
        }

        updateFields.push('updated_at = NOW()')

        await sql.query(`
          UPDATE wells_vendors
          SET ${updateFields.join(', ')}
          WHERE id = $${updateValues.length + 1} AND user_id = $${updateValues.length + 2}
        `, [...updateValues, contactId, userId])

        // Fetch updated contact
        const result = await sql`
          SELECT * FROM wells_vendors WHERE id = ${contactId}
        `

        return NextResponse.json({
          success: true,
          contact: mapRowToContact(result.rows[0]),
          message: 'Contact updated successfully',
        })
    }
  } catch (error) {
    console.error('Contacts PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update contact' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Deactivate Contact
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const contactId = searchParams.get('id') || searchParams.get('contactId')
    const userId = searchParams.get('userId') || 'default-user'
    const permanent = searchParams.get('permanent') === 'true'

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      )
    }

    if (permanent) {
      // Check for related invoices/POs before permanent delete
      const relatedInvoices = await sql`
        SELECT COUNT(*) as count FROM wells_invoices
        WHERE vendor_id = ${contactId}
      `
      const relatedPOs = await sql`
        SELECT COUNT(*) as count FROM wells_purchase_orders
        WHERE supplier_id = ${contactId}
      `

      if (parseInt(relatedInvoices.rows[0].count) > 0 || parseInt(relatedPOs.rows[0].count) > 0) {
        return NextResponse.json(
          { error: 'Cannot delete contact with related invoices or purchase orders. Set to inactive instead.' },
          { status: 400 }
        )
      }

      await sql`
        DELETE FROM wells_vendors
        WHERE id = ${contactId} AND user_id = ${userId}
      `

      return NextResponse.json({
        success: true,
        message: 'Contact permanently deleted',
      })
    }

    // Soft delete - set to inactive
    await sql`
      UPDATE wells_vendors
      SET status = 'inactive', updated_at = NOW()
      WHERE id = ${contactId} AND user_id = ${userId}
    `

    return NextResponse.json({
      success: true,
      message: 'Contact deactivated',
    })
  } catch (error) {
    console.error('Contacts DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete contact' },
      { status: 500 }
    )
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapRowToContact(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    type: row.vendor_type,
    status: row.status,
    email: row.email,
    phone: row.phone,
    website: row.website,
    contacts: row.contacts || [],
    addresses: row.addresses || [],
    paymentTerms: row.payment_terms,
    categories: row.categories || [],
    taxId: row.tax_id,
    totalOrders: parseInt(row.total_orders as string) || 0,
    totalSpend: parseFloat(row.total_spend as string) || 0,
    averageOrderValue: parseFloat(row.average_order_value as string) || 0,
    lastOrderDate: row.last_order_date ? new Date(row.last_order_date as string) : null,
    performanceScore: row.performance_score || { overall: 50 },
    ratings: row.ratings || [],
    notes: row.notes,
    internalNotes: row.internal_notes,
    tags: row.tags || [],
    createdByAi: row.created_by_ai,
    wellsSupplierId: row.wells_supplier_id,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

function mapVendorToContact(vendor: Record<string, unknown>) {
  return {
    id: vendor.id,
    name: vendor.name,
    displayName: vendor.displayName,
    type: vendor.vendorType,
    status: vendor.status,
    email: vendor.email,
    phone: vendor.phone,
    website: vendor.website,
    contacts: vendor.contacts || [],
    addresses: vendor.addresses || [],
    paymentTerms: vendor.paymentTerms,
    categories: vendor.categories || [],
    totalOrders: vendor.totalOrders || 0,
    totalSpend: vendor.totalSpend || 0,
    averageOrderValue: vendor.averageOrderValue || 0,
    lastOrderDate: vendor.lastOrderDate,
    performanceScore: vendor.performanceScore || { overall: 50 },
    ratings: vendor.ratings || [],
    notes: vendor.notes,
    internalNotes: vendor.internalNotes,
    tags: vendor.tags || [],
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  }
}
