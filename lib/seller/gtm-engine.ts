/**
 * Seller GTM Engine
 * Proactive selling - lead discovery, enrichment, and outreach through conversation
 */

import { sqlQuery as sql } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import {
  ICP,
  Lead,
  LeadStatus,
  BuyingSignal,
  Campaign,
  CampaignStep,
  Outreach,
  SellerProfile,
} from './types';
import { getSellerProfile } from './profile-service';

const anthropic = new Anthropic();

// =====================================================
// ICP MANAGEMENT
// =====================================================

export async function getICPs(sellerId: string): Promise<ICP[]> {
  const result = await sql`
    SELECT * FROM seller_icps
    WHERE seller_id = ${sellerId} AND is_active = true
    ORDER BY created_at DESC
  `;

  return result.rows.map(mapRowToICP);
}

export async function createICP(
  sellerId: string,
  data: Partial<ICP>
): Promise<ICP> {
  const result = await sql`
    INSERT INTO seller_icps (
      seller_id, name, description,
      industries, company_sizes, company_size_min, company_size_max,
      revenue_min, revenue_max, locations,
      target_titles, decision_maker_level,
      buying_signals, technologies,
      weights
    ) VALUES (
      ${sellerId},
      ${data.name || 'My ICP'},
      ${data.description || null},
      ${data.industries || null},
      ${data.companySizes || null},
      ${data.companySizeMin || null},
      ${data.companySizeMax || null},
      ${data.revenueMin || null},
      ${data.revenueMax || null},
      ${data.locations || null},
      ${data.targetTitles || null},
      ${data.decisionMakerLevel || null},
      ${data.buyingSignals || null},
      ${data.technologies || null},
      ${JSON.stringify(data.weights || { industry: 25, size: 25, title: 25, signals: 15, location: 10 })}
    )
    RETURNING *
  `;

  return mapRowToICP(result.rows[0]);
}

export async function updateICP(
  icpId: string,
  updates: Partial<ICP>
): Promise<ICP> {
  const result = await sql`
    UPDATE seller_icps
    SET
      name = COALESCE(${updates.name}, name),
      description = COALESCE(${updates.description}, description),
      industries = COALESCE(${updates.industries}, industries),
      company_sizes = COALESCE(${updates.companySizes}, company_sizes),
      target_titles = COALESCE(${updates.targetTitles}, target_titles),
      buying_signals = COALESCE(${updates.buyingSignals}, buying_signals),
      locations = COALESCE(${updates.locations}, locations),
      updated_at = NOW()
    WHERE id = ${icpId}
    RETURNING *
  `;

  return mapRowToICP(result.rows[0]);
}

// =====================================================
// LEAD DISCOVERY
// =====================================================

/**
 * Discover leads based on ICP through conversation
 * In production, this would integrate with Apollo, LinkedIn, etc.
 */
export async function discoverLeads(
  sellerId: string,
  options: {
    icpId?: string;
    source?: string;
    limit?: number;
  } = {}
): Promise<{
  leads: Lead[];
  summary: string;
}> {
  const profile = await getSellerProfile(sellerId);
  if (!profile) throw new Error('Seller profile not found');

  const limit = options.limit || 20;

  // Get ICP if specified
  let icp: ICP | null = null;
  if (options.icpId) {
    const icpResult = await sql`SELECT * FROM seller_icps WHERE id = ${options.icpId}`;
    if (icpResult.rows.length > 0) {
      icp = mapRowToICP(icpResult.rows[0]);
    }
  }

  // In production, we'd call Apollo API, LinkedIn Sales Navigator, etc.
  // For now, simulate discovery with AI-generated sample leads
  const simulatedLeads = await generateSimulatedLeads(profile, icp, limit);

  // Store leads in database
  const storedLeads: Lead[] = [];
  for (const lead of simulatedLeads) {
    const result = await sql`
      INSERT INTO seller_leads (
        seller_id, icp_id,
        company_name, company_domain, company_linkedin,
        company_industry, company_size, company_employee_count,
        company_location, company_description,
        contact_name, contact_title, contact_email, contact_linkedin,
        lead_score, score_breakdown, buying_signals,
        source, status
      ) VALUES (
        ${sellerId},
        ${options.icpId || null},
        ${lead.companyName},
        ${lead.companyDomain || null},
        ${lead.companyLinkedin || null},
        ${lead.companyIndustry || null},
        ${lead.companySize || null},
        ${lead.companyEmployeeCount || null},
        ${lead.companyLocation || null},
        ${lead.companyDescription || null},
        ${lead.contactName || null},
        ${lead.contactTitle || null},
        ${lead.contactEmail || null},
        ${lead.contactLinkedin || null},
        ${lead.leadScore},
        ${JSON.stringify(lead.scoreBreakdown || {})},
        ${JSON.stringify(lead.buyingSignals || [])},
        ${options.source || 'wells_network'},
        'new'
      )
      RETURNING *
    `;

    storedLeads.push(mapRowToLead(result.rows[0]));
  }

  // Generate summary
  const avgScore = storedLeads.reduce((sum, l) => sum + l.leadScore, 0) / storedLeads.length;
  const highScoreCount = storedLeads.filter((l) => l.leadScore >= 70).length;

  const summary = `Found ${storedLeads.length} new leads. ${highScoreCount} are high-priority (score 70+). Average fit score is ${Math.round(avgScore)}. Top industries: ${[...new Set(storedLeads.map((l) => l.companyIndustry))].slice(0, 3).join(', ')}.`;

  return { leads: storedLeads, summary };
}

/**
 * Get leads for this seller
 */
export async function getLeads(
  sellerId: string,
  filters: {
    status?: LeadStatus | LeadStatus[];
    minScore?: number;
    icpId?: string;
    limit?: number;
  } = {}
): Promise<Lead[]> {
  const limit = filters.limit || 50;

  let query;
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = sql`
      SELECT * FROM seller_leads
      WHERE seller_id = ${sellerId}
        AND status = ANY(${statuses})
        AND lead_score >= ${filters.minScore || 0}
      ORDER BY lead_score DESC, created_at DESC
      LIMIT ${limit}
    `;
  } else {
    query = sql`
      SELECT * FROM seller_leads
      WHERE seller_id = ${sellerId}
        AND lead_score >= ${filters.minScore || 0}
      ORDER BY lead_score DESC, created_at DESC
      LIMIT ${limit}
    `;
  }

  const result = await query;
  return result.rows.map(mapRowToLead);
}

/**
 * Qualify a lead (update status from conversation)
 */
export async function qualifyLead(
  leadId: string,
  qualified: boolean,
  notes?: string
): Promise<Lead> {
  const status = qualified ? 'qualified' : 'nurture';
  const result = await sql`
    UPDATE seller_leads
    SET
      status = ${status},
      qualified_at = ${qualified ? new Date() : null},
      updated_at = NOW()
    WHERE id = ${leadId}
    RETURNING *
  `;

  return mapRowToLead(result.rows[0]);
}

/**
 * Update lead status
 */
export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus
): Promise<Lead> {
  const result = await sql`
    UPDATE seller_leads
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${leadId}
    RETURNING *
  `;

  return mapRowToLead(result.rows[0]);
}

// =====================================================
// OUTREACH GENERATION
// =====================================================

/**
 * Generate personalized outreach through AI
 */
export async function generateOutreach(
  sellerId: string,
  leadId: string,
  options: {
    channel?: 'email' | 'linkedin';
    tone?: 'formal' | 'casual' | 'friendly';
    focus?: string;
    campaignId?: string;
    stepNumber?: number;
  } = {}
): Promise<{
  outreach: Outreach;
  preview: string;
}> {
  const profile = await getSellerProfile(sellerId);
  if (!profile) throw new Error('Seller profile not found');

  const leadResult = await sql`SELECT * FROM seller_leads WHERE id = ${leadId}`;
  if (leadResult.rows.length === 0) throw new Error('Lead not found');
  const lead = mapRowToLead(leadResult.rows[0]);

  const channel = options.channel || 'email';
  const tone = options.tone || 'friendly';

  // Generate with AI
  const aiResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `You are a sales AI writing outreach for ${profile.companyName}.

Write a ${channel} message to:
- Contact: ${lead.contactName || 'the decision maker'}
- Title: ${lead.contactTitle || 'Executive'}
- Company: ${lead.companyName}
- Industry: ${lead.companyIndustry || 'Unknown'}
- Company Size: ${lead.companyEmployeeCount || 'Unknown'} employees

About us:
- Company: ${profile.companyName}
- What we do: ${profile.companyDescription || profile.categories?.join(', ')}
- Industry: ${profile.industry}

Buying signals detected: ${lead.buyingSignals?.map((s) => s.signal).join(', ') || 'None specific'}

Focus: ${options.focus || 'general value proposition'}
Tone: ${tone}
Step: ${options.stepNumber || 1} (first touch if 1)

${channel === 'email' ? 'Include subject line on first line.' : 'Keep under 300 characters for LinkedIn.'}

Be conversational, specific, and avoid generic phrases. Reference something specific about their company if possible. End with a soft CTA - asking a question works best.`,
      },
    ],
  });

  const aiText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';
  let subject: string | undefined;
  let body: string;

  if (channel === 'email') {
    const lines = aiText.split('\n');
    const subjectLine = lines.find((l) => l.toLowerCase().startsWith('subject:'));
    subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, '').trim() : lines[0];
    body = lines.slice(subjectLine ? 1 : 1).join('\n').trim();
  } else {
    body = aiText.slice(0, 300);
  }

  // Store outreach
  const outreachResult = await sql`
    INSERT INTO seller_outreach (
      seller_id, campaign_id, lead_id,
      channel, step_number, subject, body,
      ai_generated, ai_personalization_data,
      status
    ) VALUES (
      ${sellerId},
      ${options.campaignId || null},
      ${leadId},
      ${channel},
      ${options.stepNumber || 1},
      ${subject || null},
      ${body},
      true,
      ${JSON.stringify({
        leadScore: lead.leadScore,
        signals: lead.buyingSignals,
        tone,
        focus: options.focus,
      })},
      'pending'
    )
    RETURNING *
  `;

  const outreach = mapRowToOutreach(outreachResult.rows[0]);

  // Update lead status
  await sql`
    UPDATE seller_leads
    SET status = 'outreach', updated_at = NOW()
    WHERE id = ${leadId} AND status IN ('new', 'qualified')
  `;

  const preview = channel === 'email'
    ? `**Subject:** ${subject}\n\n${body}`
    : body;

  return { outreach, preview };
}

/**
 * Send outreach (mark as sent, would integrate with email/LinkedIn APIs)
 */
export async function sendOutreach(outreachId: string): Promise<Outreach> {
  // In production, this would:
  // 1. Send via Resend/SendGrid for email
  // 2. Call LinkedIn API for LinkedIn messages
  // 3. Update tracking

  const result = await sql`
    UPDATE seller_outreach
    SET status = 'sent', sent_at = NOW(), updated_at = NOW()
    WHERE id = ${outreachId}
    RETURNING *
  `;

  return mapRowToOutreach(result.rows[0]);
}

/**
 * Get pending outreach for review
 */
export async function getPendingOutreach(sellerId: string): Promise<Outreach[]> {
  const result = await sql`
    SELECT o.*, l.company_name, l.contact_name, l.contact_title
    FROM seller_outreach o
    JOIN seller_leads l ON o.lead_id = l.id
    WHERE o.seller_id = ${sellerId} AND o.status = 'pending'
    ORDER BY o.created_at DESC
    LIMIT 20
  `;

  return result.rows.map(mapRowToOutreach);
}

// =====================================================
// CAMPAIGN MANAGEMENT
// =====================================================

export async function createCampaign(
  sellerId: string,
  data: Partial<Campaign>
): Promise<Campaign> {
  const result = await sql`
    INSERT INTO seller_campaigns (
      seller_id, icp_id, name, description, type,
      target_lead_score_min, target_statuses, max_leads_per_day,
      templates,
      ai_personalization, ai_timing_optimization, ai_ab_testing,
      send_days, send_hours_start, send_hours_end, timezone,
      daily_send_limit, total_budget,
      status
    ) VALUES (
      ${sellerId},
      ${data.icpId || null},
      ${data.name || 'New Campaign'},
      ${data.description || null},
      ${data.type || 'email_sequence'},
      ${data.targetLeadScoreMin || 50},
      ${data.targetStatuses || ['new', 'qualified']},
      ${data.maxLeadsPerDay || 50},
      ${JSON.stringify(data.templates || [])},
      ${data.aiPersonalization ?? true},
      ${data.aiTimingOptimization ?? true},
      ${data.aiAbTesting ?? false},
      ${data.sendDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']},
      ${data.sendHoursStart || 9},
      ${data.sendHoursEnd || 17},
      ${data.timezone || 'America/New_York'},
      ${data.dailySendLimit || 100},
      ${data.totalBudget || null},
      'draft'
    )
    RETURNING *
  `;

  return mapRowToCampaign(result.rows[0]);
}

export async function getCampaigns(
  sellerId: string,
  status?: string
): Promise<Campaign[]> {
  let query;
  if (status) {
    query = sql`
      SELECT * FROM seller_campaigns
      WHERE seller_id = ${sellerId} AND status = ${status}
      ORDER BY created_at DESC
    `;
  } else {
    query = sql`
      SELECT * FROM seller_campaigns
      WHERE seller_id = ${sellerId}
      ORDER BY created_at DESC
    `;
  }

  const result = await query;
  return result.rows.map(mapRowToCampaign);
}

export async function startCampaign(campaignId: string): Promise<Campaign> {
  const result = await sql`
    UPDATE seller_campaigns
    SET status = 'active', started_at = NOW(), updated_at = NOW()
    WHERE id = ${campaignId}
    RETURNING *
  `;

  return mapRowToCampaign(result.rows[0]);
}

export async function pauseCampaign(campaignId: string): Promise<Campaign> {
  const result = await sql`
    UPDATE seller_campaigns
    SET status = 'paused', paused_at = NOW(), updated_at = NOW()
    WHERE id = ${campaignId}
    RETURNING *
  `;

  return mapRowToCampaign(result.rows[0]);
}

// =====================================================
// CONVERSATIONAL PARSING
// =====================================================

export function parseICPFromText(text: string): Partial<ICP> {
  const icp: Partial<ICP> = {};

  // Name
  const nameMatch = text.match(/(?:called?|named?|icp|profile)\s*["']?([^"',.\n]+)/i);
  if (nameMatch) {
    icp.name = nameMatch[1].trim();
  }

  // Industries
  const industryPatterns = [
    /(?:targeting?|focus on|in the|industries?)\s*(?:like|such as|including)?\s*(.+?)(?:\.|,\s*(?:and|who|that)|$)/i,
  ];
  for (const pattern of industryPatterns) {
    const match = text.match(pattern);
    if (match) {
      icp.industries = match[1].split(/,|and/).map((i) => i.trim()).filter((i) => i.length > 2);
      break;
    }
  }

  // Company sizes
  if (text.match(/enterprise|large compan/i)) {
    icp.companySizes = icp.companySizes || [];
    icp.companySizes.push('enterprise');
  }
  if (text.match(/mid-?market|medium|mid-?size/i)) {
    icp.companySizes = icp.companySizes || [];
    icp.companySizes.push('medium');
  }
  if (text.match(/small business|smb|startup/i)) {
    icp.companySizes = icp.companySizes || [];
    icp.companySizes.push('small', 'startup');
  }

  // Titles
  const titleMatch = text.match(/(?:talk to|reach|contact|targeting?)\s*(?:the)?\s*((?:c[\w-]+|vp|director|manager|head|chief)[^,.\n]*)/gi);
  if (titleMatch) {
    icp.targetTitles = titleMatch.map((t) =>
      t.replace(/(?:talk to|reach|contact|targeting?)\s*(?:the)?\s*/i, '').trim()
    );
  }

  // Locations
  const locationMatch = text.match(/(?:in|based in|located in|from)\s+([A-Z][a-z]+(?:\s*,?\s*[A-Z]{2})?(?:\s*,\s*[A-Z][a-z]+(?:\s*,?\s*[A-Z]{2})?)*)/i);
  if (locationMatch) {
    icp.locations = locationMatch[1].split(/,/).map((l) => l.trim());
  }

  // Buying signals
  const signalPatterns = [
    { pattern: /funding|raised|series [a-d]/i, signal: 'funding_round' },
    { pattern: /hiring|growing|expanding/i, signal: 'hiring_spree' },
    { pattern: /new office|relocat|moving/i, signal: 'new_office' },
    { pattern: /merger|acqui/i, signal: 'ma_activity' },
  ];
  for (const { pattern, signal } of signalPatterns) {
    if (text.match(pattern)) {
      icp.buyingSignals = icp.buyingSignals || [];
      icp.buyingSignals.push(signal);
    }
  }

  return icp;
}

export function parseLeadActionFromText(text: string): {
  action: 'qualify' | 'disqualify' | 'nurture' | 'outreach' | 'research';
  notes?: string;
} | null {
  if (text.match(/qualify|looks? good|great fit|move forward/i)) {
    return { action: 'qualify' };
  }
  if (text.match(/disqualify|not a fit|skip|pass/i)) {
    return { action: 'disqualify' };
  }
  if (text.match(/nurture|keep warm|follow up later/i)) {
    return { action: 'nurture' };
  }
  if (text.match(/reach out|contact|send|outreach/i)) {
    return { action: 'outreach' };
  }
  if (text.match(/research|learn more|dig into/i)) {
    return { action: 'research' };
  }
  return null;
}

// =====================================================
// SIMULATED LEAD GENERATION
// =====================================================

async function generateSimulatedLeads(
  profile: SellerProfile,
  icp: ICP | null,
  count: number
): Promise<Partial<Lead>[]> {
  // In production, this calls Apollo, LinkedIn, etc.
  // For demo, generate realistic-looking leads

  const industries = icp?.industries || profile.gtmTargetIndustries || ['Technology', 'Healthcare', 'Finance'];
  const sizes = icp?.companySizes || profile.gtmTargetCompanySizes || ['medium', 'enterprise'];
  const titles = icp?.targetTitles || ['VP Operations', 'CFO', 'Head of Procurement'];
  const locations = icp?.locations || profile.gtmTargetLocations || ['New York, NY', 'San Francisco, CA', 'Miami, FL'];

  const companyPrefixes = ['Acme', 'Global', 'Premier', 'NextGen', 'Quantum', 'Apex', 'Summit', 'Catalyst', 'Velocity', 'Horizon'];
  const companySuffixes = ['Solutions', 'Systems', 'Technologies', 'Group', 'Partners', 'Industries', 'Corp', 'Inc'];

  const leads: Partial<Lead>[] = [];

  for (let i = 0; i < count; i++) {
    const industry = industries[Math.floor(Math.random() * industries.length)];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    const title = titles[Math.floor(Math.random() * titles.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];

    const companyName = `${companyPrefixes[Math.floor(Math.random() * companyPrefixes.length)]} ${companySuffixes[Math.floor(Math.random() * companySuffixes.length)]}`;
    const firstName = ['John', 'Sarah', 'Michael', 'Jennifer', 'David', 'Lisa', 'Robert', 'Michelle'][Math.floor(Math.random() * 8)];
    const lastName = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'][Math.floor(Math.random() * 8)];

    const employeeCount =
      size === 'enterprise' ? 1000 + Math.floor(Math.random() * 9000) :
      size === 'medium' ? 100 + Math.floor(Math.random() * 900) :
      10 + Math.floor(Math.random() * 90);

    const signals: BuyingSignal[] = [];
    if (Math.random() > 0.7) {
      signals.push({ signal: 'funding_round', detectedAt: new Date() });
    }
    if (Math.random() > 0.6) {
      signals.push({ signal: 'hiring_spree', detectedAt: new Date() });
    }

    const score = Math.floor(50 + Math.random() * 50);

    leads.push({
      companyName,
      companyDomain: `${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      companyIndustry: industry,
      companySize: size,
      companyEmployeeCount: employeeCount,
      companyLocation: location,
      contactName: `${firstName} ${lastName}`,
      contactTitle: title,
      contactEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      leadScore: score,
      buyingSignals: signals,
      source: 'wells_network' as const,
      status: 'new' as LeadStatus,
    });
  }

  return leads;
}

// =====================================================
// ROW MAPPERS
// =====================================================

function mapRowToICP(row: any): ICP {
  return {
    id: row.id,
    sellerId: row.seller_id,
    name: row.name,
    description: row.description,
    industries: row.industries,
    companySizes: row.company_sizes,
    companySizeMin: row.company_size_min,
    companySizeMax: row.company_size_max,
    revenueMin: row.revenue_min ? parseFloat(row.revenue_min) : undefined,
    revenueMax: row.revenue_max ? parseFloat(row.revenue_max) : undefined,
    locations: row.locations,
    targetTitles: row.target_titles,
    decisionMakerLevel: row.decision_maker_level,
    buyingSignals: row.buying_signals,
    technologies: row.technologies,
    weights: row.weights,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToLead(row: any): Lead {
  return {
    id: row.id,
    sellerId: row.seller_id,
    icpId: row.icp_id,
    companyName: row.company_name,
    companyDomain: row.company_domain,
    companyLinkedin: row.company_linkedin,
    companyIndustry: row.company_industry,
    companySize: row.company_size,
    companyEmployeeCount: row.company_employee_count,
    companyRevenueEstimate: row.company_revenue_estimate ? parseFloat(row.company_revenue_estimate) : undefined,
    companyLocation: row.company_location,
    companyDescription: row.company_description,
    contactName: row.contact_name,
    contactTitle: row.contact_title,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    contactLinkedin: row.contact_linkedin,
    leadScore: row.lead_score,
    scoreBreakdown: row.score_breakdown,
    buyingSignals: row.buying_signals,
    source: row.source,
    sourceData: row.source_data,
    status: row.status,
    qualifiedAt: row.qualified_at ? new Date(row.qualified_at) : undefined,
    enriched: row.enriched,
    enrichedAt: row.enriched_at ? new Date(row.enriched_at) : undefined,
    enrichmentData: row.enrichment_data,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToOutreach(row: any): Outreach {
  return {
    id: row.id,
    sellerId: row.seller_id,
    campaignId: row.campaign_id,
    leadId: row.lead_id,
    channel: row.channel,
    stepNumber: row.step_number,
    subject: row.subject,
    body: row.body,
    aiGenerated: row.ai_generated,
    aiPersonalizationData: row.ai_personalization_data,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
    sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
    status: row.status,
    openedAt: row.opened_at ? new Date(row.opened_at) : undefined,
    clickedAt: row.clicked_at ? new Date(row.clicked_at) : undefined,
    repliedAt: row.replied_at ? new Date(row.replied_at) : undefined,
    responseText: row.response_text,
    responseSentiment: row.response_sentiment,
    nextAction: row.next_action,
    nextActionAt: row.next_action_at ? new Date(row.next_action_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    sellerId: row.seller_id,
    icpId: row.icp_id,
    name: row.name,
    description: row.description,
    type: row.type,
    targetLeadScoreMin: row.target_lead_score_min,
    targetStatuses: row.target_statuses,
    maxLeadsPerDay: row.max_leads_per_day,
    templates: row.templates || [],
    aiPersonalization: row.ai_personalization,
    aiTimingOptimization: row.ai_timing_optimization,
    aiAbTesting: row.ai_ab_testing,
    sendDays: row.send_days,
    sendHoursStart: row.send_hours_start,
    sendHoursEnd: row.send_hours_end,
    timezone: row.timezone,
    dailySendLimit: row.daily_send_limit,
    totalBudget: row.total_budget ? parseFloat(row.total_budget) : undefined,
    status: row.status,
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    pausedAt: row.paused_at ? new Date(row.paused_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    stats: {
      totalSent: row.total_sent || 0,
      totalOpened: row.total_opened || 0,
      totalClicked: row.total_clicked || 0,
      totalReplied: row.total_replied || 0,
      totalMeetings: row.total_meetings || 0,
      totalOpportunities: row.total_opportunities || 0,
    },
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
