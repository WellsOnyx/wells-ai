/**
 * Founder Project BOM (Bill of Materials) API
 * GET: List BOM items
 * POST: Add BOM item(s) - supports bulk add
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sqlQuery as sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

type BOMStatus = 'pending' | 'sourcing' | 'quoted' | 'sourced' | 'ordered' | 'shipped' | 'received' | 'cancelled';

interface ParsedBOMItem {
  partNumber?: string;
  name?: string;
  description?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  targetCost?: number;
  supplier?: string;
  notes?: string;
}

function parseBOMFromText(text: string): ParsedBOMItem[] {
  const items: ParsedBOMItem[] = [];
  const lines = text.split(/[;\n]/).filter(l => l.trim());

  for (const line of lines) {
    const item: ParsedBOMItem = {};
    const lower = line.toLowerCase();

    // Extract quantity
    const qtyMatch = line.match(/(\d+)\s*(?:x|pcs?|units?|ea)/i) || line.match(/qty:?\s*(\d+)/i);
    if (qtyMatch) {
      item.quantity = parseInt(qtyMatch[1]);
    }

    // Extract price/cost
    const priceMatch = line.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:each|per|\/)?/i);
    if (priceMatch) {
      item.unitCost = parseFloat(priceMatch[1].replace(/,/g, ''));
    }

    // Extract part number (common formats)
    const partMatch = line.match(/(?:part|p\/n|pn|sku)[#:\s]*([A-Z0-9-]+)/i);
    if (partMatch) {
      item.partNumber = partMatch[1];
    }

    // Category hints
    const categories = ['mechanical', 'electrical', 'electronic', 'fastener', 'hardware', 'pcb', 'enclosure', 'cable', 'sensor', 'motor', 'battery', 'display'];
    for (const cat of categories) {
      if (lower.includes(cat)) {
        item.category = cat;
        break;
      }
    }

    // Clean text for name
    let cleanText = line
      .replace(/\d+\s*(?:x|pcs?|units?|ea)/gi, '')
      .replace(/qty:?\s*\d+/gi, '')
      .replace(/\$[\d,]+(?:\.\d{2})?/g, '')
      .replace(/(?:part|p\/n|pn|sku)[#:\s]*[A-Z0-9-]+/gi, '')
      .trim();

    if (cleanText.length > 0 && cleanText.length < 200) {
      item.name = cleanText.slice(0, 100);
    }

    if (item.name || item.partNumber) {
      items.push(item);
    }
  }

  return items;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') as BOMStatus | null;
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    // Verify project ownership
    const projectCheck = await sql`
      SELECT id FROM founder_projects WHERE id = ${projectId} AND user_id = ${userId}
    `;

    if (projectCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Project not found or you don't have access.",
      }, { status: 404 });
    }

    // Build query
    let result;
    if (status && category) {
      result = await sql`
        SELECT b.*, r.id as rfq_id, r.status as rfq_status
        FROM founder_project_bom b
        LEFT JOIN rfqs r ON b.rfq_id = r.id
        WHERE b.project_id = ${projectId}
          AND b.status = ${status}
          AND b.category = ${category}
        ORDER BY b.sort_order ASC, b.created_at DESC
      `;
    } else if (status) {
      result = await sql`
        SELECT b.*, r.id as rfq_id, r.status as rfq_status
        FROM founder_project_bom b
        LEFT JOIN rfqs r ON b.rfq_id = r.id
        WHERE b.project_id = ${projectId} AND b.status = ${status}
        ORDER BY b.sort_order ASC, b.created_at DESC
      `;
    } else if (category) {
      result = await sql`
        SELECT b.*, r.id as rfq_id, r.status as rfq_status
        FROM founder_project_bom b
        LEFT JOIN rfqs r ON b.rfq_id = r.id
        WHERE b.project_id = ${projectId} AND b.category = ${category}
        ORDER BY b.sort_order ASC, b.created_at DESC
      `;
    } else if (search) {
      result = await sql`
        SELECT b.*, r.id as rfq_id, r.status as rfq_status
        FROM founder_project_bom b
        LEFT JOIN rfqs r ON b.rfq_id = r.id
        WHERE b.project_id = ${projectId}
          AND (b.name ILIKE ${'%' + search + '%'}
               OR b.part_number ILIKE ${'%' + search + '%'}
               OR b.description ILIKE ${'%' + search + '%'})
        ORDER BY b.sort_order ASC, b.created_at DESC
      `;
    } else {
      result = await sql`
        SELECT b.*, r.id as rfq_id, r.status as rfq_status
        FROM founder_project_bom b
        LEFT JOIN rfqs r ON b.rfq_id = r.id
        WHERE b.project_id = ${projectId}
        ORDER BY b.sort_order ASC, b.created_at DESC
      `;
    }

    const items = result.rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      partNumber: row.part_number,
      name: row.name,
      description: row.description,
      category: row.category,
      quantity: row.quantity,
      unit: row.unit,
      unitCost: row.unit_cost ? parseFloat(row.unit_cost) : null,
      targetCost: row.target_cost ? parseFloat(row.target_cost) : null,
      totalCost: row.unit_cost && row.quantity
        ? parseFloat(row.unit_cost) * row.quantity
        : null,
      status: row.status,
      supplier: row.supplier,
      supplierPartNumber: row.supplier_part_number,
      rfqId: row.rfq_id,
      rfqStatus: row.rfq_status,
      leadTimeDays: row.lead_time_days,
      sortOrder: row.sort_order,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // Calculate summary
    const summary = {
      totalItems: items.length,
      totalCost: items.reduce((sum, item) => sum + (item.totalCost || 0), 0),
      byStatus: items.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byCategory: items.reduce((acc, item) => {
        if (item.category) {
          acc[item.category] = (acc[item.category] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
    };

    // Generate message
    let message: string;
    if (items.length === 0) {
      message = "No BOM items yet. Add parts by describing them or paste a parts list.";
    } else {
      const pendingCount = summary.byStatus['pending'] || 0;
      const sourcedCount = summary.byStatus['sourced'] || 0;
      const receivedCount = summary.byStatus['received'] || 0;

      message = `${items.length} BOM items totaling $${summary.totalCost.toLocaleString()}.`;
      if (pendingCount > 0) {
        message += ` ${pendingCount} need sourcing.`;
      }
      if (sourcedCount > 0) {
        message += ` ${sourcedCount} sourced.`;
      }
      if (receivedCount > 0) {
        message += ` ${receivedCount} received.`;
      }
    }

    return NextResponse.json({
      success: true,
      items,
      summary,
      message,
    });
  } catch (error: any) {
    console.error('Error fetching BOM:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch BOM' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const body = await req.json();
    const { action, text, data, items: bulkItems } = body;

    // Verify project ownership
    const projectCheck = await sql`
      SELECT id, name FROM founder_projects WHERE id = ${projectId} AND user_id = ${userId}
    `;

    if (projectCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Project not found or you don't have access.",
      }, { status: 404 });
    }

    const project = projectCheck.rows[0];

    // Parse items from text or use provided data
    let itemsToAdd: ParsedBOMItem[] = [];

    if (text) {
      itemsToAdd = parseBOMFromText(text);
    }

    if (bulkItems && Array.isArray(bulkItems)) {
      itemsToAdd = [...itemsToAdd, ...bulkItems];
    }

    if (data && !bulkItems) {
      itemsToAdd.push(data);
    }

    if (itemsToAdd.length === 0) {
      return NextResponse.json({
        success: false,
        message: "I need some items to add. Tell me what parts you need or paste a list.",
        hint: "Example: '10x M3 screws $0.05 each; Arduino Nano $12; Custom PCB qty 5 $25 each'",
      });
    }

    // Get current max sort order
    const sortResult = await sql`
      SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM founder_project_bom WHERE project_id = ${projectId}
    `;
    let sortOrder = parseInt(sortResult.rows[0].max_sort) + 1;

    // Insert items
    const createdItems = [];
    for (const item of itemsToAdd) {
      if (!item.name && !item.partNumber) continue;

      const result = await sql`
        INSERT INTO founder_project_bom (
          project_id,
          part_number,
          name,
          description,
          category,
          quantity,
          unit,
          unit_cost,
          target_cost,
          status,
          supplier,
          notes,
          sort_order,
          created_at,
          updated_at
        ) VALUES (
          ${projectId},
          ${item.partNumber || null},
          ${item.name || item.partNumber || 'Unnamed Item'},
          ${item.description || null},
          ${item.category || null},
          ${item.quantity || 1},
          ${item.unit || 'pcs'},
          ${item.unitCost || null},
          ${item.targetCost || null},
          'pending',
          ${item.supplier || null},
          ${item.notes || null},
          ${sortOrder++},
          NOW(),
          NOW()
        )
        RETURNING *
      `;

      createdItems.push({
        id: result.rows[0].id,
        partNumber: result.rows[0].part_number,
        name: result.rows[0].name,
        quantity: result.rows[0].quantity,
        unitCost: result.rows[0].unit_cost ? parseFloat(result.rows[0].unit_cost) : null,
        status: result.rows[0].status,
      });
    }

    // Log activity
    await sql`
      INSERT INTO founder_project_activity (project_id, type, description, metadata, created_at)
      VALUES (
        ${projectId},
        'bom_add',
        ${`Added ${createdItems.length} BOM item(s)`},
        ${JSON.stringify({ items: createdItems.map(i => i.name) })}::jsonb,
        NOW()
      )
    `;

    // Calculate total cost of added items
    const addedCost = createdItems.reduce((sum, item) => {
      return sum + (item.unitCost ? item.unitCost * (itemsToAdd.find(i => i.name === item.name)?.quantity || 1) : 0);
    }, 0);

    let message: string;
    if (createdItems.length === 1) {
      const item = createdItems[0];
      message = `Added "${item.name}" to the BOM.`;
      if (item.unitCost) {
        message += ` ($${item.unitCost.toLocaleString()} x ${item.quantity || 1})`;
      }
      message += ` Ready to source when you are.`;
    } else {
      message = `Added ${createdItems.length} items to the BOM for "${project.name}".`;
      if (addedCost > 0) {
        message += ` Total: $${addedCost.toLocaleString()}.`;
      }
      message += ` Want me to find suppliers?`;
    }

    return NextResponse.json({
      success: true,
      items: createdItems,
      count: createdItems.length,
      totalCost: addedCost,
      message,
    });
  } catch (error: any) {
    console.error('Error adding BOM items:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add BOM items' },
      { status: 500 }
    );
  }
}
