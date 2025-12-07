// @ts-nocheck
/**
 * AI Team Context Service
 *
 * Provides team-aware context to the AI
 * Enables intelligent routing, handoff suggestions, and team coordination
 */

import { sql } from '@vercel/postgres'
import Anthropic from '@anthropic-ai/sdk'
import { getOrganization, getOrganizationMembers, getUserTeams } from './team-service'
import { getRecentActivity } from './activity'
import { getMyAssignments } from './assignments'
import { getPendingHandoffs } from './handoffs'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TEAM CONTEXT FOR AI
// ============================================================================

/**
 * Get comprehensive team context for AI prompts
 * This is injected into the AI's system prompt to make it team-aware
 */
export async function getTeamContext(
  userId: string,
  orgId: string
): Promise<string> {
  try {
    // Get organization details
    const org = await getOrganization(orgId)
    if (!org) {
      return ''
    }

    // Get team members
    const members = await getOrganizationMembers(orgId)

    // Get user's teams
    const userTeams = await getUserTeams(orgId, userId)

    // Get user's assignments
    const assignments = await getMyAssignments(userId, { status: 'active', limit: 5 })

    // Get pending handoffs
    const pendingHandoffs = await getPendingHandoffs(userId)

    // Get recent activity
    const recentActivity = await getRecentActivity(orgId, 10)

    // Build context string
    let context = `\n\nTEAM CONTEXT (${org.name}):\n\n`

    // Organization overview
    context += `Organization: ${org.name}\n`
    context += `Team size: ${members.length} members\n\n`

    // Team members
    context += `TEAM MEMBERS:\n`
    for (const member of members) {
      const roleEmoji = member.role === 'owner' ? '👑' : member.role === 'admin' ? '⭐' : '👤'
      context += `${roleEmoji} ${member.displayName || member.userId} (${member.role})`
      if (member.title) {
        context += ` - ${member.title}`
      }
      if (member.userId === userId) {
        context += ' [YOU]'
      }
      context += '\n'
    }

    // User's teams
    if (userTeams.length > 0) {
      context += `\nYOUR TEAMS:\n`
      for (const team of userTeams) {
        context += `- ${team.name}`
        if (team.focusArea) {
          context += ` (${team.focusArea})`
        }
        context += '\n'
      }
    }

    // Active assignments
    if (assignments.length > 0) {
      context += `\nYOUR ACTIVE ASSIGNMENTS:\n`
      for (const assignment of assignments) {
        context += `- ${assignment.entityType}: ${assignment.entityId}\n`
      }
    }

    // Pending handoffs
    if (pendingHandoffs.length > 0) {
      context += `\nPENDING HANDOFFS TO YOU:\n`
      for (const handoff of pendingHandoffs) {
        context += `- ${handoff.entityType} from ${handoff.fromUser}`
        if (handoff.reason) {
          context += `: ${handoff.reason}`
        }
        context += '\n'
      }
    }

    // Recent team activity
    if (recentActivity.length > 0) {
      context += `\nRECENT TEAM ACTIVITY:\n`
      for (const activity of recentActivity.slice(0, 5)) {
        context += `- ${activity.actionType} on ${activity.entityType} by ${activity.userId || 'system'}\n`
      }
    }

    context += `\nIMPORTANT:\n`
    context += `- You can see team members and their roles\n`
    context += `- You can suggest handoffs when questions need specific expertise\n`
    context += `- You maintain context across team conversations about the same entity\n`
    context += `- You respect role permissions when taking actions\n`

    return context
  } catch (error) {
    console.error('Error building team context:', error)
    return ''
  }
}

/**
 * Suggest which team member should handle a conversation
 * Uses AI to analyze the conversation and match to team member expertise
 */
export async function suggestHandoff(
  conversationContent: string,
  teamMembers: Array<{
    userId: string
    name: string
    role: string
    title?: string
    department?: string
  }>
): Promise<{
  suggestedMember: string | null
  reason: string
  confidence: number
}> {
  try {
    // Build team member context
    const memberContext = teamMembers.map(m => {
      let desc = `- ${m.name} (${m.role})`
      if (m.title) desc += ` - ${m.title}`
      if (m.department) desc += ` - ${m.department}`
      return desc
    }).join('\n')

    const prompt = `Based on this conversation, which team member should handle it?

CONVERSATION:
${conversationContent}

TEAM MEMBERS:
${memberContext}

Analyze the conversation and suggest the most appropriate team member to handle it.
Consider their role, title, and department when making the suggestion.

Respond with JSON:
{
  "suggestedMember": "user_id or name",
  "reason": "why this person is best suited",
  "confidence": 0.0-1.0
}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return {
        suggestedMember: null,
        reason: 'Unable to analyze conversation',
        confidence: 0,
      }
    }

    // Parse JSON response
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        suggestedMember: null,
        reason: 'Unable to parse AI response',
        confidence: 0,
      }
    }

    const result = JSON.parse(jsonMatch[0])

    return {
      suggestedMember: result.suggestedMember || null,
      reason: result.reason || 'No reason provided',
      confidence: result.confidence || 0.5,
    }
  } catch (error) {
    console.error('Error suggesting handoff:', error)
    return {
      suggestedMember: null,
      reason: 'Error analyzing conversation',
      confidence: 0,
    }
  }
}

/**
 * Get relevant team history for a query
 * Searches through team conversations and activities to find relevant context
 */
export async function getRelevantTeamHistory(
  query: string,
  orgId: string,
  options?: {
    entityType?: string
    limit?: number
  }
): Promise<Array<{
  type: 'activity' | 'comment'
  content: string
  userId: string
  entityType: string
  entityId: string
  createdAt: Date
}>> {
  try {
    const limit = options?.limit || 10

    // Get recent activities
    const activities = await getRecentActivity(orgId, 50)

    // Get recent comments
    let commentsQuery = `
      SELECT c.*, c.entity_type, c.entity_id
      FROM comments c
      INNER JOIN activity_log a ON a.entity_id = c.entity_id AND a.entity_type = c.entity_type
      WHERE a.org_id = $1
      ORDER BY c.created_at DESC
      LIMIT 50
    `

    const params = [orgId]
    const commentsResult = await sql.query(commentsQuery, params)

    // Combine and use AI to rank relevance
    const allItems = [
      ...activities.map(a => ({
        type: 'activity' as const,
        content: `${a.actionType} on ${a.entityType}`,
        userId: a.userId || 'system',
        entityType: a.entityType,
        entityId: a.entityId,
        createdAt: a.createdAt,
      })),
      ...commentsResult.rows.map(c => ({
        type: 'comment' as const,
        content: c.content,
        userId: c.user_id,
        entityType: c.entity_type,
        entityId: c.entity_id,
        createdAt: c.created_at,
      })),
    ]

    // Use AI to rank by relevance (simple keyword matching for now)
    const keywords = query.toLowerCase().split(' ')
    const scored = allItems.map(item => ({
      item,
      score: keywords.reduce((score, keyword) => {
        if (item.content.toLowerCase().includes(keyword)) {
          return score + 1
        }
        return score
      }, 0),
    }))

    // Sort by score and return top results
    const sorted = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.item)

    return sorted
  } catch (error) {
    console.error('Error getting relevant team history:', error)
    return []
  }
}

/**
 * Generate a team summary for AI context
 * Used when the AI needs to understand overall team dynamics
 */
export async function generateTeamSummary(orgId: string): Promise<string> {
  try {
    const org = await getOrganization(orgId)
    if (!org) {
      return 'No organization found'
    }

    const members = await getOrganizationMembers(orgId)
    const recentActivity = await getRecentActivity(orgId, 50)

    // Count activities by type
    const activityCounts: Record<string, number> = {}
    for (const activity of recentActivity) {
      activityCounts[activity.actionType] = (activityCounts[activity.actionType] || 0) + 1
    }

    // Build summary
    let summary = `Team Summary for ${org.name}:\n\n`
    summary += `Size: ${members.length} members\n`
    summary += `Roles: ${members.filter(m => m.role === 'owner').length} owners, `
    summary += `${members.filter(m => m.role === 'admin').length} admins, `
    summary += `${members.filter(m => m.role === 'member').length} members\n\n`

    summary += `Recent Activity (last 24h):\n`
    const topActivities = Object.entries(activityCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    for (const [type, count] of topActivities) {
      summary += `- ${type}: ${count}\n`
    }

    return summary
  } catch (error) {
    console.error('Error generating team summary:', error)
    return 'Unable to generate team summary'
  }
}

/**
 * Check if an action requires team approval
 * Uses organization settings and role permissions
 */
export async function requiresTeamApproval(
  orgId: string,
  actionType: string,
  metadata?: Record<string, any>
): Promise<{
  required: boolean
  approvers: string[]
  reason?: string
}> {
  try {
    const org = await getOrganization(orgId)
    if (!org) {
      return { required: false, approvers: [] }
    }

    // Check organization settings for approval rules
    const approvalRules = org.settings?.approvalRules || {}

    // Financial approvals
    if (actionType === 'payment' && metadata?.amount) {
      const amount = metadata.amount
      const threshold = approvalRules.paymentApprovalThreshold || 10000

      if (amount > threshold) {
        // Get admins and owners
        const members = await getOrganizationMembers(orgId)
        const approvers = members
          .filter(m => m.role === 'owner' || m.role === 'admin')
          .map(m => m.userId)

        return {
          required: true,
          approvers,
          reason: `Payment amount ${amount} exceeds threshold ${threshold}`,
        }
      }
    }

    // Deal closure approvals
    if (actionType === 'deal.close' && metadata?.value) {
      const value = metadata.value
      const threshold = approvalRules.dealApprovalThreshold || 50000

      if (value > threshold) {
        const members = await getOrganizationMembers(orgId)
        const approvers = members
          .filter(m => m.role === 'owner' || m.role === 'admin')
          .map(m => m.userId)

        return {
          required: true,
          approvers,
          reason: `Deal value ${value} exceeds threshold ${threshold}`,
        }
      }
    }

    return { required: false, approvers: [] }
  } catch (error) {
    console.error('Error checking approval requirements:', error)
    return { required: false, approvers: [] }
  }
}
