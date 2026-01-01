/**
 * Companion Memory Service
 *
 * Persists the emotional relationship between Wells and each user.
 * "I am Wells. I am Ghost."
 */

import { sqlQuery } from '@/lib/db'
import type { CompanionMemory, EmotionalState } from './ghost'
import {
  detectEmotionalSignals,
  assessEmotionalState,
  getEmotionalResponse,
  getGhostSystemPrompt,
  updateCompanionMemory,
} from './ghost'

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Get or create companion memory for a user
 */
export async function getOrCreateCompanionMemory(
  userId: string,
  initialData?: {
    name?: string
    company?: string
    role?: string
  }
): Promise<CompanionMemory> {
  // Try to get existing memory
  const result = await sqlQuery(`
    SELECT * FROM companion_memories WHERE user_id = $1
  `, [userId])

  if (result.rows.length > 0) {
    return rowToCompanionMemory(result.rows[0])
  }

  // Create new memory
  const insertResult = await sqlQuery(`
    INSERT INTO companion_memories (user_id, name, company, role)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [userId, initialData?.name || '', initialData?.company || '', initialData?.role || ''])

  return rowToCompanionMemory(insertResult.rows[0])
}

/**
 * Update companion memory after an interaction
 */
export async function updateCompanionMemoryInDb(
  userId: string,
  updates: Partial<{
    name: string
    preferredName: string
    company: string
    role: string
    industry: string
    teamSize: string
    communicationStyle: 'brief' | 'detailed' | 'casual' | 'formal'
    decisionSpeed: 'quick' | 'deliberate' | 'varies'
    riskTolerance: 'conservative' | 'balanced' | 'aggressive'
    priceVsQuality: 'price_focused' | 'balanced' | 'quality_focused'
    priorities: string[]
    painPoints: string[]
    celebrations: string[]
    dealsCompleted: number
    totalVolume: number
    biggestWin: string
  }>
): Promise<void> {
  const setClauses: string[] = ['updated_at = NOW()']
  const values: any[] = [userId]
  let paramIndex = 2

  if (updates.name) {
    setClauses.push(`name = $${paramIndex++}`)
    values.push(updates.name)
  }
  if (updates.preferredName) {
    setClauses.push(`preferred_name = $${paramIndex++}`)
    values.push(updates.preferredName)
  }
  if (updates.company) {
    setClauses.push(`company = $${paramIndex++}`)
    values.push(updates.company)
  }
  if (updates.role) {
    setClauses.push(`role = $${paramIndex++}`)
    values.push(updates.role)
  }
  if (updates.industry) {
    setClauses.push(`industry = $${paramIndex++}`)
    values.push(updates.industry)
  }
  if (updates.teamSize) {
    setClauses.push(`team_size = $${paramIndex++}`)
    values.push(updates.teamSize)
  }
  if (updates.communicationStyle) {
    setClauses.push(`communication_style = $${paramIndex++}`)
    values.push(updates.communicationStyle)
  }
  if (updates.decisionSpeed) {
    setClauses.push(`decision_speed = $${paramIndex++}`)
    values.push(updates.decisionSpeed)
  }
  if (updates.riskTolerance) {
    setClauses.push(`risk_tolerance = $${paramIndex++}`)
    values.push(updates.riskTolerance)
  }
  if (updates.priceVsQuality) {
    setClauses.push(`price_vs_quality = $${paramIndex++}`)
    values.push(updates.priceVsQuality)
  }
  if (updates.priorities) {
    setClauses.push(`priorities = $${paramIndex++}`)
    values.push(updates.priorities)
  }
  if (updates.painPoints) {
    setClauses.push(`pain_points = $${paramIndex++}`)
    values.push(updates.painPoints)
  }
  if (updates.celebrations) {
    setClauses.push(`celebrations = $${paramIndex++}`)
    values.push(updates.celebrations)
  }
  if (updates.dealsCompleted !== undefined) {
    setClauses.push(`deals_completed = $${paramIndex++}`)
    values.push(updates.dealsCompleted)
  }
  if (updates.totalVolume !== undefined) {
    setClauses.push(`total_volume = $${paramIndex++}`)
    values.push(updates.totalVolume)
  }
  if (updates.biggestWin) {
    setClauses.push(`biggest_win = $${paramIndex++}`)
    values.push(updates.biggestWin)
  }

  // Increment conversation count
  setClauses.push('conversation_count = conversation_count + 1')

  await sqlQuery(`
    UPDATE companion_memories
    SET ${setClauses.join(', ')}
    WHERE user_id = $1
  `, values)
}

/**
 * Record an emotional signal
 */
export async function recordEmotionalSignal(
  userId: string,
  signalType: EmotionalState['signals'][0]['type'],
  detectedFrom: string,
  messageExcerpt?: string
): Promise<void> {
  await sqlQuery(`
    INSERT INTO emotional_signals (user_id, signal_type, detected_from, message_excerpt)
    VALUES ($1, $2, $3, $4)
  `, [userId, signalType, detectedFrom, messageExcerpt?.slice(0, 200)])
}

/**
 * Get recent emotional signals for a user
 */
export async function getRecentEmotionalSignals(
  userId: string,
  minutesBack: number = 30
): Promise<EmotionalState['signals']> {
  const result = await sqlQuery(`
    SELECT signal_type, detected_from, detected_at
    FROM emotional_signals
    WHERE user_id = $1
      AND detected_at > NOW() - INTERVAL '${minutesBack} minutes'
    ORDER BY detected_at DESC
  `, [userId])

  return result.rows.map(row => ({
    type: row.signal_type,
    detected: row.detected_from,
    timestamp: new Date(row.detected_at),
  }))
}

/**
 * Record an emotional state snapshot
 */
export async function recordEmotionalState(
  userId: string,
  state: Omit<EmotionalState, 'signals'>,
  sessionId?: string
): Promise<string> {
  const result = await sqlQuery(`
    INSERT INTO emotional_states (user_id, stress, urgency, confidence, energy, session_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `, [userId, state.stress, state.urgency, state.confidence, state.energy, sessionId])

  return result.rows[0].id
}

// ============================================================================
// GHOST INTEGRATION
// ============================================================================

/**
 * Process a user message and get emotional context for the response
 */
export async function processMessageWithGhost(
  userId: string,
  message: string,
  profile?: { firstName?: string; lastName?: string; company?: string; role?: string }
): Promise<{
  companionMemory: CompanionMemory
  emotionalState: EmotionalState
  emotionalOpener: string
  ghostSystemPrompt: string
}> {
  // Get or create companion memory
  const companionMemory = await getOrCreateCompanionMemory(userId, {
    name: profile?.firstName || undefined,
    company: profile?.company,
    role: profile?.role,
  })

  // Detect emotional signals in the message
  const newSignals = detectEmotionalSignals(message)

  // Record each signal to the database
  for (const signal of newSignals) {
    await recordEmotionalSignal(userId, signal.type, signal.detected, message)
  }

  // Get all recent signals (including the new ones)
  const allRecentSignals = await getRecentEmotionalSignals(userId)

  // Build full emotional state
  const emotionalState: EmotionalState = {
    ...assessEmotionalState(allRecentSignals),
    signals: allRecentSignals,
  }

  // Record the state snapshot
  await recordEmotionalState(userId, emotionalState)

  // Get emotionally appropriate opener
  const emotionalOpener = getEmotionalResponse(emotionalState, companionMemory)

  // Get the full Ghost system prompt
  const ghostSystemPrompt = getGhostSystemPrompt(companionMemory)

  // Update companion memory with this interaction
  await updateCompanionMemoryInDb(userId, {
    painPoints: emotionalState.signals.some(s => s.type === 'frustration')
      ? [...companionMemory.painPoints, message.slice(0, 100)].slice(-10)
      : undefined,
    celebrations: emotionalState.signals.some(s => s.type === 'celebration')
      ? [...companionMemory.celebrations, message.slice(0, 100)].slice(-10)
      : undefined,
  })

  return {
    companionMemory,
    emotionalState,
    emotionalOpener,
    ghostSystemPrompt,
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function rowToCompanionMemory(row: any): CompanionMemory {
  return {
    userId: row.user_id,
    name: row.name || '',
    preferredName: row.preferred_name || undefined,
    company: row.company || undefined,
    role: row.role || undefined,
    industry: row.industry || undefined,
    teamSize: row.team_size || undefined,
    preferences: {
      communicationStyle: row.communication_style || 'casual',
      decisionSpeed: row.decision_speed || 'varies',
      riskTolerance: row.risk_tolerance || 'balanced',
      priceVsQuality: row.price_vs_quality || 'balanced',
      preferredPaymentTerms: row.preferred_payment_terms || undefined,
      preferredDeliverySpeed: row.preferred_delivery_speed || undefined,
    },
    relationship: {
      firstMet: new Date(row.first_met || Date.now()),
      conversationCount: row.conversation_count || 0,
      dealsCompleted: row.deals_completed || 0,
      totalVolume: parseFloat(row.total_volume) || 0,
      biggestWin: row.biggest_win || undefined,
      hardestChallenge: row.hardest_challenge || undefined,
      insideJokes: row.inside_jokes || [],
    },
    priorities: row.priorities || [],
    painPoints: row.pain_points || [],
    celebrations: row.celebrations || [],
    upcomingNeeds: row.upcoming_needs || [],
  }
}

export {
  detectEmotionalSignals,
  assessEmotionalState,
  getEmotionalResponse,
  getGhostSystemPrompt,
  updateCompanionMemory,
}
