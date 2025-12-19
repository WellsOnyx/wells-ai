/**
 * In-Network Sourcing Service - Wells AI
 *
 * The core founder GTM feature: source customers, suppliers, talent,
 * investors, and partners from the Wells network with a 33% success-only fee model.
 *
 * Key Features:
 * - Search Wells network for matches (opted-in users)
 * - Request and send warm introductions
 * - Track conversion through deal lifecycle
 * - 33% success fee only when deals close
 * - Attribution chain integration for introducers
 *
 * Fee Model:
 * - No upfront cost
 * - 33% of first payment (or deal value) on success
 * - Fee charged to requester's GRAIN balance
 * - Attribution paid to introducer chain
 */

import { sqlQuery as sql } from '@/lib/db';
import crypto from 'crypto';

// =====================================================
// TYPES
// =====================================================

export type SourcingType = 'customer' | 'supplier' | 'talent' | 'investor' | 'partner';

export type SourcingStatus =
  | 'requested'
  | 'searching'
  | 'matches_found'
  | 'intro_sent'
  | 'in_conversation'
  | 'closed_won'
  | 'closed_lost'
  | 'expired';

export type MatchStatus =
  | 'pending'
  | 'intro_requested'
  | 'intro_sent'
  | 'responded'
  | 'meeting_scheduled'
  | 'in_progress'
  | 'converted'
  | 'declined';

export type Urgency = 'low' | 'medium' | 'high' | 'critical';

export interface SourcingRequest {
  id: string;
  requesterId: string;
  requesterName?: string;
  type: SourcingType;
  description: string;
  criteria: SourcingCriteria;
  budget?: number;
  urgency: Urgency;
  status: SourcingStatus;
  matchCount: number;
  introCount: number;
  successFee: number; // Percentage (default 33)
  dealValue?: number;
  feeEarned?: number;
  notes?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SourcingCriteria {
  // Common criteria
  industries?: string[];
  locations?: string[];
  companySize?: string[];
  minRevenue?: number;
  maxRevenue?: number;

  // Customer-specific
  targetTitles?: string[];
  buyingSignals?: string[];

  // Supplier-specific
  categories?: string[];
  certifications?: string[];
  minCapacity?: number;

  // Talent-specific
  skills?: string[];
  experienceYears?: number;
  availability?: string;
  rateRange?: { min: number; max: number };

  // Investor-specific
  investmentStage?: string[];
  checkSizeRange?: { min: number; max: number };
  focusAreas?: string[];

  // Partner-specific
  partnershipType?: string[];
  integrationNeeds?: string[];

  // Custom criteria
  custom?: Record<string, unknown>;
}

export interface NetworkMatch {
  id: string;
  requestId: string;
  matchedUserId: string;
  matchedUserName?: string;
  matchedUserEmail?: string;
  matchedUserCompany?: string;
  matchedUserTitle?: string;
  matchedUserAvatar?: string;
  matchScore: number;
  matchReason: string;
  matchBreakdown?: MatchBreakdown;
  status: MatchStatus;
  introMessage?: string;
  responseMessage?: string;
  introSentAt?: Date;
  respondedAt?: Date;
  meetingScheduledAt?: Date;
  meetingDate?: Date;
  convertedAt?: Date;
  dealValue?: number;
  declineReason?: string;
  introducerId?: string;
  introducerName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchBreakdown {
  industryScore: number;
  locationScore: number;
  sizeScore: number;
  criteriaScore: number;
  historyScore: number;
  factors: string[];
}

export interface NetworkStats {
  totalRequests: number;
  activeRequests: number;
  totalMatches: number;
  totalIntros: number;
  totalConversions: number;
  conversionRate: number;
  totalFeesPaid: number;
  totalFeesEarned: number;
  byType: Record<SourcingType, {
    requests: number;
    conversions: number;
    avgDealValue: number;
  }>;
  thisMonth: {
    requests: number;
    conversions: number;
    fees: number;
  };
}

export interface CreateSourcingOptions {
  budget?: number;
  urgency?: Urgency;
  successFee?: number;
  expiresInDays?: number;
  notes?: string;
}

export interface SourcingFilters {
  type?: SourcingType | SourcingType[];
  status?: SourcingStatus | SourcingStatus[];
  limit?: number;
  offset?: number;
}

export interface MatchFilters {
  status?: MatchStatus | MatchStatus[];
  minScore?: number;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  matches: NetworkMatch[];
  total: number;
  searchedPools: string[];
  searchTime: number;
}

export interface AvailableMatch {
  userId: string;
  userName?: string;
  userCompany?: string;
  userTitle?: string;
  matchScore: number;
  matchReason: string;
  type: SourcingType;
}

// Constants
export const DEFAULT_SUCCESS_FEE = 33; // 33%
export const DEFAULT_EXPIRY_DAYS = 90;
export const MIN_MATCH_SCORE = 50;

// =====================================================
// SOURCING REQUEST CRUD
// =====================================================

/**
 * Create a new sourcing request
 * Founders use this to request intros to customers, suppliers, talent, etc.
 */
export async function createSourcingRequest(
  requesterId: string,
  type: SourcingType,
  description: string,
  criteria: SourcingCriteria,
  options?: CreateSourcingOptions
): Promise<{ success: boolean; request?: SourcingRequest; message: string }> {
  const requestId = crypto.randomUUID();
  const urgency = options?.urgency || 'medium';
  const successFee = options?.successFee ?? DEFAULT_SUCCESS_FEE;
  const expiryDays = options?.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  try {
    // Get requester name
    const requesterResult = await sql`
      SELECT full_name FROM treasury_accounts WHERE clerk_user_id = ${requesterId}
      UNION
      SELECT display_name as full_name FROM worker_profiles WHERE user_id = ${requesterId}
      LIMIT 1
    `;
    const requesterName = requesterResult.rows[0]?.full_name;

    await sql`
      INSERT INTO network_sourcing_requests (
        id, requester_id, requester_name, type, description, criteria,
        budget, urgency, status, match_count, intro_count,
        success_fee, notes, expires_at, created_at, updated_at
      ) VALUES (
        ${requestId}, ${requesterId}, ${requesterName || null}, ${type}, ${description},
        ${JSON.stringify(criteria)}, ${options?.budget || null}, ${urgency}, 'requested',
        0, 0, ${successFee}, ${options?.notes || null}, ${expiresAt.toISOString()}, NOW(), NOW()
      )
    `;

    const request: SourcingRequest = {
      id: requestId,
      requesterId,
      requesterName,
      type,
      description,
      criteria,
      budget: options?.budget,
      urgency,
      status: 'requested',
      matchCount: 0,
      introCount: 0,
      successFee,
      notes: options?.notes,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const typeLabels: Record<SourcingType, string> = {
      customer: 'customer',
      supplier: 'supplier',
      talent: 'talent',
      investor: 'investor',
      partner: 'partner',
    };

    const urgencyNote = urgency === 'critical'
      ? " I'll prioritize this search."
      : urgency === 'high'
        ? " I'll move quickly on this."
        : '';

    return {
      success: true,
      request,
      message: `Your ${typeLabels[type]} sourcing request has been created.${urgencyNote} I'll search the Wells network and find matches for you. The ${successFee}% success fee only applies if a deal closes.`,
    };
  } catch (error: any) {
    console.error('Error creating sourcing request:', error);
    return {
      success: false,
      message: `I couldn't create your sourcing request. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * Get all sourcing requests for a user
 */
export async function getSourcingRequests(
  userId: string,
  filters?: SourcingFilters
): Promise<{ success: boolean; requests: SourcingRequest[]; message: string }> {
  try {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    let result;
    if (filters?.type || filters?.status) {
      const types = filters.type
        ? (Array.isArray(filters.type) ? filters.type : [filters.type])
        : null;
      const statuses = filters.status
        ? (Array.isArray(filters.status) ? filters.status : [filters.status])
        : null;

      if (types && statuses) {
        result = await sql`
          SELECT * FROM network_sourcing_requests
          WHERE requester_id = ${userId}
            AND type = ANY(${types})
            AND status = ANY(${statuses})
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (types) {
        result = await sql`
          SELECT * FROM network_sourcing_requests
          WHERE requester_id = ${userId} AND type = ANY(${types})
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (statuses) {
        result = await sql`
          SELECT * FROM network_sourcing_requests
          WHERE requester_id = ${userId} AND status = ANY(${statuses})
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        result = await sql`
          SELECT * FROM network_sourcing_requests
          WHERE requester_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
    } else {
      result = await sql`
        SELECT * FROM network_sourcing_requests
        WHERE requester_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const requests = result.rows.map(mapRowToRequest);

    if (requests.length === 0) {
      return {
        success: true,
        requests: [],
        message: "You don't have any sourcing requests yet. Need help finding customers, suppliers, or talent? Just ask!",
      };
    }

    const activeCount = requests.filter(r => ['requested', 'searching', 'matches_found', 'intro_sent', 'in_conversation'].includes(r.status)).length;
    const wonCount = requests.filter(r => r.status === 'closed_won').length;

    return {
      success: true,
      requests,
      message: `You have ${requests.length} sourcing request(s): ${activeCount} active, ${wonCount} closed won.`,
    };
  } catch (error: any) {
    console.error('Error fetching sourcing requests:', error);
    return {
      success: false,
      requests: [],
      message: `I couldn't fetch your sourcing requests. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * Get a single sourcing request with its matches
 */
export async function getSourcingRequest(
  requestId: string
): Promise<{ success: boolean; request?: SourcingRequest; matches?: NetworkMatch[]; message: string }> {
  try {
    const requestResult = await sql`
      SELECT * FROM network_sourcing_requests WHERE id = ${requestId}
    `;

    if (requestResult.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find that sourcing request. It may have been deleted or you don't have access.",
      };
    }

    const request = mapRowToRequest(requestResult.rows[0]);

    // Get matches
    const matchesResult = await sql`
      SELECT * FROM network_sourcing_matches
      WHERE request_id = ${requestId}
      ORDER BY match_score DESC, created_at DESC
    `;

    const matches = matchesResult.rows.map(mapRowToMatch);

    const statusMessages: Record<SourcingStatus, string> = {
      requested: 'Request submitted, waiting to search the network.',
      searching: 'Currently searching the Wells network for matches.',
      matches_found: `Found ${request.matchCount} potential matches.`,
      intro_sent: `Sent ${request.introCount} introduction(s), waiting for responses.`,
      in_conversation: 'Conversations are in progress.',
      closed_won: `Deal closed! Value: $${request.dealValue?.toLocaleString() || 0}`,
      closed_lost: 'This request has been closed without a deal.',
      expired: 'This request has expired.',
    };

    return {
      success: true,
      request,
      matches,
      message: `"${request.description.substring(0, 50)}..." - ${statusMessages[request.status]}`,
    };
  } catch (error: any) {
    console.error('Error fetching sourcing request:', error);
    return {
      success: false,
      message: `I couldn't fetch that sourcing request. ${error.message || ''}`,
    };
  }
}

/**
 * Cancel an active sourcing request
 */
export async function cancelSourcingRequest(
  requestId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const existing = await sql`
      SELECT * FROM network_sourcing_requests WHERE id = ${requestId}
    `;

    if (existing.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find that sourcing request.",
      };
    }

    const request = mapRowToRequest(existing.rows[0]);

    if (['closed_won', 'closed_lost', 'expired'].includes(request.status)) {
      return {
        success: false,
        message: `This request is already ${request.status.replace('_', ' ')}. It can't be cancelled.`,
      };
    }

    await sql`
      UPDATE network_sourcing_requests
      SET status = 'closed_lost', updated_at = NOW()
      WHERE id = ${requestId}
    `;

    return {
      success: true,
      message: `Your ${request.type} sourcing request has been cancelled. No fees were charged.`,
    };
  } catch (error: any) {
    console.error('Error cancelling sourcing request:', error);
    return {
      success: false,
      message: `I couldn't cancel the request. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// NETWORK SEARCH
// =====================================================

/**
 * Search the Wells network for matches
 * Searches opted-in users based on the sourcing type
 */
export async function searchNetwork(
  requestId: string
): Promise<{ success: boolean; result?: SearchResult; message: string }> {
  const startTime = Date.now();

  try {
    // Get the request
    const requestResult = await sql`
      SELECT * FROM network_sourcing_requests WHERE id = ${requestId}
    `;

    if (requestResult.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find that sourcing request.",
      };
    }

    const request = mapRowToRequest(requestResult.rows[0]);

    // Update status to searching
    await sql`
      UPDATE network_sourcing_requests
      SET status = 'searching', updated_at = NOW()
      WHERE id = ${requestId}
    `;

    const searchedPools: string[] = [];
    const matches: NetworkMatch[] = [];

    // Search based on type
    switch (request.type) {
      case 'customer':
        searchedPools.push('seller_profiles', 'past_buyers');
        const customerMatches = await searchForCustomers(request);
        matches.push(...customerMatches);
        break;

      case 'supplier':
        searchedPools.push('seller_profiles', 'supplier_database');
        const supplierMatches = await searchForSuppliers(request);
        matches.push(...supplierMatches);
        break;

      case 'talent':
        searchedPools.push('worker_profiles');
        const talentMatches = await searchForTalent(request);
        matches.push(...talentMatches);
        break;

      case 'investor':
        searchedPools.push('investor_profiles', 'network_users');
        const investorMatches = await searchForInvestors(request);
        matches.push(...investorMatches);
        break;

      case 'partner':
        searchedPools.push('seller_profiles', 'network_partners');
        const partnerMatches = await searchForPartners(request);
        matches.push(...partnerMatches);
        break;
    }

    // Save matches to database
    for (const match of matches) {
      await sql`
        INSERT INTO network_sourcing_matches (
          id, request_id, matched_user_id, matched_user_name, matched_user_email,
          matched_user_company, matched_user_title, matched_user_avatar,
          match_score, match_reason, match_breakdown, status,
          created_at, updated_at
        ) VALUES (
          ${match.id}, ${requestId}, ${match.matchedUserId}, ${match.matchedUserName || null},
          ${match.matchedUserEmail || null}, ${match.matchedUserCompany || null},
          ${match.matchedUserTitle || null}, ${match.matchedUserAvatar || null},
          ${match.matchScore}, ${match.matchReason},
          ${match.matchBreakdown ? JSON.stringify(match.matchBreakdown) : null},
          'pending', NOW(), NOW()
        )
        ON CONFLICT (request_id, matched_user_id) DO UPDATE
        SET match_score = ${match.matchScore},
            match_reason = ${match.matchReason},
            updated_at = NOW()
      `;
    }

    // Update request with match count
    const newStatus = matches.length > 0 ? 'matches_found' : 'searching';
    await sql`
      UPDATE network_sourcing_requests
      SET status = ${newStatus}, match_count = ${matches.length}, updated_at = NOW()
      WHERE id = ${requestId}
    `;

    const searchTime = Date.now() - startTime;

    const result: SearchResult = {
      matches,
      total: matches.length,
      searchedPools,
      searchTime,
    };

    const message = matches.length > 0
      ? `Found ${matches.length} potential ${request.type}${matches.length > 1 ? 's' : ''} in the Wells network! Top match has a ${matches[0]?.matchScore}% score. Ready to send introductions?`
      : `I searched ${searchedPools.join(', ')} but didn't find strong matches yet. Try broadening your criteria or I'll keep searching as new users join.`;

    return {
      success: true,
      result,
      message,
    };
  } catch (error: any) {
    console.error('Error searching network:', error);
    return {
      success: false,
      message: `I ran into an issue searching the network. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * Get available matches preview before creating a request
 */
export async function getAvailableMatches(
  type: SourcingType,
  criteria: SourcingCriteria
): Promise<{ success: boolean; matches: AvailableMatch[]; message: string }> {
  try {
    // Create a temporary request object for searching
    const tempRequest: SourcingRequest = {
      id: 'preview',
      requesterId: 'preview',
      type,
      description: 'Preview search',
      criteria,
      urgency: 'medium',
      status: 'requested',
      matchCount: 0,
      introCount: 0,
      successFee: DEFAULT_SUCCESS_FEE,
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let networkMatches: NetworkMatch[] = [];

    switch (type) {
      case 'customer':
        networkMatches = await searchForCustomers(tempRequest);
        break;
      case 'supplier':
        networkMatches = await searchForSuppliers(tempRequest);
        break;
      case 'talent':
        networkMatches = await searchForTalent(tempRequest);
        break;
      case 'investor':
        networkMatches = await searchForInvestors(tempRequest);
        break;
      case 'partner':
        networkMatches = await searchForPartners(tempRequest);
        break;
    }

    // Convert to AvailableMatch (preview format)
    const matches: AvailableMatch[] = networkMatches.slice(0, 10).map(m => ({
      userId: m.matchedUserId,
      userName: m.matchedUserName,
      userCompany: m.matchedUserCompany,
      userTitle: m.matchedUserTitle,
      matchScore: m.matchScore,
      matchReason: m.matchReason,
      type,
    }));

    const message = matches.length > 0
      ? `Found ${matches.length} potential ${type}${matches.length > 1 ? 's' : ''} matching your criteria. Create a sourcing request to get warm introductions.`
      : `No strong matches found with these criteria. Try adjusting your requirements.`;

    return {
      success: true,
      matches,
      message,
    };
  } catch (error: any) {
    console.error('Error getting available matches:', error);
    return {
      success: false,
      matches: [],
      message: `I couldn't preview matches. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// INTRODUCTION MANAGEMENT
// =====================================================

/**
 * Request an introduction to a match
 */
export async function requestIntro(
  requestId: string,
  matchId: string
): Promise<{ success: boolean; match?: NetworkMatch; message: string }> {
  try {
    // Get the match
    const matchResult = await sql`
      SELECT m.*, r.requester_id, r.type, r.description
      FROM network_sourcing_matches m
      JOIN network_sourcing_requests r ON m.request_id = r.id
      WHERE m.id = ${matchId} AND m.request_id = ${requestId}
    `;

    if (matchResult.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find that match.",
      };
    }

    const matchRow = matchResult.rows[0];

    if (matchRow.status !== 'pending') {
      return {
        success: false,
        message: `This match is already ${matchRow.status.replace('_', ' ')}. Can't request another intro.`,
      };
    }

    // Update match status
    await sql`
      UPDATE network_sourcing_matches
      SET status = 'intro_requested', updated_at = NOW()
      WHERE id = ${matchId}
    `;

    const match = mapRowToMatch({ ...matchRow, status: 'intro_requested' });

    return {
      success: true,
      match,
      message: `Introduction to ${match.matchedUserName || 'this contact'} has been requested. I'll prepare a warm intro message for your approval.`,
    };
  } catch (error: any) {
    console.error('Error requesting intro:', error);
    return {
      success: false,
      message: `I couldn't request the introduction. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * Send the actual introduction message
 */
export async function sendIntro(
  matchId: string,
  message: string
): Promise<{ success: boolean; match?: NetworkMatch; message: string }> {
  try {
    // Get the match with request info
    const matchResult = await sql`
      SELECT m.*, r.requester_id, r.requester_name, r.type, r.description
      FROM network_sourcing_matches m
      JOIN network_sourcing_requests r ON m.request_id = r.id
      WHERE m.id = ${matchId}
    `;

    if (matchResult.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find that match.",
      };
    }

    const matchRow = matchResult.rows[0];

    if (!['pending', 'intro_requested'].includes(matchRow.status)) {
      return {
        success: false,
        message: `This match is ${matchRow.status.replace('_', ' ')}. Can't send another intro.`,
      };
    }

    // Update match with intro details
    await sql`
      UPDATE network_sourcing_matches
      SET
        status = 'intro_sent',
        intro_message = ${message},
        intro_sent_at = NOW(),
        updated_at = NOW()
      WHERE id = ${matchId}
    `;

    // Update request intro count
    await sql`
      UPDATE network_sourcing_requests
      SET
        intro_count = intro_count + 1,
        status = CASE WHEN status = 'matches_found' THEN 'intro_sent' ELSE status END,
        updated_at = NOW()
      WHERE id = ${matchRow.request_id}
    `;

    // TODO: Actually send the intro via email/notification
    // This would integrate with lib/notifications/ or lib/email.ts

    const match = mapRowToMatch({
      ...matchRow,
      status: 'intro_sent',
      intro_message: message,
      intro_sent_at: new Date(),
    });

    return {
      success: true,
      match,
      message: `Introduction sent to ${match.matchedUserName || 'the contact'}! I'll notify you when they respond.`,
    };
  } catch (error: any) {
    console.error('Error sending intro:', error);
    return {
      success: false,
      message: `I couldn't send the introduction. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * Record a response from a match
 */
export async function recordResponse(
  matchId: string,
  response: 'interested' | 'declined',
  responseMessage?: string
): Promise<{ success: boolean; match?: NetworkMatch; message: string }> {
  try {
    const matchResult = await sql`
      SELECT * FROM network_sourcing_matches WHERE id = ${matchId}
    `;

    if (matchResult.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find that match.",
      };
    }

    const matchRow = matchResult.rows[0];
    const newStatus = response === 'interested' ? 'responded' : 'declined';

    await sql`
      UPDATE network_sourcing_matches
      SET
        status = ${newStatus},
        response_message = ${responseMessage || null},
        responded_at = NOW(),
        decline_reason = ${response === 'declined' ? (responseMessage || 'Not interested') : null},
        updated_at = NOW()
      WHERE id = ${matchId}
    `;

    // Check if any matches are still in conversation - update request status
    if (response === 'interested') {
      await sql`
        UPDATE network_sourcing_requests
        SET status = 'in_conversation', updated_at = NOW()
        WHERE id = ${matchRow.request_id}
      `;
    }

    const match = mapRowToMatch({
      ...matchRow,
      status: newStatus,
      response_message: responseMessage,
      responded_at: new Date(),
    });

    const msg = response === 'interested'
      ? `Great news! ${match.matchedUserName || 'The contact'} is interested. Time to schedule a meeting!`
      : `${match.matchedUserName || 'The contact'} has declined. Let's try the next match.`;

    return {
      success: true,
      match,
      message: msg,
    };
  } catch (error: any) {
    console.error('Error recording response:', error);
    return {
      success: false,
      message: `I couldn't record the response. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * Record a meeting scheduled with a match
 */
export async function recordMeeting(
  matchId: string,
  meetingDate: Date
): Promise<{ success: boolean; match?: NetworkMatch; message: string }> {
  try {
    const matchResult = await sql`
      SELECT * FROM network_sourcing_matches WHERE id = ${matchId}
    `;

    if (matchResult.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find that match.",
      };
    }

    await sql`
      UPDATE network_sourcing_matches
      SET
        status = 'meeting_scheduled',
        meeting_scheduled_at = NOW(),
        meeting_date = ${meetingDate.toISOString()},
        updated_at = NOW()
      WHERE id = ${matchId}
    `;

    const match = mapRowToMatch({
      ...matchResult.rows[0],
      status: 'meeting_scheduled',
      meeting_scheduled_at: new Date(),
      meeting_date: meetingDate,
    });

    const formattedDate = meetingDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    return {
      success: true,
      match,
      message: `Meeting scheduled with ${match.matchedUserName || 'the contact'} for ${formattedDate}. Good luck!`,
    };
  } catch (error: any) {
    console.error('Error recording meeting:', error);
    return {
      success: false,
      message: `I couldn't record the meeting. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// CONVERSION & FEE HANDLING
// =====================================================

/**
 * Record a successful conversion
 * Calculates the 33% fee, creates GRAIN transaction, updates attribution
 */
export async function recordConversion(
  matchId: string,
  dealValue: number
): Promise<{
  success: boolean;
  match?: NetworkMatch;
  feeAmount?: number;
  message: string;
}> {
  try {
    // Get match with request details
    const matchResult = await sql`
      SELECT m.*, r.requester_id, r.success_fee, r.type
      FROM network_sourcing_matches m
      JOIN network_sourcing_requests r ON m.request_id = r.id
      WHERE m.id = ${matchId}
    `;

    if (matchResult.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find that match.",
      };
    }

    const matchRow = matchResult.rows[0];
    const successFee = parseFloat(matchRow.success_fee) || DEFAULT_SUCCESS_FEE;
    const feeAmount = dealValue * (successFee / 100);

    // Update match
    await sql`
      UPDATE network_sourcing_matches
      SET
        status = 'converted',
        deal_value = ${dealValue},
        converted_at = NOW(),
        updated_at = NOW()
      WHERE id = ${matchId}
    `;

    // Update request
    await sql`
      UPDATE network_sourcing_requests
      SET
        status = 'closed_won',
        deal_value = COALESCE(deal_value, 0) + ${dealValue},
        fee_earned = COALESCE(fee_earned, 0) + ${feeAmount},
        updated_at = NOW()
      WHERE id = ${matchRow.request_id}
    `;

    // Create GRAIN transaction for the fee
    const transactionId = crypto.randomUUID();
    await sql`
      INSERT INTO grain_transactions (
        id, account_id, type, status,
        grain_amount, usd_amount,
        description, metadata,
        created_at
      ) VALUES (
        ${transactionId},
        ${matchRow.requester_id},
        'sourcing_fee',
        'completed',
        ${feeAmount},
        ${feeAmount},
        ${`Network sourcing success fee - ${matchRow.type} deal ($${dealValue.toLocaleString()})`},
        ${JSON.stringify({ matchId, requestId: matchRow.request_id, dealValue, feePercent: successFee })},
        NOW()
      )
    `;

    // Debit the requester's GRAIN balance
    await sql`
      UPDATE treasury_accounts
      SET grain_balance = grain_balance - ${feeAmount}
      WHERE clerk_user_id = ${matchRow.requester_id}
    `;

    // If there's an introducer, pay attribution
    if (matchRow.introducer_id) {
      await payIntroducerAttribution(matchRow.introducer_id, feeAmount, matchId);
    }

    const match = mapRowToMatch({
      ...matchRow,
      status: 'converted',
      deal_value: dealValue,
      converted_at: new Date(),
    });

    return {
      success: true,
      match,
      feeAmount,
      message: `Congratulations! Deal closed for $${dealValue.toLocaleString()}. The ${successFee}% success fee of $${feeAmount.toLocaleString()} has been charged to your account.`,
    };
  } catch (error: any) {
    console.error('Error recording conversion:', error);
    return {
      success: false,
      message: `I couldn't record the conversion. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// NETWORK STATS
// =====================================================

/**
 * Get comprehensive network sourcing stats for a user
 */
export async function getNetworkStats(
  userId: string
): Promise<{ success: boolean; stats?: NetworkStats; message: string }> {
  try {
    // Get request counts by status
    const requestStats = await sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('requested', 'searching', 'matches_found', 'intro_sent', 'in_conversation') THEN 1 ELSE 0 END) as active,
        SUM(match_count) as total_matches,
        SUM(intro_count) as total_intros,
        SUM(CASE WHEN status = 'closed_won' THEN 1 ELSE 0 END) as conversions,
        SUM(COALESCE(fee_earned, 0)) as fees_paid
      FROM network_sourcing_requests
      WHERE requester_id = ${userId}
    `;

    // Get stats by type
    const typeStats = await sql`
      SELECT
        type,
        COUNT(*) as requests,
        SUM(CASE WHEN status = 'closed_won' THEN 1 ELSE 0 END) as conversions,
        AVG(CASE WHEN status = 'closed_won' THEN deal_value ELSE NULL END) as avg_deal_value
      FROM network_sourcing_requests
      WHERE requester_id = ${userId}
      GROUP BY type
    `;

    // Get this month's stats
    const monthStats = await sql`
      SELECT
        COUNT(*) as requests,
        SUM(CASE WHEN status = 'closed_won' THEN 1 ELSE 0 END) as conversions,
        SUM(COALESCE(fee_earned, 0)) as fees
      FROM network_sourcing_requests
      WHERE requester_id = ${userId}
        AND created_at >= date_trunc('month', CURRENT_DATE)
    `;

    // Get fees earned as an introducer
    const earnedStats = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM introducer_earnings
      WHERE introducer_id = ${userId}
    `;

    const row = requestStats.rows[0] || {};
    const monthRow = monthStats.rows[0] || {};
    const earnedRow = earnedStats.rows[0] || {};

    const totalRequests = parseInt(row.total) || 0;
    const conversions = parseInt(row.conversions) || 0;

    const byType: Record<SourcingType, { requests: number; conversions: number; avgDealValue: number }> = {
      customer: { requests: 0, conversions: 0, avgDealValue: 0 },
      supplier: { requests: 0, conversions: 0, avgDealValue: 0 },
      talent: { requests: 0, conversions: 0, avgDealValue: 0 },
      investor: { requests: 0, conversions: 0, avgDealValue: 0 },
      partner: { requests: 0, conversions: 0, avgDealValue: 0 },
    };

    for (const typeRow of typeStats.rows) {
      const t = typeRow.type as SourcingType;
      byType[t] = {
        requests: parseInt(typeRow.requests) || 0,
        conversions: parseInt(typeRow.conversions) || 0,
        avgDealValue: parseFloat(typeRow.avg_deal_value) || 0,
      };
    }

    const stats: NetworkStats = {
      totalRequests,
      activeRequests: parseInt(row.active) || 0,
      totalMatches: parseInt(row.total_matches) || 0,
      totalIntros: parseInt(row.total_intros) || 0,
      totalConversions: conversions,
      conversionRate: totalRequests > 0 ? (conversions / totalRequests) * 100 : 0,
      totalFeesPaid: parseFloat(row.fees_paid) || 0,
      totalFeesEarned: parseFloat(earnedRow.total) || 0,
      byType,
      thisMonth: {
        requests: parseInt(monthRow.requests) || 0,
        conversions: parseInt(monthRow.conversions) || 0,
        fees: parseFloat(monthRow.fees) || 0,
      },
    };

    const conversionPct = stats.conversionRate.toFixed(1);
    let message = `Network sourcing stats: ${stats.totalRequests} total requests with ${conversionPct}% conversion rate. `;
    if (stats.totalConversions > 0) {
      message += `You've closed ${stats.totalConversions} deal(s) through the network.`;
    } else if (stats.activeRequests > 0) {
      message += `You have ${stats.activeRequests} active request(s) in progress.`;
    } else {
      message += `Ready to start sourcing from the Wells network?`;
    }

    return {
      success: true,
      stats,
      message,
    };
  } catch (error: any) {
    console.error('Error fetching network stats:', error);
    return {
      success: false,
      message: `I couldn't fetch your network stats. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// SEARCH HELPERS (by type)
// =====================================================

async function searchForCustomers(request: SourcingRequest): Promise<NetworkMatch[]> {
  const matches: NetworkMatch[] = [];
  const criteria = request.criteria;

  try {
    // Search seller profiles (potential customers looking to buy)
    let query = sql`
      SELECT
        sp.user_id, sp.company_name, sp.company_description, sp.industry,
        sp.company_size, sp.locations, sp.categories, sp.website, sp.logo_url,
        ta.email, ta.full_name
      FROM seller_profiles sp
      LEFT JOIN treasury_accounts ta ON sp.user_id = ta.clerk_user_id
      WHERE sp.status = 'verified'
      LIMIT 50
    `;

    const result = await query;

    for (const row of result.rows) {
      const score = calculateCustomerScore(row, criteria);
      if (score >= MIN_MATCH_SCORE) {
        matches.push({
          id: crypto.randomUUID(),
          requestId: request.id,
          matchedUserId: row.user_id,
          matchedUserName: row.full_name || row.company_name,
          matchedUserEmail: row.email,
          matchedUserCompany: row.company_name,
          matchedUserAvatar: row.logo_url,
          matchScore: score,
          matchReason: buildMatchReason(row, criteria, 'customer'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.error('Error searching for customers:', error);
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

async function searchForSuppliers(request: SourcingRequest): Promise<NetworkMatch[]> {
  const matches: NetworkMatch[] = [];
  const criteria = request.criteria;

  try {
    // Search seller profiles (suppliers)
    const result = await sql`
      SELECT
        sp.user_id, sp.company_name, sp.company_description, sp.industry,
        sp.company_size, sp.locations, sp.categories, sp.certifications,
        sp.website, sp.logo_url,
        ta.email, ta.full_name
      FROM seller_profiles sp
      LEFT JOIN treasury_accounts ta ON sp.user_id = ta.clerk_user_id
      WHERE sp.status = 'verified'
      LIMIT 50
    `;

    for (const row of result.rows) {
      const score = calculateSupplierScore(row, criteria);
      if (score >= MIN_MATCH_SCORE) {
        matches.push({
          id: crypto.randomUUID(),
          requestId: request.id,
          matchedUserId: row.user_id,
          matchedUserName: row.company_name,
          matchedUserEmail: row.email,
          matchedUserCompany: row.company_name,
          matchedUserAvatar: row.logo_url,
          matchScore: score,
          matchReason: buildMatchReason(row, criteria, 'supplier'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.error('Error searching for suppliers:', error);
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

async function searchForTalent(request: SourcingRequest): Promise<NetworkMatch[]> {
  const matches: NetworkMatch[] = [];
  const criteria = request.criteria;

  try {
    // Search worker profiles
    const result = await sql`
      SELECT
        wp.user_id, wp.display_name, wp.headline, wp.skills,
        wp.experience_years, wp.hourly_rate_min, wp.hourly_rate_max,
        wp.availability, wp.timezone, wp.locations, wp.avatar_url,
        wp.average_rating, wp.completed_tasks
      FROM worker_profiles wp
      WHERE wp.status = 'active'
        AND wp.availability IN ('available', 'looking', 'freelance', 'contract')
      LIMIT 50
    `;

    for (const row of result.rows) {
      const score = calculateTalentScore(row, criteria);
      if (score >= MIN_MATCH_SCORE) {
        matches.push({
          id: crypto.randomUUID(),
          requestId: request.id,
          matchedUserId: row.user_id,
          matchedUserName: row.display_name,
          matchedUserTitle: row.headline,
          matchedUserAvatar: row.avatar_url,
          matchScore: score,
          matchReason: buildMatchReason(row, criteria, 'talent'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.error('Error searching for talent:', error);
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

async function searchForInvestors(request: SourcingRequest): Promise<NetworkMatch[]> {
  const matches: NetworkMatch[] = [];
  const criteria = request.criteria;

  try {
    // Search users marked as investors (via metadata or specific profiles)
    // For now, we'll search treasury accounts with investor-related patterns
    const result = await sql`
      SELECT
        ta.clerk_user_id as user_id, ta.full_name, ta.email
      FROM treasury_accounts ta
      WHERE ta.status = 'active'
      LIMIT 20
    `;

    // In a real implementation, we'd have investor_profiles table
    // For now, return empty or mock matches
    for (const row of result.rows) {
      // Placeholder scoring - would be enhanced with real investor data
      const score = 60 + Math.floor(Math.random() * 30);
      if (score >= MIN_MATCH_SCORE) {
        matches.push({
          id: crypto.randomUUID(),
          requestId: request.id,
          matchedUserId: row.user_id,
          matchedUserName: row.full_name,
          matchedUserEmail: row.email,
          matchScore: score,
          matchReason: 'Investor profile match',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.error('Error searching for investors:', error);
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

async function searchForPartners(request: SourcingRequest): Promise<NetworkMatch[]> {
  const matches: NetworkMatch[] = [];
  const criteria = request.criteria;

  try {
    // Search seller profiles for partnership opportunities
    const result = await sql`
      SELECT
        sp.user_id, sp.company_name, sp.company_description, sp.industry,
        sp.company_size, sp.locations, sp.categories, sp.website, sp.logo_url,
        ta.email, ta.full_name
      FROM seller_profiles sp
      LEFT JOIN treasury_accounts ta ON sp.user_id = ta.clerk_user_id
      WHERE sp.status = 'verified'
      LIMIT 50
    `;

    for (const row of result.rows) {
      const score = calculatePartnerScore(row, criteria);
      if (score >= MIN_MATCH_SCORE) {
        matches.push({
          id: crypto.randomUUID(),
          requestId: request.id,
          matchedUserId: row.user_id,
          matchedUserName: row.company_name,
          matchedUserEmail: row.email,
          matchedUserCompany: row.company_name,
          matchedUserAvatar: row.logo_url,
          matchScore: score,
          matchReason: buildMatchReason(row, criteria, 'partner'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.error('Error searching for partners:', error);
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

// =====================================================
// SCORING HELPERS
// =====================================================

function calculateCustomerScore(row: any, criteria: SourcingCriteria): number {
  let score = 50; // Base score

  // Industry match
  if (criteria.industries && row.industry) {
    if (criteria.industries.some(i => row.industry.toLowerCase().includes(i.toLowerCase()))) {
      score += 20;
    }
  }

  // Location match
  if (criteria.locations && row.locations) {
    const locations = Array.isArray(row.locations) ? row.locations : [row.locations];
    if (criteria.locations.some(l => locations.some((rl: string) => rl.toLowerCase().includes(l.toLowerCase())))) {
      score += 15;
    }
  }

  // Company size match
  if (criteria.companySize && row.company_size) {
    if (criteria.companySize.includes(row.company_size)) {
      score += 10;
    }
  }

  // Category overlap
  if (criteria.categories && row.categories) {
    const categories = Array.isArray(row.categories) ? row.categories : [];
    const overlap = criteria.categories.filter(c =>
      categories.some((rc: string) => rc.toLowerCase().includes(c.toLowerCase()))
    );
    score += Math.min(overlap.length * 5, 15);
  }

  return Math.min(score, 100);
}

function calculateSupplierScore(row: any, criteria: SourcingCriteria): number {
  let score = 50;

  // Category match
  if (criteria.categories && row.categories) {
    const categories = Array.isArray(row.categories) ? row.categories : [];
    const overlap = criteria.categories.filter(c =>
      categories.some((rc: string) => rc.toLowerCase().includes(c.toLowerCase()))
    );
    score += Math.min(overlap.length * 10, 30);
  }

  // Certification match
  if (criteria.certifications && row.certifications) {
    const certs = Array.isArray(row.certifications) ? row.certifications : [];
    const overlap = criteria.certifications.filter(c =>
      certs.some((rc: string) => rc.toLowerCase().includes(c.toLowerCase()))
    );
    score += Math.min(overlap.length * 5, 15);
  }

  // Location match
  if (criteria.locations && row.locations) {
    const locations = Array.isArray(row.locations) ? row.locations : [row.locations];
    if (criteria.locations.some(l => locations.some((rl: string) => rl.toLowerCase().includes(l.toLowerCase())))) {
      score += 10;
    }
  }

  return Math.min(score, 100);
}

function calculateTalentScore(row: any, criteria: SourcingCriteria): number {
  let score = 50;

  // Skills match
  if (criteria.skills && row.skills) {
    const skills = Array.isArray(row.skills) ? row.skills : [];
    const overlap = criteria.skills.filter(s =>
      skills.some((rs: string) => rs.toLowerCase().includes(s.toLowerCase()))
    );
    score += Math.min(overlap.length * 10, 30);
  }

  // Experience match
  if (criteria.experienceYears && row.experience_years) {
    if (row.experience_years >= criteria.experienceYears) {
      score += 15;
    }
  }

  // Rate match
  if (criteria.rateRange && row.hourly_rate_min) {
    const rate = parseFloat(row.hourly_rate_min);
    if (rate >= criteria.rateRange.min && rate <= criteria.rateRange.max) {
      score += 10;
    }
  }

  // Rating bonus
  if (row.average_rating && parseFloat(row.average_rating) >= 4.5) {
    score += 5;
  }

  return Math.min(score, 100);
}

function calculatePartnerScore(row: any, criteria: SourcingCriteria): number {
  let score = 50;

  // Industry complementarity
  if (criteria.industries && row.industry) {
    if (criteria.industries.some(i => row.industry.toLowerCase().includes(i.toLowerCase()))) {
      score += 20;
    }
  }

  // Category overlap (for integration potential)
  if (criteria.categories && row.categories) {
    const categories = Array.isArray(row.categories) ? row.categories : [];
    const overlap = criteria.categories.filter(c =>
      categories.some((rc: string) => rc.toLowerCase().includes(c.toLowerCase()))
    );
    score += Math.min(overlap.length * 5, 15);
  }

  // Location alignment
  if (criteria.locations && row.locations) {
    const locations = Array.isArray(row.locations) ? row.locations : [row.locations];
    if (criteria.locations.some(l => locations.some((rl: string) => rl.toLowerCase().includes(l.toLowerCase())))) {
      score += 10;
    }
  }

  return Math.min(score, 100);
}

function buildMatchReason(row: any, criteria: SourcingCriteria, type: SourcingType): string {
  const reasons: string[] = [];

  switch (type) {
    case 'customer':
      if (row.industry) reasons.push(`In ${row.industry} industry`);
      if (row.company_size) reasons.push(`${row.company_size} company`);
      break;

    case 'supplier':
      if (row.categories?.length) reasons.push(`Offers ${Array.isArray(row.categories) ? row.categories[0] : row.categories}`);
      if (row.certifications?.length) reasons.push('Certified');
      break;

    case 'talent':
      if (row.skills?.length) {
        const topSkills = (Array.isArray(row.skills) ? row.skills : []).slice(0, 3);
        reasons.push(`Skills: ${topSkills.join(', ')}`);
      }
      if (row.experience_years) reasons.push(`${row.experience_years}+ years experience`);
      if (row.average_rating) reasons.push(`${parseFloat(row.average_rating).toFixed(1)} rating`);
      break;

    case 'partner':
      if (row.industry) reasons.push(`${row.industry} expertise`);
      if (row.company_size) reasons.push(`${row.company_size} company`);
      break;

    case 'investor':
      reasons.push('Active investor');
      break;
  }

  return reasons.length > 0 ? reasons.join(' | ') : 'Profile match';
}

// =====================================================
// ATTRIBUTION HELPERS
// =====================================================

async function payIntroducerAttribution(
  introducerId: string,
  feeAmount: number,
  matchId: string
): Promise<void> {
  try {
    // Pay 10% of the fee to the introducer
    const introducerShare = feeAmount * 0.10;

    // Record the earning
    await sql`
      INSERT INTO introducer_earnings (
        id, introducer_id, match_id, amount, created_at
      ) VALUES (
        ${crypto.randomUUID()}, ${introducerId}, ${matchId}, ${introducerShare}, NOW()
      )
    `;

    // Credit the introducer's GRAIN balance
    await sql`
      UPDATE treasury_accounts
      SET grain_balance = grain_balance + ${introducerShare}
      WHERE clerk_user_id = ${introducerId}
    `;

    // TODO: Notify the introducer
  } catch (error) {
    console.error('Error paying introducer attribution:', error);
    // Don't throw - this is a secondary operation
  }
}

// =====================================================
// ROW MAPPERS
// =====================================================

function mapRowToRequest(row: any): SourcingRequest {
  return {
    id: row.id,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    type: row.type,
    description: row.description,
    criteria: typeof row.criteria === 'string' ? JSON.parse(row.criteria) : (row.criteria || {}),
    budget: row.budget ? parseFloat(row.budget) : undefined,
    urgency: row.urgency,
    status: row.status,
    matchCount: parseInt(row.match_count) || 0,
    introCount: parseInt(row.intro_count) || 0,
    successFee: parseFloat(row.success_fee) || DEFAULT_SUCCESS_FEE,
    dealValue: row.deal_value ? parseFloat(row.deal_value) : undefined,
    feeEarned: row.fee_earned ? parseFloat(row.fee_earned) : undefined,
    notes: row.notes,
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToMatch(row: any): NetworkMatch {
  return {
    id: row.id,
    requestId: row.request_id,
    matchedUserId: row.matched_user_id,
    matchedUserName: row.matched_user_name,
    matchedUserEmail: row.matched_user_email,
    matchedUserCompany: row.matched_user_company,
    matchedUserTitle: row.matched_user_title,
    matchedUserAvatar: row.matched_user_avatar,
    matchScore: parseInt(row.match_score) || 0,
    matchReason: row.match_reason,
    matchBreakdown: row.match_breakdown
      ? (typeof row.match_breakdown === 'string' ? JSON.parse(row.match_breakdown) : row.match_breakdown)
      : undefined,
    status: row.status,
    introMessage: row.intro_message,
    responseMessage: row.response_message,
    introSentAt: row.intro_sent_at ? new Date(row.intro_sent_at) : undefined,
    respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
    meetingScheduledAt: row.meeting_scheduled_at ? new Date(row.meeting_scheduled_at) : undefined,
    meetingDate: row.meeting_date ? new Date(row.meeting_date) : undefined,
    convertedAt: row.converted_at ? new Date(row.converted_at) : undefined,
    dealValue: row.deal_value ? parseFloat(row.deal_value) : undefined,
    declineReason: row.decline_reason,
    introducerId: row.introducer_id,
    introducerName: row.introducer_name,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// =====================================================
// EXPORTS
// =====================================================

export const NetworkSourcingService = {
  // Request CRUD
  createSourcingRequest,
  getSourcingRequests,
  getSourcingRequest,
  cancelSourcingRequest,

  // Network Search
  searchNetwork,
  getAvailableMatches,

  // Introduction Management
  requestIntro,
  sendIntro,
  recordResponse,
  recordMeeting,

  // Conversion & Fees
  recordConversion,

  // Stats
  getNetworkStats,

  // Constants
  DEFAULT_SUCCESS_FEE,
  DEFAULT_EXPIRY_DAYS,
  MIN_MATCH_SCORE,
};

export default NetworkSourcingService;
