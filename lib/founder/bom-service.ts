/**
 * Bill of Materials (BOM) Service
 * Manages materials/supplies needed for projects with RFQ integration
 */

import { sqlQuery as sql } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import { matchSuppliersToRequest, getSupplierById } from '@/lib/suppliers/db';
import { createQuote } from '@/lib/rfq/quote-service';

const anthropic = new Anthropic();

// ============================================================================
// TYPES
// ============================================================================

export type BOMStatus =
  | 'needed'
  | 'rfq_sent'
  | 'quoted'
  | 'ordered'
  | 'shipped'
  | 'received'
  | 'cancelled';

export type BOMPriority = 'low' | 'medium' | 'high' | 'critical';

export interface BOMItem {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  category?: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number;
  actualPrice?: number;
  priority: BOMPriority;
  requiredByDate?: Date;
  leadTimeDays?: number;
  status: BOMStatus;

  // Supplier linkage
  supplierId?: string;
  supplierName?: string;
  rfqId?: string;
  quoteId?: string;

  // Fulfillment tracking
  actualQuantity?: number;
  receivedAt?: Date;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBOMItemInput {
  name: string;
  description?: string;
  category?: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number;
  priority?: BOMPriority;
  requiredByDate?: string;
  leadTimeDays?: number;
}

export interface BOMSummary {
  projectId: string;
  totalItems: number;
  totalEstimate: number;
  totalActual: number;
  byStatus: Record<BOMStatus, number>;
  byPriority: Record<BOMPriority, number>;
  itemsNeedingAction: number;
  overBudget: boolean;
  budgetVariance: number;
}

export interface ParsedBOMItem {
  name: string;
  quantity: number;
  unit: string;
  description?: string;
  category?: string;
  estimatedPrice?: number;
}

// ============================================================================
// BOM CRUD OPERATIONS
// ============================================================================

/**
 * Add a material/supply item to a project's BOM
 */
export async function addBOMItem(
  projectId: string,
  item: CreateBOMItemInput
): Promise<{ item: BOMItem; message: string }> {
  const result = await sql`
    INSERT INTO bom_items (
      project_id,
      name,
      description,
      category,
      quantity,
      unit,
      estimated_price,
      priority,
      required_by_date,
      lead_time_days,
      status
    ) VALUES (
      ${projectId},
      ${item.name},
      ${item.description || null},
      ${item.category || null},
      ${item.quantity},
      ${item.unit},
      ${item.estimatedPrice || null},
      ${item.priority || 'medium'},
      ${item.requiredByDate ? new Date(item.requiredByDate) : null},
      ${item.leadTimeDays || null},
      'needed'
    )
    RETURNING *
  `;

  const bomItem = mapRowToBOMItem(result.rows[0]);

  return {
    item: bomItem,
    message: `Added "${item.name}" to your BOM. ${item.quantity} ${item.unit} at ${
      item.estimatedPrice ? `$${item.estimatedPrice.toLocaleString()} estimated` : 'price TBD'
    }. Ready to source when you are.`,
  };
}

/**
 * Get all BOM items for a project with optional filters
 */
export async function getBOMItems(
  projectId: string,
  filters?: { status?: BOMStatus; category?: string; priority?: BOMPriority }
): Promise<BOMItem[]> {
  let query;

  if (filters?.status && filters?.category) {
    query = sql`
      SELECT * FROM bom_items
      WHERE project_id = ${projectId}
        AND status = ${filters.status}
        AND category = ${filters.category}
      ORDER BY priority DESC, required_by_date ASC NULLS LAST, created_at ASC
    `;
  } else if (filters?.status) {
    query = sql`
      SELECT * FROM bom_items
      WHERE project_id = ${projectId}
        AND status = ${filters.status}
      ORDER BY priority DESC, required_by_date ASC NULLS LAST, created_at ASC
    `;
  } else if (filters?.category) {
    query = sql`
      SELECT * FROM bom_items
      WHERE project_id = ${projectId}
        AND category = ${filters.category}
      ORDER BY priority DESC, required_by_date ASC NULLS LAST, created_at ASC
    `;
  } else if (filters?.priority) {
    query = sql`
      SELECT * FROM bom_items
      WHERE project_id = ${projectId}
        AND priority = ${filters.priority}
      ORDER BY required_by_date ASC NULLS LAST, created_at ASC
    `;
  } else {
    query = sql`
      SELECT * FROM bom_items
      WHERE project_id = ${projectId}
      ORDER BY priority DESC, required_by_date ASC NULLS LAST, created_at ASC
    `;
  }

  const result = await query;
  return result.rows.map(mapRowToBOMItem);
}

/**
 * Update a BOM item's details
 */
export async function updateBOMItem(
  itemId: string,
  updates: Partial<CreateBOMItemInput>
): Promise<{ item: BOMItem; message: string }> {
  const result = await sql`
    UPDATE bom_items
    SET
      name = COALESCE(${updates.name}, name),
      description = COALESCE(${updates.description}, description),
      category = COALESCE(${updates.category}, category),
      quantity = COALESCE(${updates.quantity}, quantity),
      unit = COALESCE(${updates.unit}, unit),
      estimated_price = COALESCE(${updates.estimatedPrice}, estimated_price),
      priority = COALESCE(${updates.priority}, priority),
      required_by_date = COALESCE(${updates.requiredByDate ? new Date(updates.requiredByDate) : null}, required_by_date),
      lead_time_days = COALESCE(${updates.leadTimeDays}, lead_time_days),
      updated_at = NOW()
    WHERE id = ${itemId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error('BOM item not found');
  }

  const item = mapRowToBOMItem(result.rows[0]);

  const changes: string[] = [];
  if (updates.name) changes.push(`name to "${updates.name}"`);
  if (updates.quantity) changes.push(`quantity to ${updates.quantity}`);
  if (updates.estimatedPrice) changes.push(`price to $${updates.estimatedPrice}`);
  if (updates.priority) changes.push(`priority to ${updates.priority}`);

  return {
    item,
    message: changes.length > 0
      ? `Updated ${item.name}: changed ${changes.join(', ')}.`
      : `No changes made to ${item.name}.`,
  };
}

/**
 * Remove an item from the BOM
 */
export async function deleteBOMItem(itemId: string): Promise<{ message: string }> {
  const result = await sql`
    DELETE FROM bom_items
    WHERE id = ${itemId}
    RETURNING name
  `;

  if (result.rows.length === 0) {
    throw new Error('BOM item not found');
  }

  return {
    message: `Removed "${result.rows[0].name}" from your BOM.`,
  };
}

/**
 * Get summary statistics for a project's BOM
 */
export async function getBOMSummary(projectId: string): Promise<BOMSummary> {
  const result = await sql`
    SELECT
      COUNT(*) as total_items,
      SUM(COALESCE(estimated_price, 0) * quantity) as total_estimate,
      SUM(COALESCE(actual_price, 0) * COALESCE(actual_quantity, quantity)) as total_actual,
      COUNT(*) FILTER (WHERE status = 'needed') as needed_count,
      COUNT(*) FILTER (WHERE status = 'rfq_sent') as rfq_sent_count,
      COUNT(*) FILTER (WHERE status = 'quoted') as quoted_count,
      COUNT(*) FILTER (WHERE status = 'ordered') as ordered_count,
      COUNT(*) FILTER (WHERE status = 'shipped') as shipped_count,
      COUNT(*) FILTER (WHERE status = 'received') as received_count,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
      COUNT(*) FILTER (WHERE priority = 'low') as low_priority,
      COUNT(*) FILTER (WHERE priority = 'medium') as medium_priority,
      COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
      COUNT(*) FILTER (WHERE priority = 'critical') as critical_priority,
      COUNT(*) FILTER (WHERE status = 'needed' OR status = 'rfq_sent') as needs_action
    FROM bom_items
    WHERE project_id = ${projectId}
  `;

  const row = result.rows[0];
  const totalEstimate = parseFloat(row.total_estimate || '0');
  const totalActual = parseFloat(row.total_actual || '0');

  return {
    projectId,
    totalItems: parseInt(row.total_items),
    totalEstimate,
    totalActual,
    byStatus: {
      needed: parseInt(row.needed_count),
      rfq_sent: parseInt(row.rfq_sent_count),
      quoted: parseInt(row.quoted_count),
      ordered: parseInt(row.ordered_count),
      shipped: parseInt(row.shipped_count),
      received: parseInt(row.received_count),
      cancelled: parseInt(row.cancelled_count),
    },
    byPriority: {
      low: parseInt(row.low_priority),
      medium: parseInt(row.medium_priority),
      high: parseInt(row.high_priority),
      critical: parseInt(row.critical_priority),
    },
    itemsNeedingAction: parseInt(row.needs_action),
    overBudget: totalActual > totalEstimate && totalActual > 0,
    budgetVariance: totalActual - totalEstimate,
  };
}

// ============================================================================
// RFQ INTEGRATION
// ============================================================================

/**
 * Create an RFQ for a BOM item
 */
export async function createRFQFromBOM(
  itemId: string
): Promise<{ rfqId: string; message: string }> {
  // Get the BOM item
  const itemResult = await sql`
    SELECT * FROM bom_items WHERE id = ${itemId}
  `;

  if (itemResult.rows.length === 0) {
    throw new Error('BOM item not found');
  }

  const item = mapRowToBOMItem(itemResult.rows[0]);

  // Create the RFQ
  const rfqResult = await sql`
    INSERT INTO rfqs (
      category,
      description,
      quantity,
      target_price,
      urgency,
      delivery_location,
      status,
      bom_item_id
    ) VALUES (
      ${item.category || 'General'},
      ${item.description || item.name},
      ${item.quantity},
      ${item.estimatedPrice || null},
      ${item.priority === 'critical' ? 'critical' : item.priority === 'high' ? 'urgent' : 'standard'},
      'TBD',
      'open',
      ${itemId}
    )
    RETURNING id
  `;

  const rfqId = rfqResult.rows[0].id;

  // Update BOM item status
  await sql`
    UPDATE bom_items
    SET
      rfq_id = ${rfqId},
      status = 'rfq_sent',
      updated_at = NOW()
    WHERE id = ${itemId}
  `;

  return {
    rfqId,
    message: `Created RFQ for "${item.name}". I'll start matching suppliers and getting quotes for you.`,
  };
}

/**
 * Create RFQs for multiple BOM items at once
 */
export async function createBulkRFQ(
  projectId: string,
  itemIds: string[]
): Promise<{ rfqIds: string[]; message: string }> {
  const rfqIds: string[] = [];
  const itemNames: string[] = [];

  for (const itemId of itemIds) {
    try {
      const result = await createRFQFromBOM(itemId);
      rfqIds.push(result.rfqId);

      // Get the item name for the message
      const itemResult = await sql`SELECT name FROM bom_items WHERE id = ${itemId}`;
      if (itemResult.rows.length > 0) {
        itemNames.push(itemResult.rows[0].name);
      }
    } catch (error) {
      console.error(`Failed to create RFQ for item ${itemId}:`, error);
    }
  }

  return {
    rfqIds,
    message:
      rfqIds.length === itemIds.length
        ? `Created ${rfqIds.length} RFQs for: ${itemNames.join(', ')}. Starting supplier matching now.`
        : `Created ${rfqIds.length} of ${itemIds.length} RFQs. Some items couldn't be processed.`,
  };
}

/**
 * Link an awarded supplier to a BOM item
 */
export async function linkSupplierToBOM(
  itemId: string,
  supplierId: string,
  rfqId: string
): Promise<{ message: string }> {
  // Get supplier name
  const supplier = await getSupplierById(supplierId);
  const supplierName = supplier?.companyName || 'Unknown Supplier';

  await sql`
    UPDATE bom_items
    SET
      supplier_id = ${supplierId},
      supplier_name = ${supplierName},
      rfq_id = ${rfqId},
      status = 'quoted',
      updated_at = NOW()
    WHERE id = ${itemId}
  `;

  const itemResult = await sql`SELECT name FROM bom_items WHERE id = ${itemId}`;
  const itemName = itemResult.rows[0]?.name || 'Item';

  return {
    message: `Linked ${supplierName} as the supplier for "${itemName}". Ready to place order when you are.`,
  };
}

/**
 * Update BOM item with actual pricing from an RFQ quote
 */
export async function updateBOMFromRFQ(
  itemId: string,
  rfqData: {
    actualPrice: number;
    supplierId?: string;
    supplierName?: string;
    quoteId?: string;
    leadTimeDays?: number;
  }
): Promise<{ item: BOMItem; message: string }> {
  const result = await sql`
    UPDATE bom_items
    SET
      actual_price = ${rfqData.actualPrice},
      supplier_id = COALESCE(${rfqData.supplierId}, supplier_id),
      supplier_name = COALESCE(${rfqData.supplierName}, supplier_name),
      quote_id = COALESCE(${rfqData.quoteId}, quote_id),
      lead_time_days = COALESCE(${rfqData.leadTimeDays}, lead_time_days),
      status = 'quoted',
      updated_at = NOW()
    WHERE id = ${itemId}
    RETURNING *
  `;

  const item = mapRowToBOMItem(result.rows[0]);
  const variance =
    item.estimatedPrice && item.actualPrice
      ? item.actualPrice - item.estimatedPrice
      : null;

  let varianceMsg = '';
  if (variance !== null) {
    if (variance > 0) {
      varianceMsg = ` That's $${variance.toFixed(2)} over your estimate.`;
    } else if (variance < 0) {
      varianceMsg = ` Nice - that's $${Math.abs(variance).toFixed(2)} under your estimate.`;
    } else {
      varianceMsg = ' Right on target with your estimate.';
    }
  }

  return {
    item,
    message: `Updated "${item.name}" with actual pricing: $${rfqData.actualPrice.toFixed(2)} per ${item.unit}.${varianceMsg}`,
  };
}

// ============================================================================
// STATUS MANAGEMENT
// ============================================================================

/**
 * Change BOM item status
 */
export async function updateBOMStatus(
  itemId: string,
  status: BOMStatus
): Promise<{ item: BOMItem; message: string }> {
  const result = await sql`
    UPDATE bom_items
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${itemId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error('BOM item not found');
  }

  const item = mapRowToBOMItem(result.rows[0]);

  const statusMessages: Record<BOMStatus, string> = {
    needed: `"${item.name}" marked as needed. Ready to create an RFQ.`,
    rfq_sent: `"${item.name}" RFQ is out. Waiting for supplier quotes.`,
    quoted: `"${item.name}" has quotes in. Review and select a supplier when ready.`,
    ordered: `"${item.name}" is ordered. Tracking shipment.`,
    shipped: `"${item.name}" is on its way. Keep an eye on delivery.`,
    received: `"${item.name}" received and checked in.`,
    cancelled: `"${item.name}" has been cancelled.`,
  };

  return {
    item,
    message: statusMessages[status],
  };
}

/**
 * Mark a BOM item as received with actual values
 */
export async function markBOMReceived(
  itemId: string,
  actualQuantity: number,
  actualPrice: number
): Promise<{ item: BOMItem; message: string }> {
  const result = await sql`
    UPDATE bom_items
    SET
      status = 'received',
      actual_quantity = ${actualQuantity},
      actual_price = ${actualPrice},
      received_at = NOW(),
      updated_at = NOW()
    WHERE id = ${itemId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error('BOM item not found');
  }

  const item = mapRowToBOMItem(result.rows[0]);

  const quantityDiff = actualQuantity - item.quantity;
  const priceDiff =
    item.estimatedPrice !== undefined
      ? (actualPrice - item.estimatedPrice) * actualQuantity
      : null;

  let message = `Received "${item.name}": ${actualQuantity} ${item.unit} at $${actualPrice.toFixed(2)} each.`;

  if (quantityDiff !== 0) {
    message += ` (${quantityDiff > 0 ? '+' : ''}${quantityDiff} from ordered quantity)`;
  }

  if (priceDiff !== null && priceDiff !== 0) {
    message += ` Total ${priceDiff > 0 ? 'over' : 'under'} estimate by $${Math.abs(priceDiff).toFixed(2)}.`;
  }

  return { item, message };
}

/**
 * Get BOM items by status
 */
export async function getBOMByStatus(
  projectId: string,
  status: BOMStatus
): Promise<BOMItem[]> {
  return getBOMItems(projectId, { status });
}

// ============================================================================
// SUPPLIER SOURCING
// ============================================================================

/**
 * Find suppliers that match a BOM item
 */
export async function findSuppliersForBOM(
  itemId: string
): Promise<{
  suppliers: Array<{
    id: string;
    name: string;
    matchScore: number;
    reasoning: string;
    estimatedPrice?: number;
    leadTime?: number;
  }>;
  message: string;
}> {
  const itemResult = await sql`SELECT * FROM bom_items WHERE id = ${itemId}`;
  if (itemResult.rows.length === 0) {
    throw new Error('BOM item not found');
  }

  const item = mapRowToBOMItem(itemResult.rows[0]);

  // Use existing supplier matching
  const matchResult = await matchSuppliersToRequest({
    category: item.category || 'General',
    description: item.description || item.name,
    quantity: item.quantity,
    targetPrice: item.estimatedPrice,
    urgency:
      item.priority === 'critical'
        ? 'critical'
        : item.priority === 'high'
          ? 'urgent'
          : 'standard',
    deliveryLocation: 'TBD',
  });

  const suppliers = matchResult.matches.map((m) => ({
    id: m.supplier.id,
    name: m.supplier.companyName,
    matchScore: m.matchScore,
    reasoning: m.reasoning,
    estimatedPrice: m.estimatedPrice,
    leadTime: m.estimatedLeadTime,
  }));

  if (suppliers.length === 0) {
    return {
      suppliers: [],
      message: `No suppliers found for "${item.name}" in your network. Consider onboarding new suppliers for ${item.category || 'this category'}.`,
    };
  }

  return {
    suppliers,
    message: `Found ${suppliers.length} potential supplier${suppliers.length > 1 ? 's' : ''} for "${item.name}". Top match: ${suppliers[0].name} (${suppliers[0].matchScore}% fit).`,
  };
}

/**
 * Request quotes from specific suppliers for a BOM item
 */
export async function requestQuotesForBOM(
  itemId: string,
  supplierIds: string[]
): Promise<{ rfqId: string; message: string }> {
  // First create the RFQ
  const { rfqId } = await createRFQFromBOM(itemId);

  // Get item details
  const itemResult = await sql`SELECT * FROM bom_items WHERE id = ${itemId}`;
  const item = mapRowToBOMItem(itemResult.rows[0]);

  // Create match records for each supplier
  for (const supplierId of supplierIds) {
    await sql`
      INSERT INTO seller_rfq_matches (
        seller_id,
        rfq_id,
        match_score,
        match_reasons,
        status
      ) VALUES (
        ${supplierId},
        ${rfqId},
        80,
        '{"Manual request from BOM"}',
        'pending'
      )
    `;
  }

  return {
    rfqId,
    message: `Quote requests sent to ${supplierIds.length} supplier${supplierIds.length > 1 ? 's' : ''} for "${item.name}". I'll notify you when quotes come in.`,
  };
}

// ============================================================================
// AUTO-SOURCING
// ============================================================================

/**
 * Automatically source all 'needed' items in a project's BOM
 */
export async function autoSourceBOM(
  projectId: string
): Promise<{
  processed: number;
  rfqsCreated: number;
  suppliersFound: number;
  errors: string[];
  message: string;
}> {
  const neededItems = await getBOMItems(projectId, { status: 'needed' });

  if (neededItems.length === 0) {
    return {
      processed: 0,
      rfqsCreated: 0,
      suppliersFound: 0,
      errors: [],
      message: 'No items need sourcing right now. All BOM items are already in progress.',
    };
  }

  let rfqsCreated = 0;
  let suppliersFound = 0;
  const errors: string[] = [];

  for (const item of neededItems) {
    try {
      // Find suppliers
      const { suppliers } = await findSuppliersForBOM(item.id);

      if (suppliers.length > 0) {
        suppliersFound += suppliers.length;

        // Create RFQ with top 3 suppliers
        const topSupplierIds = suppliers.slice(0, 3).map((s) => s.id);
        await requestQuotesForBOM(item.id, topSupplierIds);
        rfqsCreated++;
      } else {
        // Create RFQ anyway for manual supplier matching
        await createRFQFromBOM(item.id);
        rfqsCreated++;
      }
    } catch (error) {
      errors.push(`Failed to process "${item.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    processed: neededItems.length,
    rfqsCreated,
    suppliersFound,
    errors,
    message:
      errors.length === 0
        ? `Auto-sourced ${neededItems.length} item${neededItems.length > 1 ? 's' : ''}. Created ${rfqsCreated} RFQ${rfqsCreated > 1 ? 's' : ''} and found ${suppliersFound} potential suppliers. Quotes should start coming in soon.`
        : `Sourced ${neededItems.length - errors.length} of ${neededItems.length} items. ${errors.length} had issues.`,
  };
}

// ============================================================================
// NATURAL LANGUAGE PARSING
// ============================================================================

/**
 * Extract BOM items from natural language text
 */
export async function parseBOMFromText(text: string): Promise<{
  items: ParsedBOMItem[];
  message: string;
}> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `Extract bill of materials items from this text. For each item, identify:
- name: product/material name
- quantity: number needed (default to 1 if not specified)
- unit: unit of measure (each, pack, box, gallon, etc. - default to "each")
- description: brief description if provided
- category: product category if identifiable (hardware, software, materials, supplies, equipment, services, etc.)
- estimatedPrice: price per unit if mentioned (number only, no currency symbol)

Text: "${text}"

Respond with JSON only:
{
  "items": [
    {
      "name": "...",
      "quantity": 1,
      "unit": "each",
      "description": "...",
      "category": "...",
      "estimatedPrice": null
    }
  ]
}`,
      },
    ],
  });

  try {
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const parsed = JSON.parse(content.text);
    const items: ParsedBOMItem[] = parsed.items || [];

    if (items.length === 0) {
      return {
        items: [],
        message: "I couldn't identify any specific items from that. Could you try listing them more clearly? For example: '500 aluminum brackets, 1000 screws, and 50 gallons of paint'",
      };
    }

    const itemSummary = items
      .map((i) => `${i.quantity} ${i.unit} of ${i.name}`)
      .join(', ');

    return {
      items,
      message: `Got it. I found ${items.length} item${items.length > 1 ? 's' : ''}: ${itemSummary}. Ready to add these to your BOM?`,
    };
  } catch (error) {
    // Fallback: try simple regex parsing
    return parseBOMFromTextFallback(text);
  }
}

/**
 * Fallback regex-based parsing for when AI parsing fails
 */
function parseBOMFromTextFallback(text: string): {
  items: ParsedBOMItem[];
  message: string;
} {
  const items: ParsedBOMItem[] = [];

  // Pattern: "X items/units of Y" or "X Y" (where X is a number)
  const patterns = [
    /(\d+(?:,\d{3})*)\s+(?:units?|pieces?|packs?|boxes?|cases?|each|pcs?)?\s*(?:of\s+)?([a-zA-Z][^,\n]+)/gi,
    /([a-zA-Z][^,\n]+?)\s*(?:x|@)\s*(\d+(?:,\d{3})*)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const quantity = parseInt(match[1].replace(/,/g, ''));
      const name = match[2].trim();

      // Avoid duplicates
      if (!items.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
        items.push({
          name,
          quantity: isNaN(quantity) ? 1 : quantity,
          unit: 'each',
        });
      }
    }
  }

  if (items.length === 0) {
    return {
      items: [],
      message: "I couldn't parse specific items from that. Try formatting like: '500 aluminum brackets, 1000 screws'",
    };
  }

  return {
    items,
    message: `Found ${items.length} item${items.length > 1 ? 's' : ''}: ${items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`,
  };
}

/**
 * Parse BOM items from a list (bullet points or spreadsheet paste)
 */
export async function parseBOMFromList(lines: string[]): Promise<{
  items: ParsedBOMItem[];
  message: string;
}> {
  const items: ParsedBOMItem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      continue; // Skip empty lines and comments
    }

    // Remove bullet points and list markers
    const cleaned = trimmed.replace(/^[-*\u2022\d+.)\]]\s*/, '');

    // Try to parse quantity and item
    // Patterns: "500 aluminum brackets" or "aluminum brackets, 500" or "aluminum brackets x 500"
    let quantity = 1;
    let name = cleaned;
    let unit = 'each';
    let price: number | undefined;

    // Extract quantity at start
    const qtyStartMatch = cleaned.match(/^(\d+(?:,\d{3})*)\s*(units?|pcs?|each|boxes?|packs?|gallons?|lbs?|kg)?\s+(.+)/i);
    if (qtyStartMatch) {
      quantity = parseInt(qtyStartMatch[1].replace(/,/g, ''));
      unit = qtyStartMatch[2]?.toLowerCase() || 'each';
      name = qtyStartMatch[3];
    }

    // Extract quantity at end
    const qtyEndMatch = name.match(/^(.+?)\s*[,x@]\s*(\d+(?:,\d{3})*)\s*(units?|pcs?|each)?$/i);
    if (qtyEndMatch) {
      name = qtyEndMatch[1];
      quantity = parseInt(qtyEndMatch[2].replace(/,/g, ''));
    }

    // Extract price
    const priceMatch = name.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(/,/g, ''));
      name = name.replace(/\$\d+(?:,\d{3})*(?:\.\d{2})?/, '').trim();
    }

    // Clean up name
    name = name.replace(/[,\-]+$/, '').trim();

    if (name) {
      items.push({
        name,
        quantity,
        unit,
        estimatedPrice: price,
      });
    }
  }

  if (items.length === 0) {
    return {
      items: [],
      message: 'No items could be parsed from the list. Make sure each line has an item name.',
    };
  }

  return {
    items,
    message: `Parsed ${items.length} item${items.length > 1 ? 's' : ''} from your list. Ready to add to BOM.`,
  };
}

// ============================================================================
// FINANCIAL INTEGRATION
// ============================================================================

/**
 * Get total actual spend on BOM items for a project
 */
export async function getBOMSpend(projectId: string): Promise<{
  totalSpend: number;
  byCategory: Record<string, number>;
  byStatus: Record<BOMStatus, number>;
  itemCount: number;
  message: string;
}> {
  const result = await sql`
    SELECT
      SUM(COALESCE(actual_price, 0) * COALESCE(actual_quantity, quantity)) as total_spend,
      COUNT(*) as item_count,
      COALESCE(category, 'Uncategorized') as category,
      status
    FROM bom_items
    WHERE project_id = ${projectId}
      AND actual_price IS NOT NULL
    GROUP BY category, status
  `;

  let totalSpend = 0;
  const byCategory: Record<string, number> = {};
  const byStatus: Record<BOMStatus, number> = {
    needed: 0,
    rfq_sent: 0,
    quoted: 0,
    ordered: 0,
    shipped: 0,
    received: 0,
    cancelled: 0,
  };
  let itemCount = 0;

  for (const row of result.rows) {
    const spend = parseFloat(row.total_spend || '0');
    totalSpend += spend;
    itemCount += parseInt(row.item_count);

    const category = row.category as string;
    byCategory[category] = (byCategory[category] || 0) + spend;

    const status = row.status as BOMStatus;
    byStatus[status] = (byStatus[status] || 0) + spend;
  }

  return {
    totalSpend,
    byCategory,
    byStatus,
    itemCount,
    message:
      itemCount > 0
        ? `Total BOM spend: $${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${itemCount} items with actual pricing.`
        : 'No actual spend recorded yet. Spend is tracked when you receive priced quotes or mark items as received.',
  };
}

/**
 * Compare estimated vs actual BOM costs
 */
export async function getBOMBudgetVariance(projectId: string): Promise<{
  totalEstimate: number;
  totalActual: number;
  variance: number;
  variancePercent: number;
  overBudgetItems: Array<{ name: string; variance: number }>;
  underBudgetItems: Array<{ name: string; variance: number }>;
  message: string;
}> {
  const result = await sql`
    SELECT
      name,
      quantity,
      estimated_price,
      actual_price,
      actual_quantity,
      (COALESCE(actual_price, 0) * COALESCE(actual_quantity, quantity)) -
      (COALESCE(estimated_price, 0) * quantity) as item_variance
    FROM bom_items
    WHERE project_id = ${projectId}
      AND (estimated_price IS NOT NULL OR actual_price IS NOT NULL)
    ORDER BY item_variance DESC
  `;

  let totalEstimate = 0;
  let totalActual = 0;
  const overBudgetItems: Array<{ name: string; variance: number }> = [];
  const underBudgetItems: Array<{ name: string; variance: number }> = [];

  for (const row of result.rows) {
    const qty = row.quantity;
    const actualQty = row.actual_quantity || qty;
    const estPrice = parseFloat(row.estimated_price || '0');
    const actPrice = parseFloat(row.actual_price || '0');

    totalEstimate += estPrice * qty;
    totalActual += actPrice * actualQty;

    if (row.item_variance !== null) {
      const variance = parseFloat(row.item_variance);
      if (variance > 0) {
        overBudgetItems.push({ name: row.name, variance });
      } else if (variance < 0) {
        underBudgetItems.push({ name: row.name, variance: Math.abs(variance) });
      }
    }
  }

  const variance = totalActual - totalEstimate;
  const variancePercent = totalEstimate > 0 ? (variance / totalEstimate) * 100 : 0;

  let message: string;
  if (totalActual === 0) {
    message = `Estimated BOM cost: $${totalEstimate.toLocaleString()}. No actual costs recorded yet.`;
  } else if (Math.abs(variancePercent) < 1) {
    message = `Right on budget. Estimated: $${totalEstimate.toLocaleString()}, Actual: $${totalActual.toLocaleString()}.`;
  } else if (variance > 0) {
    message = `Over budget by $${variance.toLocaleString()} (${variancePercent.toFixed(1)}%). ${overBudgetItems.length} item${overBudgetItems.length > 1 ? 's' : ''} running over.`;
  } else {
    message = `Under budget by $${Math.abs(variance).toLocaleString()} (${Math.abs(variancePercent).toFixed(1)}%). Nice work keeping costs down.`;
  }

  return {
    totalEstimate,
    totalActual,
    variance,
    variancePercent,
    overBudgetItems: overBudgetItems.slice(0, 5),
    underBudgetItems: underBudgetItems.slice(0, 5),
    message,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapRowToBOMItem(row: any): BOMItem {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    estimatedPrice: row.estimated_price ? parseFloat(row.estimated_price) : undefined,
    actualPrice: row.actual_price ? parseFloat(row.actual_price) : undefined,
    priority: row.priority as BOMPriority,
    requiredByDate: row.required_by_date ? new Date(row.required_by_date) : undefined,
    leadTimeDays: row.lead_time_days,
    status: row.status as BOMStatus,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    rfqId: row.rfq_id,
    quoteId: row.quote_id,
    actualQuantity: row.actual_quantity,
    receivedAt: row.received_at ? new Date(row.received_at) : undefined,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
