// @ts-nocheck
/**
 * Supplier Network API
 *
 * Manage the supplier network that actually fulfills orders:
 * - Add/update suppliers
 * - Manage catalog items
 * - Track performance
 * - View margin analysis
 *
 * THE SECRET SAUCE: Our negotiated pricing vs customer pricing = margin
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// GET: List suppliers or get supplier details
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const supplierId = searchParams.get('id')
    const category = searchParams.get('category')
    const includePerformance = searchParams.get('performance') === 'true'

    if (supplierId) {
      // Get single supplier with details
      const supplierResult = await sql`
        SELECT * FROM supplier_network WHERE id = ${supplierId}
      `

      if (supplierResult.rows.length === 0) {
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
      }

      const supplier = supplierResult.rows[0]

      // Get catalog count
      const catalogResult = await sql`
        SELECT COUNT(*) as item_count, AVG(margin_pct) as avg_margin
        FROM supplier_catalog
        WHERE supplier_id = ${supplierId} AND is_active = TRUE
      `

      // Get recent performance
      const performanceResult = await sql`
        SELECT
          COUNT(DISTINCT iol.order_id) as orders_fulfilled,
          SUM(iol.supplier_line_total) as total_revenue,
          SUM(iol.line_margin) as total_margin_generated,
          AVG(iol.line_margin_pct) as avg_margin_pct
        FROM intercept_order_lines iol
        WHERE iol.supplier_id = ${supplierId}
        AND iol.status = 'shipped'
      `

      return NextResponse.json({
        supplier,
        catalog: catalogResult.rows[0],
        performance: performanceResult.rows[0]
      })
    }

    // List suppliers
    let query
    if (category) {
      query = sql`
        SELECT
          sn.*,
          (SELECT COUNT(*) FROM supplier_catalog WHERE supplier_id = sn.id AND is_active = TRUE) as catalog_items,
          (SELECT SUM(line_margin) FROM intercept_order_lines WHERE supplier_id = sn.id) as total_margin
        FROM supplier_network sn
        WHERE ${category} = ANY(sn.categories)
        AND sn.status = 'active'
        ORDER BY sn.company_name
      `
    } else {
      query = sql`
        SELECT
          sn.*,
          (SELECT COUNT(*) FROM supplier_catalog WHERE supplier_id = sn.id AND is_active = TRUE) as catalog_items,
          (SELECT SUM(line_margin) FROM intercept_order_lines WHERE supplier_id = sn.id) as total_margin
        FROM supplier_network sn
        WHERE sn.status = 'active'
        ORDER BY sn.company_name
      `
    }

    const result = await query

    // Get network summary
    const summaryResult = await sql`
      SELECT
        COUNT(*) as total_suppliers,
        COUNT(DISTINCT UNNEST(categories)) as total_categories,
        (SELECT COUNT(*) FROM supplier_catalog WHERE is_active = TRUE) as total_catalog_items
      FROM supplier_network
      WHERE status = 'active'
    `

    return NextResponse.json({
      suppliers: result.rows,
      summary: {
        totalSuppliers: result.rows.length,
        totalCatalogItems: summaryResult.rows[0]?.total_catalog_items || 0
      }
    })
  } catch (error) {
    console.error('Supplier list error:', error)
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
  }
}

// POST: Add supplier or catalog items
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'create_supplier':
        return await createSupplier(body)
      case 'add_catalog':
        return await addCatalogItems(body)
      case 'update_pricing':
        return await updatePricing(body)
      case 'search_catalog':
        return await searchCatalog(body)
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Supplier action error:', error)
    return NextResponse.json({ error: 'Supplier action failed' }, { status: 500 })
  }
}

// Create new supplier
async function createSupplier(body: any) {
  const {
    supplierCode, companyName, categories, ordersEmail,
    discountPct, paymentTerms, integrationTypeType, dropShipCapable
  } = body

  const result = await sql`
    INSERT INTO supplier_network (
      supplier_code, company_name, categories,
      orders_email, discount_pct, payment_terms,
      integration_type, drop_ship_capable, status
    ) VALUES (
      ${supplierCode}, ${companyName}, ${categories || ['general']},
      ${ordersEmail}, ${discountPct || 0}, ${paymentTerms || 'NET30'},
      ${integrationTypeType || 'email'}, ${dropShipCapable !== false}, 'active'
    )
    RETURNING *
  `

  return NextResponse.json({
    success: true,
    supplier: result.rows[0],
    message: `Supplier ${companyName} added to network`
  })
}

// Add catalog items
async function addCatalogItems(body: any) {
  const { supplierId, items } = body

  if (!supplierId || !items || !Array.isArray(items)) {
    return NextResponse.json({ error: 'Missing supplierId or items' }, { status: 400 })
  }

  let added = 0
  let errors: any[] = []

  for (const item of items) {
    try {
      // Calculate margin if we have both prices
      const marginPct = item.listPrice && item.ourCost
        ? ((item.listPrice - item.ourCost) / item.listPrice) * 100
        : null

      await sql`
        INSERT INTO supplier_catalog (
          supplier_id, supplier_sku, manufacturer_sku, upc,
          name, description, category, brand, manufacturer,
          list_price, our_cost, suggested_sell, margin_pct,
          uom, in_stock, lead_time_days
        ) VALUES (
          ${supplierId}, ${item.sku}, ${item.manufacturerSku || null}, ${item.upc || null},
          ${item.name}, ${item.description || null}, ${item.category || null},
          ${item.brand || null}, ${item.manufacturer || null},
          ${item.listPrice || null}, ${item.ourCost}, ${item.suggestedSell || item.listPrice},
          ${marginPct}, ${item.uom || 'EA'}, ${item.inStock !== false}, ${item.leadTime || 3}
        )
        ON CONFLICT (supplier_id, supplier_sku) DO UPDATE SET
          name = EXCLUDED.name,
          our_cost = EXCLUDED.our_cost,
          list_price = EXCLUDED.list_price,
          margin_pct = EXCLUDED.margin_pct,
          updated_at = NOW()
      `
      added++
    } catch (err: any) {
      errors.push({ sku: item.sku, error: err.message })
    }
  }

  return NextResponse.json({
    success: true,
    added,
    errors: errors.length > 0 ? errors : undefined,
    message: `Added ${added} items to catalog`
  })
}

// Update pricing for catalog items
async function updatePricing(body: any) {
  const { supplierId, updates } = body

  let updated = 0

  for (const update of updates) {
    const result = await sql`
      UPDATE supplier_catalog SET
        our_cost = COALESCE(${update.ourCost}, our_cost),
        list_price = COALESCE(${update.listPrice}, list_price),
        suggested_sell = COALESCE(${update.suggestedSell}, suggested_sell),
        margin_pct = CASE
          WHEN ${update.listPrice}::DECIMAL IS NOT NULL AND ${update.ourCost}::DECIMAL IS NOT NULL
          THEN ((${update.listPrice}::DECIMAL - ${update.ourCost}::DECIMAL) / ${update.listPrice}::DECIMAL) * 100
          ELSE margin_pct
        END,
        updated_at = NOW()
      WHERE supplier_id = ${supplierId} AND supplier_sku = ${update.sku}
    `
    if (result.rowCount > 0) updated++
  }

  return NextResponse.json({
    success: true,
    updated,
    message: `Updated pricing for ${updated} items`
  })
}

// Search catalog across suppliers
async function searchCatalog(body: any) {
  const { query, category, limit = 50 } = body

  const result = await sql`
    SELECT
      sc.*, sn.company_name as supplier_name, sn.supplier_code,
      sn.discount_pct as supplier_discount, sn.avg_ship_days
    FROM supplier_catalog sc
    JOIN supplier_network sn ON sc.supplier_id = sn.id
    WHERE sc.is_active = TRUE
    AND sn.status = 'active'
    AND (
      sc.name ILIKE ${'%' + query + '%'}
      OR sc.supplier_sku ILIKE ${'%' + query + '%'}
      OR sc.manufacturer_sku ILIKE ${'%' + query + '%'}
      OR sc.brand ILIKE ${'%' + query + '%'}
    )
    ORDER BY sc.margin_pct DESC NULLS LAST
    LIMIT ${limit}
  `

  return NextResponse.json({
    results: result.rows,
    count: result.rows.length
  })
}

// PUT: Update supplier
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { supplierId, ...updates } = body

    if (!supplierId) {
      return NextResponse.json({ error: 'Missing supplierId' }, { status: 400 })
    }

    // Build dynamic update
    const setClauses: string[] = []
    const values: any[] = []

    if (updates.companyName) {
      setClauses.push(`company_name = $${values.length + 1}`)
      values.push(updates.companyName)
    }
    if (updates.discountPct !== undefined) {
      setClauses.push(`discount_pct = $${values.length + 1}`)
      values.push(updates.discountPct)
    }
    if (updates.status) {
      setClauses.push(`status = $${values.length + 1}`)
      values.push(updates.status)
    }
    if (updates.ordersEmail) {
      setClauses.push(`orders_email = $${values.length + 1}`)
      values.push(updates.ordersEmail)
    }

    setClauses.push('updated_at = NOW()')

    await sql`
      UPDATE supplier_network SET
        company_name = COALESCE(${updates.companyName}, company_name),
        discount_pct = COALESCE(${updates.discountPct}, discount_pct),
        status = COALESCE(${updates.status}, status),
        orders_email = COALESCE(${updates.ordersEmail}, orders_email),
        updated_at = NOW()
      WHERE id = ${supplierId}
    `

    return NextResponse.json({
      success: true,
      message: 'Supplier updated'
    })
  } catch (error) {
    console.error('Supplier update error:', error)
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 })
  }
}
