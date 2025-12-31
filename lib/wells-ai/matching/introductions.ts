/**
 * Wells AI Introduction System
 *
 * Facilitates first contact between matched buyers and suppliers.
 * - Generate personalized intro messages
 * - Track intro status (sent, viewed, responded)
 * - Move to deal room when both parties are interested
 */

import { sql } from '@vercel/postgres';
import {
  Introduction,
  IntroStatus,
  SourcingMatch,
  SourcingRequest,
  SupplierProfile,
  GeneratedIntroMessage,
} from './types';
import { generateIntroMessages, summarizeSupplierForBuyer } from './ai-assist';
import { sendEmail } from '@/lib/email';

// ============================================================================
// INTRODUCTION CREATION
// ============================================================================

/**
 * Create and send an introduction between buyer and supplier
 */
export async function createIntroduction(
  matchId: string,
  options?: {
    customBuyerMessage?: string;
    customSupplierMessage?: string;
    sendImmediately?: boolean;
  }
): Promise<Introduction> {
  // Get match details
  const match = await getMatch(matchId);
  if (!match) {
    throw new Error(`Match not found: ${matchId}`);
  }

  // Get request and supplier details
  const [request, supplier] = await Promise.all([
    getRequest(match.requestId),
    getSupplier(match.supplierId),
  ]);

  if (!request || !supplier) {
    throw new Error('Request or supplier not found');
  }

  // Generate intro messages (AI-powered)
  const messages = options?.customBuyerMessage && options?.customSupplierMessage
    ? {
        forBuyer: { subject: `Match: ${supplier.companyName}`, body: options.customBuyerMessage },
        forSupplier: { subject: `Opportunity: ${request.title}`, body: options.customSupplierMessage },
      }
    : await generateIntroMessages(
        request,
        supplier,
        match.overallScore,
        match.strengths
      );

  // Generate summaries
  const supplierSummary = await summarizeSupplierForBuyer(supplier, request);
  const requestSummary = summarizeRequest(request);

  // Create introduction record
  const intro: Introduction = {
    id: generateId(),
    matchId,
    requestId: request.id,
    buyerId: request.buyerId,
    supplierId: supplier.id,
    buyerIntroMessage: messages.forBuyer.body,
    supplierIntroMessage: messages.forSupplier.body,
    requestSummary,
    supplierSummary: supplierSummary.headline,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Store in database
  await storeIntroduction(intro);

  // Update match with introduction ID
  await updateMatchIntroduction(matchId, intro.id);

  // Send if requested
  if (options?.sendImmediately) {
    await sendIntroduction(intro.id);
  }

  return intro;
}

/**
 * Send a draft introduction
 */
export async function sendIntroduction(introductionId: string): Promise<Introduction> {
  const intro = await getIntroduction(introductionId);
  if (!intro) {
    throw new Error(`Introduction not found: ${introductionId}`);
  }

  if (intro.status !== 'draft') {
    throw new Error(`Introduction already sent (status: ${intro.status})`);
  }

  // Get details for email
  const [request, supplier] = await Promise.all([
    getRequest(intro.requestId),
    getSupplier(intro.supplierId),
  ]);

  if (!request || !supplier) {
    throw new Error('Request or supplier not found');
  }

  // Send emails
  await Promise.all([
    // Email to buyer
    sendIntroEmailToBuyer(intro, request, supplier),
    // Email to supplier
    sendIntroEmailToSupplier(intro, request, supplier),
  ]);

  // Update status
  const updatedIntro = await updateIntroductionStatus(introductionId, 'sent', {
    sentAt: new Date(),
  });

  return updatedIntro;
}

// ============================================================================
// RESPONSE HANDLING
// ============================================================================

/**
 * Record buyer viewing the introduction
 */
export async function recordBuyerView(introductionId: string): Promise<Introduction> {
  const intro = await getIntroduction(introductionId);
  if (!intro) {
    throw new Error(`Introduction not found: ${introductionId}`);
  }

  if (!intro.buyerOpenedAt) {
    return updateIntroductionStatus(
      introductionId,
      intro.status === 'sent' ? 'opened' : intro.status,
      { buyerOpenedAt: new Date() }
    );
  }

  return intro;
}

/**
 * Record supplier viewing the introduction
 */
export async function recordSupplierView(introductionId: string): Promise<Introduction> {
  const intro = await getIntroduction(introductionId);
  if (!intro) {
    throw new Error(`Introduction not found: ${introductionId}`);
  }

  if (!intro.supplierOpenedAt) {
    return updateIntroductionStatus(introductionId, intro.status, {
      supplierOpenedAt: new Date(),
    });
  }

  return intro;
}

/**
 * Record buyer's response to the introduction
 */
export async function recordBuyerResponse(
  introductionId: string,
  response: 'interested' | 'passed' | 'need_more_info'
): Promise<Introduction> {
  const intro = await getIntroduction(introductionId);
  if (!intro) {
    throw new Error(`Introduction not found: ${introductionId}`);
  }

  // Determine new status
  let newStatus: IntroStatus = intro.status;
  if (response === 'interested') {
    if (intro.supplierResponse === 'interested') {
      newStatus = 'mutual_interest';
    } else {
      newStatus = 'buyer_interested';
    }
  } else if (response === 'passed') {
    newStatus = 'buyer_passed';
  }

  const updatedIntro = await updateIntroductionStatus(introductionId, newStatus, {
    buyerRespondedAt: new Date(),
    buyerResponse: response,
  });

  // If mutual interest, create deal room
  if (newStatus === 'mutual_interest') {
    await createDealRoom(updatedIntro);
  }

  // Notify supplier of buyer interest
  if (response === 'interested') {
    await notifySupplierOfBuyerInterest(updatedIntro);
  }

  return updatedIntro;
}

/**
 * Record supplier's response to the introduction
 */
export async function recordSupplierResponse(
  introductionId: string,
  response: 'interested' | 'passed' | 'need_more_info'
): Promise<Introduction> {
  const intro = await getIntroduction(introductionId);
  if (!intro) {
    throw new Error(`Introduction not found: ${introductionId}`);
  }

  // Determine new status
  let newStatus: IntroStatus = intro.status;
  if (response === 'interested') {
    if (intro.buyerResponse === 'interested') {
      newStatus = 'mutual_interest';
    } else {
      newStatus = 'supplier_interested';
    }
  } else if (response === 'passed') {
    newStatus = 'supplier_passed';
  }

  const updatedIntro = await updateIntroductionStatus(introductionId, newStatus, {
    supplierRespondedAt: new Date(),
    supplierResponse: response,
  });

  // If mutual interest, create deal room
  if (newStatus === 'mutual_interest') {
    await createDealRoom(updatedIntro);
  }

  // Notify buyer of supplier interest
  if (response === 'interested') {
    await notifyBuyerOfSupplierInterest(updatedIntro);
  }

  return updatedIntro;
}

// ============================================================================
// DEAL ROOM CREATION
// ============================================================================

/**
 * Create a deal room when both parties express interest
 */
async function createDealRoom(intro: Introduction): Promise<string> {
  const dealRoomId = `deal_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    // Create deal room record
    await sql`
      INSERT INTO deal_rooms (
        id, introduction_id, request_id, buyer_id, supplier_id,
        status, created_at, updated_at
      ) VALUES (
        ${dealRoomId}, ${intro.id}, ${intro.requestId},
        ${intro.buyerId}, ${intro.supplierId},
        'active', NOW(), NOW()
      )
    `;

    // Update introduction with deal room ID
    await updateIntroductionStatus(intro.id, 'deal_room_created', {
      dealRoomCreatedAt: new Date(),
      dealRoomId,
    });

    // Update match with deal room ID
    const match = await sql`
      SELECT id FROM sourcing_matches WHERE id = ${intro.matchId}
    `;
    if (match.rows.length > 0) {
      await sql`
        UPDATE sourcing_matches
        SET deal_room_id = ${dealRoomId}, status = 'deal_started', updated_at = NOW()
        WHERE id = ${intro.matchId}
      `;
    }

    // Send deal room notifications
    await sendDealRoomNotifications(intro, dealRoomId);

    console.log(`[Introductions] Deal room created: ${dealRoomId}`);
  } catch (error) {
    console.error('Error creating deal room:', error);
  }

  return dealRoomId;
}

// ============================================================================
// EMAIL HELPERS
// ============================================================================

async function sendIntroEmailToBuyer(
  intro: Introduction,
  request: SourcingRequest,
  supplier: SupplierProfile
): Promise<void> {
  const viewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/introductions/${intro.id}?party=buyer`;
  const respondUrl = `${process.env.NEXT_PUBLIC_APP_URL}/introductions/${intro.id}/respond?party=buyer`;

  const html = `
    <h2>We Found a Match for Your Request</h2>
    <p>Hi ${request.buyerName || 'there'},</p>
    <p>Great news! We've identified a potential supplier for your request: <strong>${request.title}</strong></p>

    <h3>Matched Supplier: ${supplier.companyName}</h3>
    <p>${intro.supplierSummary}</p>

    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      ${intro.buyerIntroMessage.replace(/\n/g, '<br>')}
    </div>

    <p><strong>Trust Level:</strong> ${supplier.trustTier.charAt(0).toUpperCase() + supplier.trustTier.slice(1)}</p>
    ${supplier.grainEnabled ? '<p><strong>GRAIN Enabled:</strong> Secure, instant payments available</p>' : ''}

    <div style="margin: 30px 0;">
      <a href="${respondUrl}&response=interested"
         style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 10px;">
        I'm Interested
      </a>
      <a href="${respondUrl}&response=need_more_info"
         style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 10px;">
        Need More Info
      </a>
      <a href="${respondUrl}&response=passed"
         style="background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Not a Fit
      </a>
    </div>

    <p style="color: #666; font-size: 12px;">
      This introduction was generated by Wells AI matching. We earn a small fee only when transactions complete.
    </p>
  `;

  await sendEmail({
    to: request.buyerEmail || '',
    subject: `Supplier Match: ${supplier.companyName} for ${request.title}`,
    html,
  });
}

async function sendIntroEmailToSupplier(
  intro: Introduction,
  request: SourcingRequest,
  supplier: SupplierProfile
): Promise<void> {
  const viewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/introductions/${intro.id}?party=supplier`;
  const respondUrl = `${process.env.NEXT_PUBLIC_APP_URL}/introductions/${intro.id}/respond?party=supplier`;

  const html = `
    <h2>New Opportunity Match</h2>
    <p>Hi ${supplier.companyName} team,</p>
    <p>We've matched you with a buyer looking for products in your category!</p>

    <h3>Opportunity: ${request.title}</h3>
    <p>${intro.requestSummary}</p>

    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      ${intro.supplierIntroMessage.replace(/\n/g, '<br>')}
    </div>

    <p><strong>Quantity:</strong> ${request.quantity} ${request.quantityUnit}</p>
    <p><strong>Frequency:</strong> ${request.frequency}</p>
    <p><strong>Location:</strong> ${request.deliveryLocation}</p>
    <p><strong>Urgency:</strong> ${request.urgency}</p>
    ${request.targetPrice ? `<p><strong>Target Budget:</strong> $${request.targetPrice.toLocaleString()}</p>` : ''}

    <div style="margin: 30px 0;">
      <a href="${respondUrl}&response=interested"
         style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 10px;">
        I'm Interested
      </a>
      <a href="${respondUrl}&response=need_more_info"
         style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 10px;">
        Need More Info
      </a>
      <a href="${respondUrl}&response=passed"
         style="background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Not a Fit
      </a>
    </div>

    <p style="color: #666; font-size: 12px;">
      This opportunity was matched by Wells AI. There's no cost unless you close a deal.
    </p>
  `;

  await sendEmail({
    to: supplier.contactEmail,
    subject: `New Opportunity: ${request.title} (${request.quantity} ${request.quantityUnit})`,
    html,
  });
}

async function notifySupplierOfBuyerInterest(intro: Introduction): Promise<void> {
  const supplier = await getSupplier(intro.supplierId);
  if (!supplier) return;

  await sendEmail({
    to: supplier.contactEmail,
    subject: `Buyer Interested - ${intro.requestSummary}`,
    html: `
      <p>Great news! The buyer has expressed interest in working with you.</p>
      <p>Check your Wells AI dashboard to respond and start the conversation.</p>
    `,
  });
}

async function notifyBuyerOfSupplierInterest(intro: Introduction): Promise<void> {
  const request = await getRequest(intro.requestId);
  if (!request?.buyerEmail) return;

  await sendEmail({
    to: request.buyerEmail,
    subject: `Supplier Interested - ${request.title}`,
    html: `
      <p>Great news! The supplier has expressed interest in fulfilling your request.</p>
      <p>Check your Wells AI dashboard to respond and start the conversation.</p>
    `,
  });
}

async function sendDealRoomNotifications(intro: Introduction, dealRoomId: string): Promise<void> {
  const dealRoomUrl = `${process.env.NEXT_PUBLIC_APP_URL}/deals/${dealRoomId}`;

  const [request, supplier] = await Promise.all([
    getRequest(intro.requestId),
    getSupplier(intro.supplierId),
  ]);

  if (request?.buyerEmail) {
    await sendEmail({
      to: request.buyerEmail,
      subject: `Deal Room Created - ${supplier?.companyName || 'Supplier'}`,
      html: `
        <h2>It's a Match!</h2>
        <p>Both you and the supplier expressed interest. We've created a private deal room for you to discuss details.</p>
        <p><a href="${dealRoomUrl}" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Enter Deal Room
        </a></p>
      `,
    });
  }

  if (supplier?.contactEmail) {
    await sendEmail({
      to: supplier.contactEmail,
      subject: `Deal Room Created - ${request?.title || 'Opportunity'}`,
      html: `
        <h2>It's a Match!</h2>
        <p>Both you and the buyer expressed interest. We've created a private deal room for you to discuss details.</p>
        <p><a href="${dealRoomUrl}" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Enter Deal Room
        </a></p>
      `,
    });
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function getMatch(matchId: string): Promise<SourcingMatch | null> {
  try {
    const result = await sql`
      SELECT * FROM sourcing_matches WHERE id = ${matchId}
    `;
    if (result.rows.length === 0) return null;
    return rowToMatch(result.rows[0]);
  } catch (error) {
    console.error('Error fetching match:', error);
    return null;
  }
}

async function getRequest(requestId: string): Promise<SourcingRequest | null> {
  try {
    const result = await sql`
      SELECT * FROM sourcing_requests WHERE id = ${requestId}
    `;
    if (result.rows.length === 0) return null;
    return rowToRequest(result.rows[0]);
  } catch (error) {
    console.error('Error fetching request:', error);
    return null;
  }
}

async function getSupplier(supplierId: string): Promise<SupplierProfile | null> {
  try {
    const result = await sql`
      SELECT s.*, COALESCE(t.trust_score, 50) as trust_score,
             COALESCE(t.trust_tier, 'new') as trust_tier
      FROM suppliers s
      LEFT JOIN trust_scores t ON s.id = t.entity_id
      WHERE s.id = ${supplierId}
    `;
    if (result.rows.length === 0) return null;
    return rowToSupplier(result.rows[0]);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return null;
  }
}

async function getIntroduction(introId: string): Promise<Introduction | null> {
  try {
    const result = await sql`
      SELECT * FROM introductions WHERE id = ${introId}
    `;
    if (result.rows.length === 0) return null;
    return rowToIntroduction(result.rows[0]);
  } catch (error) {
    console.error('Error fetching introduction:', error);
    return null;
  }
}

async function storeIntroduction(intro: Introduction): Promise<void> {
  try {
    await sql`
      INSERT INTO introductions (
        id, match_id, request_id, buyer_id, supplier_id,
        buyer_intro_message, supplier_intro_message,
        request_summary, supplier_summary,
        status, created_at, updated_at
      ) VALUES (
        ${intro.id}, ${intro.matchId}, ${intro.requestId},
        ${intro.buyerId}, ${intro.supplierId},
        ${intro.buyerIntroMessage}, ${intro.supplierIntroMessage},
        ${intro.requestSummary}, ${intro.supplierSummary},
        ${intro.status}, ${intro.createdAt}, ${intro.updatedAt}
      )
    `;
  } catch (error) {
    console.error('Error storing introduction:', error);
  }
}

async function updateIntroductionStatus(
  introId: string,
  status: IntroStatus,
  updates?: Partial<Introduction>
): Promise<Introduction> {
  try {
    const setters: string[] = [`status = '${status}'`, `updated_at = NOW()`];

    if (updates?.sentAt) setters.push(`sent_at = '${updates.sentAt.toISOString()}'`);
    if (updates?.buyerOpenedAt) setters.push(`buyer_opened_at = '${updates.buyerOpenedAt.toISOString()}'`);
    if (updates?.buyerRespondedAt) setters.push(`buyer_responded_at = '${updates.buyerRespondedAt.toISOString()}'`);
    if (updates?.buyerResponse) setters.push(`buyer_response = '${updates.buyerResponse}'`);
    if (updates?.supplierOpenedAt) setters.push(`supplier_opened_at = '${updates.supplierOpenedAt.toISOString()}'`);
    if (updates?.supplierRespondedAt) setters.push(`supplier_responded_at = '${updates.supplierRespondedAt.toISOString()}'`);
    if (updates?.supplierResponse) setters.push(`supplier_response = '${updates.supplierResponse}'`);
    if (updates?.dealRoomCreatedAt) setters.push(`deal_room_created_at = '${updates.dealRoomCreatedAt.toISOString()}'`);
    if (updates?.dealRoomId) setters.push(`deal_room_id = '${updates.dealRoomId}'`);

    await sql.query(`
      UPDATE introductions SET ${setters.join(', ')} WHERE id = $1
    `, [introId]);
  } catch (error) {
    console.error('Error updating introduction:', error);
  }

  return (await getIntroduction(introId))!;
}

async function updateMatchIntroduction(matchId: string, introId: string): Promise<void> {
  try {
    await sql`
      UPDATE sourcing_matches
      SET introduction_id = ${introId}, introduced_at = NOW(), status = 'sent', updated_at = NOW()
      WHERE id = ${matchId}
    `;
  } catch (error) {
    console.error('Error updating match:', error);
  }
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Get all introductions for a buyer
 */
export async function getBuyerIntroductions(buyerId: string): Promise<Introduction[]> {
  try {
    const result = await sql`
      SELECT * FROM introductions
      WHERE buyer_id = ${buyerId}
      ORDER BY created_at DESC
    `;
    return result.rows.map(rowToIntroduction);
  } catch (error) {
    console.error('Error fetching buyer introductions:', error);
    return [];
  }
}

/**
 * Get all introductions for a supplier
 */
export async function getSupplierIntroductions(supplierId: string): Promise<Introduction[]> {
  try {
    const result = await sql`
      SELECT * FROM introductions
      WHERE supplier_id = ${supplierId}
      ORDER BY created_at DESC
    `;
    return result.rows.map(rowToIntroduction);
  } catch (error) {
    console.error('Error fetching supplier introductions:', error);
    return [];
  }
}

/**
 * Get introduction statistics
 */
export async function getIntroductionStats(): Promise<{
  total: number;
  sent: number;
  opened: number;
  mutualInterest: number;
  dealRoomsCreated: number;
  conversionRate: number;
}> {
  try {
    const result = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status != 'draft') as sent,
        COUNT(*) FILTER (WHERE buyer_opened_at IS NOT NULL OR supplier_opened_at IS NOT NULL) as opened,
        COUNT(*) FILTER (WHERE status = 'mutual_interest' OR status = 'deal_room_created') as mutual_interest,
        COUNT(*) FILTER (WHERE status = 'deal_room_created') as deal_rooms_created
      FROM introductions
    `;

    const row = result.rows[0];
    const total = parseInt(row.total);
    const sent = parseInt(row.sent);
    const dealRoomsCreated = parseInt(row.deal_rooms_created);

    return {
      total,
      sent,
      opened: parseInt(row.opened),
      mutualInterest: parseInt(row.mutual_interest),
      dealRoomsCreated,
      conversionRate: sent > 0 ? (dealRoomsCreated / sent) * 100 : 0,
    };
  } catch (error) {
    console.error('Error fetching intro stats:', error);
    return {
      total: 0,
      sent: 0,
      opened: 0,
      mutualInterest: 0,
      dealRoomsCreated: 0,
      conversionRate: 0,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `intro_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function summarizeRequest(request: SourcingRequest): string {
  const parts = [request.title];
  if (request.quantity) {
    parts.push(`${request.quantity} ${request.quantityUnit}`);
  }
  if (request.frequency !== 'one-time') {
    parts.push(request.frequency);
  }
  if (request.deliveryLocation) {
    parts.push(`delivery to ${request.deliveryLocation}`);
  }
  return parts.join(' - ');
}

function rowToMatch(row: Record<string, unknown>): SourcingMatch {
  return {
    id: row.id as string,
    requestId: row.request_id as string,
    supplierId: row.supplier_id as string,
    overallScore: row.overall_score as number,
    scoreBreakdown: typeof row.score_breakdown === 'string'
      ? JSON.parse(row.score_breakdown)
      : row.score_breakdown,
    reasoning: row.reasoning as string,
    strengths: row.strengths as string[] || [],
    concerns: row.concerns as string[] || [],
    estimatedLeadTime: row.estimated_lead_time as number | undefined,
    estimatedCapacityFit: row.estimated_capacity_fit as SourcingMatch['estimatedCapacityFit'],
    status: row.status as SourcingMatch['status'],
    introductionId: row.introduction_id as string | undefined,
    introducedAt: row.introduced_at ? new Date(row.introduced_at as string) : undefined,
    dealRoomId: row.deal_room_id as string | undefined,
    matchedAt: new Date(row.matched_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function rowToRequest(row: Record<string, unknown>): SourcingRequest {
  return {
    id: row.id as string,
    buyerId: row.buyer_id as string,
    buyerName: row.buyer_name as string | undefined,
    buyerEmail: row.buyer_email as string | undefined,
    title: row.title as string,
    description: row.description as string,
    category: row.category as string,
    specifications: [],
    requiredCertifications: row.required_certifications as string[] || [],
    quantity: row.quantity as number,
    quantityUnit: row.quantity_unit as string,
    frequency: row.frequency as SourcingRequest['frequency'],
    urgency: row.urgency as SourcingRequest['urgency'],
    deliveryLocation: row.delivery_location as string,
    targetPrice: row.target_price as number | undefined,
    currency: row.currency as string || 'USD',
    preferGrainEnabled: row.prefer_grain_enabled as boolean,
    requireGrainEnabled: row.require_grain_enabled as boolean,
    status: row.status as SourcingRequest['status'],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function rowToSupplier(row: Record<string, unknown>): SupplierProfile {
  const capacity = typeof row.capacity === 'string' ? JSON.parse(row.capacity) : row.capacity || {};
  return {
    id: row.id as string,
    companyName: row.company_name as string,
    contactEmail: row.contact_email as string,
    categories: row.products as string[] || [],
    products: row.products as string[] || [],
    capabilities: {
      dropShipCapable: row.drop_ship_capable as boolean || false,
      whiteLabelCapable: row.white_label_capable as boolean || false,
      customizationLevel: 'basic',
      minOrderFlexibility: 'negotiable',
      rushOrderCapable: false,
    },
    certifications: row.certifications as string[] || [],
    capacity: {
      monthlyVolume: capacity.monthlyVolume || 10000,
      monthlyVolumeUnit: 'units',
      currentUtilization: 50,
      leadTimeStandard: row.lead_time as number || 7,
      leadTimeRush: Math.ceil((row.lead_time as number || 7) / 2),
      canHandleVolume: () => true,
    },
    pricing: {
      minimumOrder: row.minimum_order as number || 100,
      currency: 'USD',
      paymentTerms: 'NET30',
    },
    headquarters: '',
    shippingLocations: capacity.locations || [],
    grainEnabled: row.grain_enabled as boolean || false,
    trustScore: row.trust_score as number || 50,
    trustTier: row.trust_tier as SupplierProfile['trustTier'] || 'new',
    performance: {
      totalDeals: 0,
      completedDeals: 0,
      onTimeDeliveryRate: 95,
      qualityRating: 4,
      responseTimeHours: 24,
      disputeRate: 0,
      repeatCustomerRate: 0,
    },
    status: row.status as SupplierProfile['status'],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function rowToIntroduction(row: Record<string, unknown>): Introduction {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    requestId: row.request_id as string,
    buyerId: row.buyer_id as string,
    supplierId: row.supplier_id as string,
    buyerIntroMessage: row.buyer_intro_message as string,
    supplierIntroMessage: row.supplier_intro_message as string,
    requestSummary: row.request_summary as string,
    supplierSummary: row.supplier_summary as string,
    status: row.status as IntroStatus,
    sentAt: row.sent_at ? new Date(row.sent_at as string) : undefined,
    buyerOpenedAt: row.buyer_opened_at ? new Date(row.buyer_opened_at as string) : undefined,
    buyerRespondedAt: row.buyer_responded_at ? new Date(row.buyer_responded_at as string) : undefined,
    buyerResponse: row.buyer_response as Introduction['buyerResponse'],
    supplierOpenedAt: row.supplier_opened_at ? new Date(row.supplier_opened_at as string) : undefined,
    supplierRespondedAt: row.supplier_responded_at ? new Date(row.supplier_responded_at as string) : undefined,
    supplierResponse: row.supplier_response as Introduction['supplierResponse'],
    dealRoomCreatedAt: row.deal_room_created_at ? new Date(row.deal_room_created_at as string) : undefined,
    dealRoomId: row.deal_room_id as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const IntroductionSystem = {
  createIntroduction,
  sendIntroduction,
  recordBuyerView,
  recordSupplierView,
  recordBuyerResponse,
  recordSupplierResponse,
  getBuyerIntroductions,
  getSupplierIntroductions,
  getIntroductionStats,
};

export default IntroductionSystem;
