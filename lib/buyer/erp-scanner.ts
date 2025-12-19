/**
 * Buyer ERP Scanner
 * Proactively scans connected ERP systems for procurement opportunities
 * and prompts buyers through conversation
 */

import { sqlQuery as sql } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// =====================================================
// TYPES
// =====================================================

export interface ERPConnection {
  id: string;
  userId: string;
  erpType: 'quickbooks' | 'xero' | 'netsuite' | 'sap' | 'coupa' | 'oracle';
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: Date;
  credentials?: Record<string, any>; // Encrypted
  settings: ERPScannerSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface ERPScannerSettings {
  enabled: boolean;
  scanFrequency: 'realtime' | 'hourly' | 'daily';
  alertThresholds: {
    lowInventoryPercent: number;
    upcomingContractDays: number;
    recurringSpendThreshold: number;
    priceIncreasePercent: number;
  };
  autoCreateRFQ: boolean;
  categories: string[]; // Categories to monitor
}

export interface ProcurementOpportunity {
  id: string;
  userId: string;
  erpConnectionId: string;
  type: OpportunityType;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  estimatedValue: number;
  estimatedSavings?: number;
  data: Record<string, any>;
  suggestedAction: string;
  status: 'new' | 'reviewed' | 'actioned' | 'dismissed';
  rfqId?: string; // If RFQ was created
  createdAt: Date;
  reviewedAt?: Date;
}

export type OpportunityType =
  | 'low_inventory'
  | 'contract_expiring'
  | 'recurring_spend'
  | 'price_increase'
  | 'consolidation'
  | 'new_vendor_needed'
  | 'budget_available'
  | 'seasonal_buying';

// =====================================================
// ERP CONNECTION MANAGEMENT
// =====================================================

export async function getERPConnections(userId: string): Promise<ERPConnection[]> {
  const result = await sql`
    SELECT * FROM erp_connections WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return result.rows.map(mapRowToConnection);
}

export async function getERPConnection(connectionId: string): Promise<ERPConnection | null> {
  const result = await sql`
    SELECT * FROM erp_connections WHERE id = ${connectionId}
  `;

  if (result.rows.length === 0) return null;
  return mapRowToConnection(result.rows[0]);
}

export async function createERPConnection(
  userId: string,
  erpType: ERPConnection['erpType'],
  credentials: Record<string, any>
): Promise<ERPConnection> {
  const settings: ERPScannerSettings = {
    enabled: true,
    scanFrequency: 'daily',
    alertThresholds: {
      lowInventoryPercent: 20,
      upcomingContractDays: 30,
      recurringSpendThreshold: 5000,
      priceIncreasePercent: 10,
    },
    autoCreateRFQ: false,
    categories: [],
  };

  const result = await sql`
    INSERT INTO erp_connections (
      user_id, erp_type, connection_status, credentials, settings
    ) VALUES (
      ${userId},
      ${erpType},
      'connected',
      ${JSON.stringify(credentials)},
      ${JSON.stringify(settings)}
    )
    RETURNING *
  `;

  return mapRowToConnection(result.rows[0]);
}

export async function updateScannerSettings(
  connectionId: string,
  settings: Partial<ERPScannerSettings>
): Promise<ERPConnection> {
  const current = await getERPConnection(connectionId);
  if (!current) throw new Error('Connection not found');

  const newSettings = { ...current.settings, ...settings };

  const result = await sql`
    UPDATE erp_connections
    SET settings = ${JSON.stringify(newSettings)}, updated_at = NOW()
    WHERE id = ${connectionId}
    RETURNING *
  `;

  return mapRowToConnection(result.rows[0]);
}

/**
 * Disconnect (soft-delete) ERP connection
 */
export async function disconnectERP(connectionId: string): Promise<void> {
  await sql`
    UPDATE erp_connections
    SET connection_status = 'disconnected',
        updated_at = NOW()
    WHERE id = ${connectionId}
  `;
}

// =====================================================
// ERP SCANNING
// =====================================================

/**
 * Scan ERP for procurement opportunities
 * In production, this would call actual ERP APIs
 */
export async function scanForOpportunities(
  userId: string,
  connectionId?: string
): Promise<{
  opportunities: ProcurementOpportunity[];
  summary: string;
}> {
  // Get all connections or specific one
  let connections: ERPConnection[];
  if (connectionId) {
    const conn = await getERPConnection(connectionId);
    connections = conn ? [conn] : [];
  } else {
    connections = await getERPConnections(userId);
  }

  if (connections.length === 0) {
    return {
      opportunities: [],
      summary: "I don't see any ERP systems connected. Would you like to connect QuickBooks, Xero, NetSuite, or another system?",
    };
  }

  const allOpportunities: ProcurementOpportunity[] = [];

  for (const connection of connections) {
    if (!connection.settings.enabled) continue;

    // Simulate scanning different ERP data sources
    const opportunities = await simulateERPScan(userId, connection);
    allOpportunities.push(...opportunities);

    // Store opportunities
    for (const opp of opportunities) {
      await sql`
        INSERT INTO procurement_opportunities (
          user_id, erp_connection_id, type, priority,
          title, description, estimated_value, estimated_savings,
          data, suggested_action, status
        ) VALUES (
          ${userId},
          ${connection.id},
          ${opp.type},
          ${opp.priority},
          ${opp.title},
          ${opp.description},
          ${opp.estimatedValue},
          ${opp.estimatedSavings || null},
          ${JSON.stringify(opp.data)},
          ${opp.suggestedAction},
          'new'
        )
      `;
    }
  }

  // Generate conversational summary
  const summary = await generateOpportunitySummary(allOpportunities);

  return { opportunities: allOpportunities, summary };
}

/**
 * Get pending opportunities for a user
 */
export async function getOpportunities(
  userId: string,
  filters: {
    status?: string;
    type?: OpportunityType;
    priority?: string;
    limit?: number;
  } = {}
): Promise<ProcurementOpportunity[]> {
  const limit = filters.limit || 20;

  let query;
  if (filters.status && filters.priority) {
    query = sql`
      SELECT * FROM procurement_opportunities
      WHERE user_id = ${userId}
        AND status = ${filters.status}
        AND priority = ${filters.priority}
      ORDER BY
        CASE priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        estimated_savings DESC NULLS LAST,
        created_at DESC
      LIMIT ${limit}
    `;
  } else if (filters.status) {
    query = sql`
      SELECT * FROM procurement_opportunities
      WHERE user_id = ${userId} AND status = ${filters.status}
      ORDER BY
        CASE priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        estimated_savings DESC NULLS LAST,
        created_at DESC
      LIMIT ${limit}
    `;
  } else {
    query = sql`
      SELECT * FROM procurement_opportunities
      WHERE user_id = ${userId}
      ORDER BY
        CASE priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        estimated_savings DESC NULLS LAST,
        created_at DESC
      LIMIT ${limit}
    `;
  }

  const result = await query;
  return result.rows.map(mapRowToOpportunity);
}

/**
 * Action an opportunity (create RFQ, dismiss, etc)
 */
export async function actionOpportunity(
  opportunityId: string,
  action: 'create_rfq' | 'dismiss' | 'remind_later',
  notes?: string
): Promise<{
  success: boolean;
  message: string;
  rfqId?: string;
}> {
  const oppResult = await sql`
    SELECT * FROM procurement_opportunities WHERE id = ${opportunityId}
  `;

  if (oppResult.rows.length === 0) {
    return { success: false, message: 'Opportunity not found' };
  }

  const opp = mapRowToOpportunity(oppResult.rows[0]);

  switch (action) {
    case 'create_rfq': {
      // Create RFQ from opportunity
      const rfqResult = await sql`
        INSERT INTO rfqs (
          user_id, category, description, quantity,
          target_price, urgency, status
        ) VALUES (
          ${opp.userId},
          ${opp.data.category || 'General'},
          ${opp.description},
          ${opp.data.quantity || 1},
          ${opp.estimatedValue},
          ${opp.priority === 'urgent' ? 'urgent' : 'standard'},
          'open'
        )
        RETURNING id
      `;

      const rfqId = rfqResult.rows[0].id;

      await sql`
        UPDATE procurement_opportunities
        SET status = 'actioned', rfq_id = ${rfqId}, reviewed_at = NOW()
        WHERE id = ${opportunityId}
      `;

      return {
        success: true,
        message: `Created RFQ for ${opp.title}. I'll find suppliers and get you quotes.`,
        rfqId,
      };
    }

    case 'dismiss': {
      await sql`
        UPDATE procurement_opportunities
        SET status = 'dismissed', reviewed_at = NOW()
        WHERE id = ${opportunityId}
      `;

      return {
        success: true,
        message: `Dismissed. I won't bring this up again unless conditions change.`,
      };
    }

    case 'remind_later': {
      // Set reviewed but keep as new for next scan
      await sql`
        UPDATE procurement_opportunities
        SET reviewed_at = NOW()
        WHERE id = ${opportunityId}
      `;

      return {
        success: true,
        message: `Got it. I'll remind you about this in a few days.`,
      };
    }

    default:
      return { success: false, message: 'Unknown action' };
  }
}

// =====================================================
// SIMULATED ERP SCANNING
// =====================================================

async function simulateERPScan(
  userId: string,
  connection: ERPConnection
): Promise<ProcurementOpportunity[]> {
  const opportunities: ProcurementOpportunity[] = [];
  const settings = connection.settings;

  // Simulate Low Inventory Alert
  if (Math.random() > 0.6) {
    opportunities.push({
      id: crypto.randomUUID(),
      userId,
      erpConnectionId: connection.id,
      type: 'low_inventory',
      priority: 'high',
      title: 'Office Supplies Running Low',
      description: 'Printer paper, pens, and notebooks are below 20% of normal stock levels. Based on your usage, you\'ll run out in about 2 weeks.',
      estimatedValue: 850,
      estimatedSavings: 120,
      data: {
        category: 'Office Supplies',
        items: ['Printer Paper', 'Ballpoint Pens', 'Notebooks'],
        currentStock: 15,
        normalStock: 100,
        quantity: 500,
      },
      suggestedAction: 'Create RFQ for office supplies restock',
      status: 'new',
      createdAt: new Date(),
    });
  }

  // Simulate Contract Expiring
  if (Math.random() > 0.5) {
    const daysUntilExpiry = Math.floor(Math.random() * 45) + 15;
    opportunities.push({
      id: crypto.randomUUID(),
      userId,
      erpConnectionId: connection.id,
      type: 'contract_expiring',
      priority: daysUntilExpiry < 30 ? 'high' : 'medium',
      title: `Cleaning Services Contract Expires in ${daysUntilExpiry} Days`,
      description: `Your contract with CleanCo Inc expires on ${new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000).toLocaleDateString()}. Annual spend: $18,000. Should I find competitive quotes?`,
      estimatedValue: 18000,
      estimatedSavings: 2500,
      data: {
        category: 'Cleaning Services',
        vendor: 'CleanCo Inc',
        contractEnd: new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000),
        annualSpend: 18000,
      },
      suggestedAction: 'Get competitive quotes before renewal',
      status: 'new',
      createdAt: new Date(),
    });
  }

  // Simulate Recurring Spend Pattern
  if (Math.random() > 0.7) {
    opportunities.push({
      id: crypto.randomUUID(),
      userId,
      erpConnectionId: connection.id,
      type: 'recurring_spend',
      priority: 'medium',
      title: 'Consolidation Opportunity: IT Equipment',
      description: 'You\'ve purchased laptops from 4 different vendors in the past 6 months, totaling $45,000. Consolidating to one supplier could save 15-20% through volume discounts.',
      estimatedValue: 45000,
      estimatedSavings: 7500,
      data: {
        category: 'IT Equipment',
        vendors: ['Dell', 'HP', 'Lenovo', 'Apple'],
        purchases: 12,
        period: '6 months',
      },
      suggestedAction: 'Request volume quotes from preferred vendors',
      status: 'new',
      createdAt: new Date(),
    });
  }

  // Simulate Price Increase Detection
  if (Math.random() > 0.8) {
    opportunities.push({
      id: crypto.randomUUID(),
      userId,
      erpConnectionId: connection.id,
      type: 'price_increase',
      priority: 'medium',
      title: 'Price Increase Alert: Shipping Services',
      description: 'Your shipping costs increased 18% last month compared to the prior 3-month average. Your carrier may have changed rates. Want me to find alternatives?',
      estimatedValue: 12000,
      estimatedSavings: 2400,
      data: {
        category: 'Shipping',
        vendor: 'FastFreight LLC',
        priceIncrease: 18,
        monthlySpend: 4000,
      },
      suggestedAction: 'Get quotes from competing carriers',
      status: 'new',
      createdAt: new Date(),
    });
  }

  // Simulate Budget Available
  if (Math.random() > 0.85) {
    opportunities.push({
      id: crypto.randomUUID(),
      userId,
      erpConnectionId: connection.id,
      type: 'budget_available',
      priority: 'low',
      title: 'Q4 Budget: $25,000 Unallocated',
      description: 'You have $25,000 remaining in your Q4 discretionary budget. The quarter ends in 6 weeks. Any planned purchases you want to get ahead on?',
      estimatedValue: 25000,
      data: {
        budgetCategory: 'Discretionary',
        remaining: 25000,
        quarterEnd: new Date(new Date().getFullYear(), Math.ceil((new Date().getMonth() + 1) / 3) * 3, 0),
      },
      suggestedAction: 'Review planned purchases for Q4',
      status: 'new',
      createdAt: new Date(),
    });
  }

  return opportunities;
}

// =====================================================
// AI SUMMARY GENERATION
// =====================================================

async function generateOpportunitySummary(
  opportunities: ProcurementOpportunity[]
): Promise<string> {
  if (opportunities.length === 0) {
    return "I scanned your ERP data and everything looks good. No urgent procurement opportunities right now. I'll keep monitoring and let you know when something comes up.";
  }

  const urgent = opportunities.filter((o) => o.priority === 'urgent' || o.priority === 'high');
  const totalSavings = opportunities.reduce((sum, o) => sum + (o.estimatedSavings || 0), 0);
  const totalValue = opportunities.reduce((sum, o) => sum + o.estimatedValue, 0);

  const aiResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Summarize these procurement opportunities conversationally. Be direct and action-oriented. Keep it under 3 sentences.

Found: ${opportunities.length} opportunities
Urgent/High priority: ${urgent.length}
Total value: $${totalValue.toLocaleString()}
Potential savings: $${totalSavings.toLocaleString()}

Types:
${opportunities.map((o) => `- ${o.type}: ${o.title}`).join('\n')}

Start with the most important finding. End with asking what they want to tackle first.`,
      },
    ],
  });

  const summary = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';
  return summary || `Found ${opportunities.length} procurement opportunities worth $${totalValue.toLocaleString()}, with potential savings of $${totalSavings.toLocaleString()}. ${urgent.length} are high priority. What would you like to tackle first?`;
}

// =====================================================
// CONVERSATIONAL PARSING
// =====================================================

export function parseERPSettingsFromText(text: string): Partial<ERPScannerSettings> {
  const settings: Partial<ERPScannerSettings> = {};

  // Enable/disable
  if (text.match(/enable|turn on|start/i)) {
    settings.enabled = true;
  } else if (text.match(/disable|turn off|stop|pause/i)) {
    settings.enabled = false;
  }

  // Frequency
  if (text.match(/real\s*time|instant|immediate/i)) {
    settings.scanFrequency = 'realtime';
  } else if (text.match(/hourly|every hour/i)) {
    settings.scanFrequency = 'hourly';
  } else if (text.match(/daily|once a day/i)) {
    settings.scanFrequency = 'daily';
  }

  // Auto-create RFQ
  if (text.match(/auto.*rfq|automatic.*rfq|create rfq automatically/i)) {
    settings.autoCreateRFQ = true;
  } else if (text.match(/no auto|manual|ask me first/i)) {
    settings.autoCreateRFQ = false;
  }

  // Thresholds
  const inventoryMatch = text.match(/inventory.*?(\d+)\s*%|(\d+)\s*%.*inventory/i);
  if (inventoryMatch) {
    const thresholds = settings.alertThresholds || {
      lowInventoryPercent: 20,
      upcomingContractDays: 30,
      recurringSpendThreshold: 5000,
      priceIncreasePercent: 10,
    };
    thresholds.lowInventoryPercent = parseInt(inventoryMatch[1] || inventoryMatch[2]);
    settings.alertThresholds = thresholds;
  }

  return settings;
}

export function parseOpportunityActionFromText(text: string): {
  action: 'create_rfq' | 'dismiss' | 'remind_later';
  notes?: string;
} | null {
  if (text.match(/yes|do it|create|let'?s go|sounds good|make it happen|get quotes/i)) {
    return { action: 'create_rfq' };
  }
  if (text.match(/no|skip|not now|dismiss|don'?t need|pass/i)) {
    return { action: 'dismiss' };
  }
  if (text.match(/later|remind|come back|next week|not yet/i)) {
    return { action: 'remind_later' };
  }
  return null;
}

// =====================================================
// ROW MAPPERS
// =====================================================

function mapRowToConnection(row: any): ERPConnection {
  return {
    id: row.id,
    userId: row.user_id,
    erpType: row.erp_type,
    connectionStatus: row.connection_status,
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
    credentials: row.credentials,
    settings: row.settings || {
      enabled: true,
      scanFrequency: 'daily',
      alertThresholds: {
        lowInventoryPercent: 20,
        upcomingContractDays: 30,
        recurringSpendThreshold: 5000,
        priceIncreasePercent: 10,
      },
      autoCreateRFQ: false,
      categories: [],
    },
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToOpportunity(row: any): ProcurementOpportunity {
  return {
    id: row.id,
    userId: row.user_id,
    erpConnectionId: row.erp_connection_id,
    type: row.type,
    priority: row.priority,
    title: row.title,
    description: row.description,
    estimatedValue: parseFloat(row.estimated_value),
    estimatedSavings: row.estimated_savings ? parseFloat(row.estimated_savings) : undefined,
    data: row.data || {},
    suggestedAction: row.suggested_action,
    status: row.status,
    rfqId: row.rfq_id,
    createdAt: new Date(row.created_at),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
  };
}
