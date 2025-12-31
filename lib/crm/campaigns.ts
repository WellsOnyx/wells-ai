/**
 * CRM Campaign Management
 *
 * Handles campaign CRUD operations, scheduling, and statistics
 */

import { query } from '../db'
import { getContacts } from './contacts'
import type { Campaign, Contact } from './types'

// ============================================================================
// Campaign CRUD Operations
// ============================================================================

/**
 * Create a new campaign
 */
export async function createCampaign(
  userId: string,
  data: {
    name: string
    description?: string
    channel: Campaign['channel']
    subject?: string
    body: string
    listIds?: string[]
    tagFilters?: string[]
    templateId?: string
    sendRateLimit?: number
    timezone?: string
  }
): Promise<Campaign> {
  const result = await query<Campaign>(
    `INSERT INTO crm_campaigns (
      user_id, name, description, channel, subject, body,
      list_ids, tag_filters, template_id, send_rate_limit, timezone
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      userId,
      data.name,
      data.description || null,
      data.channel,
      data.subject || null,
      data.body,
      data.listIds || [],
      data.tagFilters || [],
      data.templateId || null,
      data.sendRateLimit || 60,
      data.timezone || 'America/New_York'
    ]
  )

  return result.rows[0]
}

/**
 * Update an existing campaign
 */
export async function updateCampaign(
  userId: string,
  campaignId: string,
  data: Partial<{
    name: string
    description: string
    channel: Campaign['channel']
    subject: string
    body: string
    listIds: string[]
    tagFilters: string[]
    templateId: string
    sendRateLimit: number
    timezone: string
    scheduledAt: string
  }>
): Promise<Campaign | null> {
  const updates: string[] = []
  const params: any[] = []
  let paramIndex = 1

  const fieldMappings: Record<string, string> = {
    name: 'name',
    description: 'description',
    channel: 'channel',
    subject: 'subject',
    body: 'body',
    listIds: 'list_ids',
    tagFilters: 'tag_filters',
    templateId: 'template_id',
    sendRateLimit: 'send_rate_limit',
    timezone: 'timezone',
    scheduledAt: 'scheduled_at'
  }

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && fieldMappings[key]) {
      updates.push(`${fieldMappings[key]} = $${paramIndex}`)
      params.push(value)
      paramIndex++
    }
  }

  if (updates.length === 0) return null

  params.push(campaignId, userId)

  const result = await query<Campaign>(
    `UPDATE crm_campaigns
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
    RETURNING *`,
    params
  )

  return result.rows[0] || null
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(
  userId: string,
  campaignId: string
): Promise<boolean> {
  // Only allow deleting draft or cancelled campaigns
  const result = await query(
    `DELETE FROM crm_campaigns
    WHERE id = $1 AND user_id = $2 AND status IN ('draft', 'cancelled')`,
    [campaignId, userId]
  )

  return result.rowCount > 0
}

/**
 * Get all campaigns for a user
 */
export async function getCampaigns(
  userId: string,
  options: {
    status?: Campaign['status']
    channel?: Campaign['channel']
    limit?: number
    offset?: number
    sortBy?: string
    sortDir?: 'asc' | 'desc'
  } = {}
): Promise<{ campaigns: Campaign[]; total: number }> {
  const {
    status,
    channel,
    limit = 50,
    offset = 0,
    sortBy = 'created_at',
    sortDir = 'desc'
  } = options

  let whereClause = 'WHERE user_id = $1'
  const params: any[] = [userId]
  let paramIndex = 2

  if (status) {
    whereClause += ` AND status = $${paramIndex}`
    params.push(status)
    paramIndex++
  }

  if (channel) {
    whereClause += ` AND channel = $${paramIndex}`
    params.push(channel)
    paramIndex++
  }

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM crm_campaigns ${whereClause}`,
    params
  )
  const total = parseInt(countResult.rows[0]?.count || '0', 10)

  // Validate sort column
  const allowedSortColumns = ['created_at', 'updated_at', 'name', 'scheduled_at', 'sent_count']
  const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at'
  const sortDirection = sortDir === 'asc' ? 'ASC' : 'DESC'

  // Get campaigns
  const result = await query<Campaign>(
    `SELECT * FROM crm_campaigns
    ${whereClause}
    ORDER BY ${sortColumn} ${sortDirection}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  )

  return {
    campaigns: result.rows,
    total
  }
}

/**
 * Get a single campaign by ID
 */
export async function getCampaign(
  userId: string,
  campaignId: string
): Promise<Campaign | null> {
  const result = await query<Campaign>(
    `SELECT * FROM crm_campaigns WHERE id = $1 AND user_id = $2`,
    [campaignId, userId]
  )

  return result.rows[0] || null
}

// ============================================================================
// Campaign State Management
// ============================================================================

/**
 * Start sending a campaign immediately
 */
export async function startCampaign(
  userId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  // Get campaign
  const campaign = await getCampaign(userId, campaignId)

  if (!campaign) {
    return { success: false, error: 'Campaign not found' }
  }

  if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
    return { success: false, error: `Cannot start campaign with status: ${campaign.status}` }
  }

  // Calculate total recipients
  const contactFilter: any = { status: 'active' }

  if (campaign.list_ids && campaign.list_ids.length > 0) {
    contactFilter.listId = campaign.list_ids[0]
  }

  if (campaign.tag_filters && campaign.tag_filters.length > 0) {
    contactFilter.tags = campaign.tag_filters
  }

  const { total } = await getContacts(userId, { ...contactFilter, limit: 1 })

  // Update campaign status
  await query(
    `UPDATE crm_campaigns
    SET status = 'sending', started_at = NOW(), total_recipients = $1
    WHERE id = $2 AND user_id = $3`,
    [total, campaignId, userId]
  )

  return { success: true }
}

/**
 * Pause a running campaign
 */
export async function pauseCampaign(
  userId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await query(
    `UPDATE crm_campaigns
    SET status = 'paused'
    WHERE id = $1 AND user_id = $2 AND status = 'sending'`,
    [campaignId, userId]
  )

  if (result.rowCount === 0) {
    return { success: false, error: 'Campaign not found or not currently sending' }
  }

  return { success: true }
}

/**
 * Resume a paused campaign
 */
export async function resumeCampaign(
  userId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await query(
    `UPDATE crm_campaigns
    SET status = 'sending'
    WHERE id = $1 AND user_id = $2 AND status = 'paused'`,
    [campaignId, userId]
  )

  if (result.rowCount === 0) {
    return { success: false, error: 'Campaign not found or not currently paused' }
  }

  return { success: true }
}

/**
 * Cancel a campaign
 */
export async function cancelCampaign(
  userId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await query(
    `UPDATE crm_campaigns
    SET status = 'cancelled'
    WHERE id = $1 AND user_id = $2 AND status IN ('draft', 'scheduled', 'sending', 'paused')`,
    [campaignId, userId]
  )

  if (result.rowCount === 0) {
    return { success: false, error: 'Campaign not found or already completed' }
  }

  // Mark pending messages as cancelled
  await query(
    `UPDATE crm_messages
    SET status = 'failed', error_message = 'Campaign cancelled'
    WHERE campaign_id = $1 AND status = 'pending'`,
    [campaignId]
  )

  return { success: true }
}

/**
 * Schedule a campaign for future sending
 */
export async function scheduleCampaign(
  userId: string,
  campaignId: string,
  scheduledAt: string | Date
): Promise<{ success: boolean; error?: string }> {
  const scheduledDate = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt

  // Validate date is in the future
  if (scheduledDate <= new Date()) {
    return { success: false, error: 'Scheduled time must be in the future' }
  }

  const result = await query(
    `UPDATE crm_campaigns
    SET status = 'scheduled', scheduled_at = $1
    WHERE id = $2 AND user_id = $3 AND status = 'draft'`,
    [scheduledDate.toISOString(), campaignId, userId]
  )

  if (result.rowCount === 0) {
    return { success: false, error: 'Campaign not found or not in draft status' }
  }

  return { success: true }
}

// ============================================================================
// Campaign Statistics
// ============================================================================

export interface CampaignStats {
  totalRecipients: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  unsubscribed: number
  deliveryRate: number
  openRate: number
  clickRate: number
  replyRate: number
  bounceRate: number
}

/**
 * Get detailed statistics for a campaign
 */
export async function getCampaignStats(
  userId: string,
  campaignId: string
): Promise<CampaignStats | null> {
  // Get campaign
  const campaign = await getCampaign(userId, campaignId)

  if (!campaign) {
    return null
  }

  // Calculate rates
  const total = campaign.total_recipients || 1
  const sent = campaign.sent_count || 0
  const delivered = campaign.delivered_count || 0

  return {
    totalRecipients: campaign.total_recipients,
    sent: campaign.sent_count,
    delivered: campaign.delivered_count,
    opened: campaign.opened_count,
    clicked: campaign.clicked_count,
    replied: campaign.replied_count,
    bounced: campaign.bounced_count,
    unsubscribed: campaign.unsubscribed_count,
    deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
    openRate: delivered > 0 ? (campaign.opened_count / delivered) * 100 : 0,
    clickRate: delivered > 0 ? (campaign.clicked_count / delivered) * 100 : 0,
    replyRate: delivered > 0 ? (campaign.replied_count / delivered) * 100 : 0,
    bounceRate: sent > 0 ? (campaign.bounced_count / sent) * 100 : 0
  }
}

/**
 * Get aggregate campaign statistics for a user
 */
export async function getUserCampaignStats(
  userId: string,
  options: { days?: number } = {}
): Promise<{
  totalCampaigns: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  avgOpenRate: number
  avgClickRate: number
  campaignsByStatus: Record<string, number>
  campaignsByChannel: Record<string, number>
}> {
  const { days = 30 } = options

  const result = await query<{
    total_campaigns: string
    total_sent: string
    total_delivered: string
    total_opened: string
    total_clicked: string
  }>(
    `SELECT
      COUNT(*) as total_campaigns,
      COALESCE(SUM(sent_count), 0) as total_sent,
      COALESCE(SUM(delivered_count), 0) as total_delivered,
      COALESCE(SUM(opened_count), 0) as total_opened,
      COALESCE(SUM(clicked_count), 0) as total_clicked
    FROM crm_campaigns
    WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${days} days'`,
    [userId]
  )

  const statusResult = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count
    FROM crm_campaigns
    WHERE user_id = $1
    GROUP BY status`,
    [userId]
  )

  const channelResult = await query<{ channel: string; count: string }>(
    `SELECT channel, COUNT(*) as count
    FROM crm_campaigns
    WHERE user_id = $1
    GROUP BY channel`,
    [userId]
  )

  const stats = result.rows[0]
  const totalSent = parseInt(stats?.total_sent || '0', 10)
  const totalDelivered = parseInt(stats?.total_delivered || '0', 10)
  const totalOpened = parseInt(stats?.total_opened || '0', 10)
  const totalClicked = parseInt(stats?.total_clicked || '0', 10)

  const campaignsByStatus: Record<string, number> = {}
  for (const row of statusResult.rows) {
    campaignsByStatus[row.status] = parseInt(row.count, 10)
  }

  const campaignsByChannel: Record<string, number> = {}
  for (const row of channelResult.rows) {
    campaignsByChannel[row.channel] = parseInt(row.count, 10)
  }

  return {
    totalCampaigns: parseInt(stats?.total_campaigns || '0', 10),
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    avgOpenRate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
    avgClickRate: totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0,
    campaignsByStatus,
    campaignsByChannel
  }
}

/**
 * Get campaign messages with filtering
 */
export async function getCampaignMessages(
  userId: string,
  campaignId: string,
  options: {
    status?: string
    limit?: number
    offset?: number
  } = {}
): Promise<{ messages: any[]; total: number }> {
  const { status, limit = 50, offset = 0 } = options

  let whereClause = 'WHERE m.campaign_id = $1 AND m.user_id = $2'
  const params: any[] = [campaignId, userId]
  let paramIndex = 3

  if (status) {
    whereClause += ` AND m.status = $${paramIndex}`
    params.push(status)
    paramIndex++
  }

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM crm_messages m ${whereClause}`,
    params
  )
  const total = parseInt(countResult.rows[0]?.count || '0', 10)

  // Get messages with contact info
  const result = await query(
    `SELECT m.*, c.first_name, c.last_name, c.email, c.phone
    FROM crm_messages m
    LEFT JOIN crm_contacts c ON m.contact_id = c.id
    ${whereClause}
    ORDER BY m.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  )

  return {
    messages: result.rows,
    total
  }
}

/**
 * Duplicate a campaign
 */
export async function duplicateCampaign(
  userId: string,
  campaignId: string,
  newName?: string
): Promise<Campaign | null> {
  const campaign = await getCampaign(userId, campaignId)

  if (!campaign) {
    return null
  }

  const result = await query<Campaign>(
    `INSERT INTO crm_campaigns (
      user_id, name, description, channel, subject, body,
      list_ids, tag_filters, template_id, send_rate_limit, timezone, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft')
    RETURNING *`,
    [
      userId,
      newName || `${campaign.name} (Copy)`,
      campaign.description,
      campaign.channel,
      campaign.subject,
      campaign.body,
      campaign.list_ids,
      campaign.tag_filters,
      campaign.template_id,
      campaign.send_rate_limit,
      campaign.timezone
    ]
  )

  return result.rows[0]
}
