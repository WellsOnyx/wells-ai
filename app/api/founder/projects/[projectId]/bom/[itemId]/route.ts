/**
 * Founder Project BOM Item Detail API
 * GET: Get BOM item details
 * PATCH: Update BOM item
 * DELETE: Remove BOM item
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sqlQuery as sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

type BOMStatus = 'pending' | 'sourcing' | 'quoted' | 'sourced' | 'ordered' | 'shipped' | 'received' | 'cancelled';

interface ParsedBOMUpdate {
  quantity?: number;
  unitCost?: number;
  status?: BOMStatus;
  supplier?: string;
  notes?: string;
}

function parseUpdateFromText(text: string): ParsedBOMUpdate {
  const result: ParsedBOMUpdate = {};
  const lower = text.toLowerCase();

  // Quantity update
  const qtyMatch = text.match(/(?:qty|quantity)\s*(?:to|:)?\s*(\d+)/i) || text.match(/(\d+)\s*(?:x|pcs|units)/i);
  if (qtyMatch) {
    result.quantity = parseInt(qtyMatch[1]);
  }

  // Price update
  const priceMatch = text.match(/(?:price|cost)\s*(?:to|:)?\s*\$?([\d,]+(?:\.\d{2})?)/i);
  if (priceMatch) {
    result.unitCost = parseFloat(priceMatch[1].replace(/,/g, ''));
  }

  // Status changes
  if (lower.includes('received') || lower.includes('got it') || lower.includes('arrived')) {
    result.status = 'received';
  } else if (lower.includes('shipped') || lower.includes('in transit')) {
    result.status = 'shipped';
  } else if (lower.includes('ordered') || lower.includes('order placed')) {
    result.status = 'ordered';
  } else if (lower.includes('sourced') || lower.includes('found supplier')) {
    result.status = 'sourced';
  } else if (lower.includes('quoted') || lower.includes('got quote')) {
    result.status = 'quoted';
  } else if (lower.includes('cancel')) {
    result.status = 'cancelled';
  }

  // Supplier update
  const supplierMatch = text.match(/(?:supplier|vendor|from)\s*(?:to|:)?\s*["\']?([^"\']+)["\']?/i);
  if (supplierMatch && !['to', 'is', 'was'].includes(supplierMatch[1].toLowerCase().trim())) {
    result.supplier = supplierMatch[1].trim();
  }

  return result;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; itemId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, itemId } = await params;

    // Verify project ownership and get item
    const result = await sql`
      SELECT b.*, p.name as project_name, p.user_id,
             r.id as rfq_id, r.status as rfq_status,
             q.unit_price as quote_price, q.lead_time_days as quote_lead_time,
             s.company_name as supplier_name
      FROM founder_project_bom b
      JOIN founder_projects p ON b.project_id = p.id
      LEFT JOIN rfqs r ON b.rfq_id = r.id
      LEFT JOIN rfq_quotes q ON r.id = q.rfq_id AND q.status = 'accepted'
      LEFT JOIN supplier_profiles s ON q.supplier_id = s.id
      WHERE b.id = ${itemId}
        AND b.project_id = ${projectId}
        AND p.user_id = ${userId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "BOM item not found or you don't have access.",
      }, { status: 404 });
    }

    const row = result.rows[0];
    const item = {
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
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
      supplierName: row.supplier_name,
      supplierPartNumber: row.supplier_part_number,
      rfq: row.rfq_id ? {
        id: row.rfq_id,
        status: row.rfq_status,
        quotePrice: row.quote_price ? parseFloat(row.quote_price) : null,
        quoteLeadTime: row.quote_lead_time,
      } : null,
      leadTimeDays: row.lead_time_days,
      sortOrder: row.sort_order,
      notes: row.notes,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Generate message based on status
    let message = `"${item.name}"`;
    if (item.partNumber) {
      message += ` (${item.partNumber})`;
    }
    message += ` - ${item.status}.`;

    if (item.unitCost) {
      message += ` $${item.unitCost} x ${item.quantity} = $${item.totalCost?.toLocaleString()}.`;
    }

    if (item.rfq) {
      if (item.rfq.quotePrice) {
        message += ` Best quote: $${item.rfq.quotePrice}/unit.`;
      } else {
        message += ` RFQ ${item.rfq.status}.`;
      }
    }

    if (item.status === 'pending') {
      message += ` Ready to source.`;
    }

    return NextResponse.json({
      success: true,
      item,
      message,
    });
  } catch (error: any) {
    console.error('Error fetching BOM item:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch BOM item' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; itemId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, itemId } = await params;
    const body = await req.json();
    const { text, data } = body;

    // Verify ownership and get current item
    const existing = await sql`
      SELECT b.*, p.name as project_name
      FROM founder_project_bom b
      JOIN founder_projects p ON b.project_id = p.id
      WHERE b.id = ${itemId}
        AND b.project_id = ${projectId}
        AND p.user_id = ${userId}
    `;

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "BOM item not found or you don't have access.",
      }, { status: 404 });
    }

    const oldItem = existing.rows[0];

    // Parse updates
    let updates = data || {};
    if (text) {
      const parsed = parseUpdateFromText(text);
      updates = { ...parsed, ...updates };
    }

    // Execute update
    const result = await sql`
      UPDATE founder_project_bom
      SET
        part_number = COALESCE(${updates.partNumber}, part_number),
        name = COALESCE(${updates.name}, name),
        description = COALESCE(${updates.description}, description),
        category = COALESCE(${updates.category}, category),
        quantity = COALESCE(${updates.quantity}, quantity),
        unit = COALESCE(${updates.unit}, unit),
        unit_cost = COALESCE(${updates.unitCost}, unit_cost),
        target_cost = COALESCE(${updates.targetCost}, target_cost),
        status = COALESCE(${updates.status}, status),
        supplier = COALESCE(${updates.supplier}, supplier),
        supplier_part_number = COALESCE(${updates.supplierPartNumber}, supplier_part_number),
        lead_time_days = COALESCE(${updates.leadTimeDays}, lead_time_days),
        notes = COALESCE(${updates.notes}, notes),
        metadata = COALESCE(${updates.metadata ? JSON.stringify(updates.metadata) : null}::jsonb, metadata),
        updated_at = NOW()
      WHERE id = ${itemId}
      RETURNING *
    `;

    const item = result.rows[0];

    // Track changes for activity log
    const changes: string[] = [];
    if (updates.status && updates.status !== oldItem.status) {
      changes.push(`status: ${oldItem.status} -> ${updates.status}`);
    }
    if (updates.quantity && updates.quantity !== oldItem.quantity) {
      changes.push(`qty: ${oldItem.quantity} -> ${updates.quantity}`);
    }
    if (updates.unitCost && updates.unitCost !== parseFloat(oldItem.unit_cost || '0')) {
      changes.push(`cost: $${oldItem.unit_cost || 0} -> $${updates.unitCost}`);
    }
    if (updates.supplier && updates.supplier !== oldItem.supplier) {
      changes.push(`supplier: ${updates.supplier}`);
    }

    // Log activity
    if (changes.length > 0) {
      await sql`
        INSERT INTO founder_project_activity (project_id, type, description, metadata, created_at)
        VALUES (
          ${projectId},
          'bom_update',
          ${`Updated "${item.name}": ${changes.join(', ')}`},
          ${JSON.stringify({ itemId, changes })}::jsonb,
          NOW()
        )
      `;
    }

    // Generate message
    let message: string;
    if (updates.status === 'received') {
      message = `Got it! "${item.name}" marked as received. One less thing to track.`;
    } else if (updates.status === 'ordered') {
      message = `"${item.name}" marked as ordered. I'll help you track delivery.`;
    } else if (updates.status === 'sourced') {
      message = `Found a supplier for "${item.name}". Ready to order when you are.`;
    } else if (changes.length > 0) {
      message = `Updated "${item.name}": ${changes.join(', ')}.`;
    } else {
      message = `"${item.name}" updated.`;
    }

    return NextResponse.json({
      success: true,
      item: {
        id: item.id,
        partNumber: item.part_number,
        name: item.name,
        quantity: item.quantity,
        unitCost: item.unit_cost ? parseFloat(item.unit_cost) : null,
        status: item.status,
        supplier: item.supplier,
        updatedAt: item.updated_at,
      },
      changes,
      message,
    });
  } catch (error: any) {
    console.error('Error updating BOM item:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update BOM item' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; itemId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, itemId } = await params;

    // Verify ownership and get item info
    const existing = await sql`
      SELECT b.*, p.name as project_name
      FROM founder_project_bom b
      JOIN founder_projects p ON b.project_id = p.id
      WHERE b.id = ${itemId}
        AND b.project_id = ${projectId}
        AND p.user_id = ${userId}
    `;

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "BOM item not found or you don't have access.",
      }, { status: 404 });
    }

    const item = existing.rows[0];

    // Check if item has associated RFQ
    if (item.rfq_id) {
      return NextResponse.json({
        success: false,
        message: `"${item.name}" has an active RFQ. Cancel the RFQ first or set the item status to cancelled.`,
        rfqId: item.rfq_id,
      });
    }

    // Delete the item
    await sql`DELETE FROM founder_project_bom WHERE id = ${itemId}`;

    // Log activity
    await sql`
      INSERT INTO founder_project_activity (project_id, type, description, metadata, created_at)
      VALUES (
        ${projectId},
        'bom_delete',
        ${`Removed "${item.name}" from BOM`},
        ${JSON.stringify({ itemId, itemName: item.name })}::jsonb,
        NOW()
      )
    `;

    return NextResponse.json({
      success: true,
      message: `Removed "${item.name}" from the BOM.`,
      removedItem: {
        id: item.id,
        name: item.name,
        partNumber: item.part_number,
      },
    });
  } catch (error: any) {
    console.error('Error deleting BOM item:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete BOM item' },
      { status: 500 }
    );
  }
}
