/**
 * Seller Pipeline Service
 * Opportunity and deal tracking through conversation
 */

import { sqlQuery as sql } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import {
  Opportunity,
  OpportunityActivity,
  OpportunityLineItem,
  PipelineStage,
  Lead,
} from './types';

const anthropic = new Anthropic();

// =====================================================
// OPPORTUNITY MANAGEMENT
// =====================================================

export async function getOpportunities(
  sellerId: string,
  filters: {
    status?: 'open' | 'won' | 'lost';
    stageId?: string;
    limit?: number;
  } = {}
): Promise<Opportunity[]> {
  const limit = filters.limit || 50;

  let query;
  if (filters.status && filters.stageId) {
    query = sql`
      SELECT o.*, s.name as stage_name, s.probability as stage_probability
      FROM seller_opportunities o
      LEFT JOIN seller_pipeline_stages s ON o.stage_id = s.id
      WHERE o.seller_id = ${sellerId}
        AND o.status = ${filters.status}
        AND o.stage_id = ${filters.stageId}
      ORDER BY o.weighted_amount DESC, o.created_at DESC
      LIMIT ${limit}
    `;
  } else if (filters.status) {
    query = sql`
      SELECT o.*, s.name as stage_name, s.probability as stage_probability
      FROM seller_opportunities o
      LEFT JOIN seller_pipeline_stages s ON o.stage_id = s.id
      WHERE o.seller_id = ${sellerId} AND o.status = ${filters.status}
      ORDER BY o.weighted_amount DESC, o.created_at DESC
      LIMIT ${limit}
    `;
  } else {
    query = sql`
      SELECT o.*, s.name as stage_name, s.probability as stage_probability
      FROM seller_opportunities o
      LEFT JOIN seller_pipeline_stages s ON o.stage_id = s.id
      WHERE o.seller_id = ${sellerId}
      ORDER BY o.weighted_amount DESC, o.created_at DESC
      LIMIT ${limit}
    `;
  }

  const result = await query;
  return result.rows.map(mapRowToOpportunity);
}

export async function getOpportunity(oppId: string): Promise<Opportunity | null> {
  const result = await sql`
    SELECT o.*, s.name as stage_name, s.probability as stage_probability
    FROM seller_opportunities o
    LEFT JOIN seller_pipeline_stages s ON o.stage_id = s.id
    WHERE o.id = ${oppId}
  `;

  if (result.rows.length === 0) return null;
  return mapRowToOpportunity(result.rows[0]);
}

export async function createOpportunity(
  sellerId: string,
  data: Partial<Opportunity>
): Promise<Opportunity> {
  // Get first stage (Lead) if not specified
  let stageId = data.stageId;
  if (!stageId) {
    const stages = await getPipelineStages(sellerId);
    const leadStage = stages.find((s) => s.orderIndex === 1);
    stageId = leadStage?.id;
  }

  const amount = data.amount || 0;
  const probability = data.probability || 10;
  const weightedAmount = amount * (probability / 100);

  const result = await sql`
    INSERT INTO seller_opportunities (
      seller_id, lead_id, rfq_id,
      name, description,
      amount, currency, probability, weighted_amount,
      stage_id, stage_entered_at,
      source, campaign_id,
      expected_close_date,
      line_items,
      competitors, competitive_notes,
      next_step, next_step_date,
      status
    ) VALUES (
      ${sellerId},
      ${data.leadId || null},
      ${data.rfqId || null},
      ${data.name || 'New Opportunity'},
      ${data.description || null},
      ${amount},
      ${data.currency || 'USD'},
      ${probability},
      ${weightedAmount},
      ${stageId || null},
      NOW(),
      ${data.source || 'outbound'},
      ${data.campaignId || null},
      ${data.expectedCloseDate || null},
      ${JSON.stringify(data.lineItems || [])},
      ${data.competitors || null},
      ${data.competitiveNotes || null},
      ${data.nextStep || null},
      ${data.nextStepDate || null},
      'open'
    )
    RETURNING *
  `;

  const opp = mapRowToOpportunity(result.rows[0]);

  // Log activity
  await logActivity(opp.id, sellerId, {
    type: 'note',
    title: 'Opportunity created',
    description: `Created opportunity: ${opp.name}`,
  });

  return opp;
}

export async function updateOpportunity(
  oppId: string,
  updates: Partial<Opportunity>
): Promise<Opportunity> {
  // Get current for comparison
  const current = await getOpportunity(oppId);
  if (!current) throw new Error('Opportunity not found');

  // Calculate weighted amount if amount or probability changed
  let amount = updates.amount !== undefined ? updates.amount : current.amount;
  let probability = updates.probability !== undefined ? updates.probability : current.probability;
  let weightedAmount = amount * (probability / 100);

  const result = await sql`
    UPDATE seller_opportunities
    SET
      name = COALESCE(${updates.name}, name),
      description = COALESCE(${updates.description}, description),
      amount = ${amount},
      probability = ${probability},
      weighted_amount = ${weightedAmount},
      stage_id = COALESCE(${updates.stageId}, stage_id),
      expected_close_date = COALESCE(${updates.expectedCloseDate}, expected_close_date),
      next_step = COALESCE(${updates.nextStep}, next_step),
      next_step_date = COALESCE(${updates.nextStepDate}, next_step_date),
      competitors = COALESCE(${updates.competitors}, competitors),
      competitive_notes = COALESCE(${updates.competitiveNotes}, competitive_notes),
      updated_at = NOW()
    WHERE id = ${oppId}
    RETURNING *
  `;

  return mapRowToOpportunity(result.rows[0]);
}

export async function moveOpportunityStage(
  oppId: string,
  newStageId: string,
  notes?: string
): Promise<Opportunity> {
  const current = await getOpportunity(oppId);
  if (!current) throw new Error('Opportunity not found');

  // Get new stage probability
  const stageResult = await sql`SELECT * FROM seller_pipeline_stages WHERE id = ${newStageId}`;
  if (stageResult.rows.length === 0) throw new Error('Stage not found');

  const newStage = stageResult.rows[0];
  const newProbability = parseFloat(newStage.probability);
  const weightedAmount = current.amount * (newProbability / 100);

  // Check if this is a won/lost stage
  let status = current.status;
  let wonAt = null;
  let lostAt = null;

  if (newStage.is_won) {
    status = 'won';
    wonAt = new Date();
  } else if (newStage.is_lost) {
    status = 'lost';
    lostAt = new Date();
  }

  const result = await sql`
    UPDATE seller_opportunities
    SET
      stage_id = ${newStageId},
      stage_entered_at = NOW(),
      probability = ${newProbability},
      weighted_amount = ${weightedAmount},
      status = ${status},
      won_at = ${wonAt},
      lost_at = ${lostAt},
      updated_at = NOW()
    WHERE id = ${oppId}
    RETURNING *
  `;

  const updated = mapRowToOpportunity(result.rows[0]);

  // Log activity
  await logActivity(oppId, current.sellerId, {
    type: 'stage_change',
    title: `Moved to ${newStage.name}`,
    description: notes || `Stage changed from ${current.stage?.name} to ${newStage.name}`,
    fromStageId: current.stageId,
    toStageId: newStageId,
  });

  return updated;
}

export async function closeOpportunityWon(
  oppId: string,
  finalAmount?: number,
  notes?: string
): Promise<Opportunity> {
  const current = await getOpportunity(oppId);
  if (!current) throw new Error('Opportunity not found');

  // Find won stage
  const stages = await getPipelineStages(current.sellerId);
  const wonStage = stages.find((s) => s.isWon);
  if (!wonStage) throw new Error('No Won stage defined');

  const amount = finalAmount || current.amount;

  const result = await sql`
    UPDATE seller_opportunities
    SET
      stage_id = ${wonStage.id},
      stage_entered_at = NOW(),
      status = 'won',
      won_at = NOW(),
      amount = ${amount},
      probability = 100,
      weighted_amount = ${amount},
      updated_at = NOW()
    WHERE id = ${oppId}
    RETURNING *
  `;

  const updated = mapRowToOpportunity(result.rows[0]);

  await logActivity(oppId, current.sellerId, {
    type: 'stage_change',
    title: 'Closed Won!',
    description: notes || `Deal closed for $${amount.toLocaleString()}`,
    fromStageId: current.stageId,
    toStageId: wonStage.id,
  });

  return updated;
}

export async function closeOpportunityLost(
  oppId: string,
  reason: string
): Promise<Opportunity> {
  const current = await getOpportunity(oppId);
  if (!current) throw new Error('Opportunity not found');

  // Find lost stage
  const stages = await getPipelineStages(current.sellerId);
  const lostStage = stages.find((s) => s.isLost);
  if (!lostStage) throw new Error('No Lost stage defined');

  const result = await sql`
    UPDATE seller_opportunities
    SET
      stage_id = ${lostStage.id},
      stage_entered_at = NOW(),
      status = 'lost',
      lost_at = NOW(),
      lost_reason = ${reason},
      probability = 0,
      weighted_amount = 0,
      updated_at = NOW()
    WHERE id = ${oppId}
    RETURNING *
  `;

  const updated = mapRowToOpportunity(result.rows[0]);

  await logActivity(oppId, current.sellerId, {
    type: 'stage_change',
    title: 'Closed Lost',
    description: `Lost reason: ${reason}`,
    fromStageId: current.stageId,
    toStageId: lostStage.id,
  });

  return updated;
}

// =====================================================
// ACTIVITY LOGGING
// =====================================================

export async function logActivity(
  opportunityId: string,
  sellerId: string,
  activity: {
    type: OpportunityActivity['type'];
    title: string;
    description?: string;
    fromStageId?: string;
    toStageId?: string;
    outreachId?: string;
    quoteId?: string;
    negotiationId?: string;
    scheduledAt?: Date;
    completedAt?: Date;
    outcome?: string;
  }
): Promise<OpportunityActivity> {
  const result = await sql`
    INSERT INTO seller_opportunity_activities (
      opportunity_id, seller_id,
      type, title, description,
      from_stage_id, to_stage_id,
      outreach_id, quote_id, negotiation_id,
      scheduled_at, completed_at, outcome
    ) VALUES (
      ${opportunityId},
      ${sellerId},
      ${activity.type},
      ${activity.title},
      ${activity.description || null},
      ${activity.fromStageId || null},
      ${activity.toStageId || null},
      ${activity.outreachId || null},
      ${activity.quoteId || null},
      ${activity.negotiationId || null},
      ${activity.scheduledAt || null},
      ${activity.completedAt || null},
      ${activity.outcome || null}
    )
    RETURNING *
  `;

  return mapRowToActivity(result.rows[0]);
}

export async function getActivities(
  opportunityId: string,
  limit: number = 50
): Promise<OpportunityActivity[]> {
  const result = await sql`
    SELECT * FROM seller_opportunity_activities
    WHERE opportunity_id = ${opportunityId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result.rows.map(mapRowToActivity);
}

// Re-export getPipelineStages from profile-service for convenience
export { getPipelineStages } from './profile-service';

// =====================================================
// PIPELINE ANALYTICS
// =====================================================

export async function getPipelineSummary(sellerId: string): Promise<{
  totalPipeline: number;
  weightedPipeline: number;
  byStage: { stageName: string; count: number; value: number }[];
  avgDealSize: number;
  avgCycleTime: number;
  winRate: number;
}> {
  // Get pipeline by stage
  const stageResult = await sql`
    SELECT
      s.name as stage_name,
      COUNT(o.id) as count,
      COALESCE(SUM(o.amount), 0) as value,
      COALESCE(SUM(o.weighted_amount), 0) as weighted_value
    FROM seller_pipeline_stages s
    LEFT JOIN seller_opportunities o ON o.stage_id = s.id AND o.status = 'open'
    WHERE s.seller_id = ${sellerId} AND s.is_active = true
    GROUP BY s.id, s.name, s.order_index
    ORDER BY s.order_index
  `;

  const byStage = stageResult.rows.map((r: any) => ({
    stageName: r.stage_name,
    count: parseInt(r.count),
    value: parseFloat(r.value),
  }));

  const totalPipeline = byStage.reduce((sum, s) => sum + s.value, 0);
  const weightedPipeline = stageResult.rows.reduce(
    (sum: number, r: any) => sum + parseFloat(r.weighted_value),
    0
  );

  // Get win stats
  const statsResult = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'won') as won_count,
      COUNT(*) FILTER (WHERE status = 'lost') as lost_count,
      AVG(amount) FILTER (WHERE status = 'won') as avg_deal,
      AVG(EXTRACT(EPOCH FROM (won_at - created_at)) / 86400) FILTER (WHERE status = 'won') as avg_cycle
    FROM seller_opportunities
    WHERE seller_id = ${sellerId}
  `;

  const stats = statsResult.rows[0];
  const wonCount = parseInt(stats.won_count) || 0;
  const lostCount = parseInt(stats.lost_count) || 0;
  const winRate = wonCount + lostCount > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0;

  return {
    totalPipeline,
    weightedPipeline,
    byStage,
    avgDealSize: parseFloat(stats.avg_deal) || 0,
    avgCycleTime: parseFloat(stats.avg_cycle) || 0,
    winRate,
  };
}

// =====================================================
// CONVERSATIONAL PARSING
// =====================================================

export function parseOpportunityFromText(text: string): Partial<Opportunity> {
  const opp: Partial<Opportunity> = {};

  // Name/company
  const nameMatch = text.match(/(?:opportunity|deal|opp)\s*(?:for|with|at)?\s*["']?([^"'$,\n]+)/i);
  if (nameMatch) {
    opp.name = nameMatch[1].trim();
  }

  // Amount
  const amountMatch = text.match(/\$?([\d,]+(?:k|K|m|M)?)\s*(?:deal|opportunity|value)?/);
  if (amountMatch) {
    let amount = amountMatch[1].replace(/,/g, '');
    if (amount.toLowerCase().includes('k')) {
      amount = String(parseFloat(amount) * 1000);
    } else if (amount.toLowerCase().includes('m')) {
      amount = String(parseFloat(amount) * 1000000);
    }
    opp.amount = parseFloat(amount);
  }

  // Close date
  const datePatterns = [
    /(?:close|closing|closes?)\s*(?:by|on|in)?\s*(?:end of\s*)?(\w+)/i,
    /(?:expected|targeting)\s*(?:close)?\s*(\w+)/i,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const when = match[1].toLowerCase();
      const now = new Date();
      if (when.includes('month') || when.includes('eom')) {
        opp.expectedCloseDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (when.includes('quarter') || when.includes('eoq')) {
        const qEnd = Math.ceil((now.getMonth() + 1) / 3) * 3;
        opp.expectedCloseDate = new Date(now.getFullYear(), qEnd, 0);
      } else if (when.includes('week')) {
        opp.expectedCloseDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      break;
    }
  }

  // Source
  if (text.match(/from rfq|rfq\s*#?\d|buyer request/i)) {
    opp.source = 'rfq';
  } else if (text.match(/outbound|prospected|reached out/i)) {
    opp.source = 'outbound';
  } else if (text.match(/inbound|came to us|requested|contacted us/i)) {
    opp.source = 'inbound';
  } else if (text.match(/referral|referred/i)) {
    opp.source = 'referral';
  }

  // Next step
  const nextMatch = text.match(/(?:next step|next|action)\s*(?:is|:)?\s*(.+?)(?:\.|$)/i);
  if (nextMatch) {
    opp.nextStep = nextMatch[1].trim();
  }

  return opp;
}

export function parseStageActionFromText(
  text: string,
  stages: PipelineStage[]
): {
  action: 'move' | 'close_won' | 'close_lost';
  stageId?: string;
  notes?: string;
  lostReason?: string;
  finalAmount?: number;
} | null {
  // Close won
  if (text.match(/close.*won|won.*deal|deal.*closed|we won/i)) {
    const amountMatch = text.match(/\$?([\d,]+)/);
    return {
      action: 'close_won',
      finalAmount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined,
      notes: text,
    };
  }

  // Close lost
  if (text.match(/close.*lost|lost.*deal|we lost|didn't win/i)) {
    const reasonMatch = text.match(/(?:because|reason|due to)\s*(.+?)(?:\.|$)/i);
    return {
      action: 'close_lost',
      lostReason: reasonMatch ? reasonMatch[1].trim() : 'No reason provided',
    };
  }

  // Move to stage
  const moveMatch = text.match(/(?:move|advance|progress)\s*(?:to|into)?\s*(.+?)(?:\s*stage)?$/i);
  if (moveMatch) {
    const targetStageName = moveMatch[1].trim().toLowerCase();
    const matchingStage = stages.find(
      (s) =>
        s.name.toLowerCase() === targetStageName ||
        s.name.toLowerCase().includes(targetStageName)
    );
    if (matchingStage) {
      return {
        action: 'move',
        stageId: matchingStage.id,
        notes: text,
      };
    }
  }

  return null;
}

// =====================================================
// ROW MAPPERS
// =====================================================

function mapRowToOpportunity(row: any): Opportunity {
  return {
    id: row.id,
    sellerId: row.seller_id,
    leadId: row.lead_id,
    rfqId: row.rfq_id,
    name: row.name,
    description: row.description,
    amount: parseFloat(row.amount),
    currency: row.currency,
    probability: parseFloat(row.probability),
    weightedAmount: parseFloat(row.weighted_amount),
    stageId: row.stage_id,
    stageEnteredAt: new Date(row.stage_entered_at),
    stage: row.stage_name
      ? {
          id: row.stage_id,
          sellerId: row.seller_id,
          name: row.stage_name,
          orderIndex: 0,
          probability: parseFloat(row.stage_probability || 0),
          isWon: false,
          isLost: false,
          isActive: true,
          createdAt: new Date(),
        }
      : undefined,
    source: row.source,
    campaignId: row.campaign_id,
    expectedCloseDate: row.expected_close_date ? new Date(row.expected_close_date) : undefined,
    lineItems: row.line_items,
    competitors: row.competitors,
    competitiveNotes: row.competitive_notes,
    nextStep: row.next_step,
    nextStepDate: row.next_step_date ? new Date(row.next_step_date) : undefined,
    status: row.status,
    wonAt: row.won_at ? new Date(row.won_at) : undefined,
    lostAt: row.lost_at ? new Date(row.lost_at) : undefined,
    lostReason: row.lost_reason,
    dealId: row.deal_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToActivity(row: any): OpportunityActivity {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    sellerId: row.seller_id,
    type: row.type,
    title: row.title,
    description: row.description,
    outreachId: row.outreach_id,
    quoteId: row.quote_id,
    negotiationId: row.negotiation_id,
    fromStageId: row.from_stage_id,
    toStageId: row.to_stage_id,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    outcome: row.outcome,
    createdAt: new Date(row.created_at),
  };
}
