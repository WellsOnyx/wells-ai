/**
 * Partner SDK - Learning System
 * Reinforcement learning from action outcomes
 */

import {
  PartnerPlatform,
  PartnerOpportunity,
  SuggestedAction,
  LearningRecord,
  PlaybookResult,
} from './types'

export interface LearningConfig {
  enabled: boolean
  storage?: 'local' | 'remote'
  retention?: number
}

export class LearningSystem {
  private partner: PartnerPlatform
  private config: LearningConfig
  private records: LearningRecord[] = []
  private patterns: Map<string, number> = new Map()

  constructor(partner: PartnerPlatform, config: LearningConfig) {
    this.partner = partner
    this.config = config

    if (!config.enabled) {
      console.log('[Learning] Disabled for', partner)
    } else {
      console.log('[Learning] Enabled for', partner)
    }
  }

  /**
   * Record successful execution
   */
  async recordExecution(action: SuggestedAction, result: PlaybookResult): Promise<void> {
    if (!this.config.enabled) return

    const record: LearningRecord = {
      id: `learn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      partner: this.partner,
      action,
      outcome: {
        approved: true,
        executed: result.success,
        result: result.success ? 'success' : 'failure',
      },
      feedback: {
        quality: result.success ? 8 : 4,
        accuracy: result.success ? 9 : 5,
        notes: result.error,
      },
      patterns: this.extractPatterns(action.opportunity),
      timestamp: new Date(),
    }

    this.records.push(record)

    // Update pattern weights
    this.updatePatterns(record)

    console.log('[Learning] Recorded execution:', {
      action: action.type,
      result: record.outcome.result,
      quality: record.feedback.quality,
    })
  }

  /**
   * Record rejected action
   */
  async recordRejection(action: SuggestedAction, reason: string): Promise<void> {
    if (!this.config.enabled) return

    const record: LearningRecord = {
      id: `learn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      partner: this.partner,
      action,
      outcome: {
        approved: false,
        executed: false,
      },
      feedback: {
        quality: 3, // Low quality if rejected
        accuracy: 4,
        notes: reason,
      },
      patterns: this.extractPatterns(action.opportunity),
      timestamp: new Date(),
    }

    this.records.push(record)

    // Update pattern weights (negative)
    this.updatePatterns(record, -1)

    console.log('[Learning] Recorded rejection:', {
      action: action.type,
      reason,
    })
  }

  /**
   * Predict confidence for action type + opportunity
   */
  async predictConfidence(actionType: string, opportunity: PartnerOpportunity): Promise<number> {
    if (!this.config.enabled) {
      return 70 // Default confidence when learning disabled
    }

    // Find similar past actions
    const similar = this.records.filter(r => {
      return (
        r.action.type === actionType &&
        this.isSimilar(r.action.opportunity, opportunity)
      )
    })

    if (similar.length === 0) {
      return 65 // Default for new pattern
    }

    // Calculate success rate
    const approved = similar.filter(r => r.outcome.approved).length
    const successRate = approved / similar.length

    // Calculate average quality
    const avgQuality = similar.reduce((sum, r) => sum + r.feedback.quality, 0) / similar.length

    // Combine metrics
    const confidence = Math.round((successRate * 60) + (avgQuality / 10 * 40))

    console.log('[Learning] Predicted confidence:', {
      actionType,
      similar: similar.length,
      successRate: `${Math.round(successRate * 100)}%`,
      confidence,
    })

    return Math.max(50, Math.min(95, confidence)) // Clamp between 50-95
  }

  /**
   * Get learning stats
   */
  getStats(): {
    totalActions: number
    approved: number
    rejected: number
    executed: number
    successRate: number
    avgConfidence: number
  } {
    const total = this.records.length
    const approved = this.records.filter(r => r.outcome.approved).length
    const rejected = total - approved
    const executed = this.records.filter(r => r.outcome.executed).length
    const successful = this.records.filter(r => r.outcome.result === 'success').length

    const successRate = executed > 0 ? successful / executed : 0
    const avgConfidence = total > 0
      ? this.records.reduce((sum, r) => sum + r.action.confidence, 0) / total
      : 0

    return {
      totalActions: total,
      approved,
      rejected,
      executed,
      successRate: Math.round(successRate * 100) / 100,
      avgConfidence: Math.round(avgConfidence),
    }
  }

  /**
   * Get top patterns
   */
  getTopPatterns(limit: number = 10): Array<{ pattern: string; weight: number }> {
    return Array.from(this.patterns.entries())
      .map(([pattern, weight]) => ({ pattern, weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit)
  }

  /**
   * Extract patterns from opportunity
   */
  private extractPatterns(opp: PartnerOpportunity): {
    customer_profile: Record<string, any>
    timing: Record<string, any>
    success_factors: string[]
  } {
    return {
      customer_profile: {
        industry: opp.customer.industry,
        region: opp.customer.region,
        size: opp.customer.size,
      },
      timing: {
        stage: opp.stage,
        daysToClose: opp.closeDate
          ? Math.ceil((opp.closeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
      },
      success_factors: [
        `value_${opp.value.amount > 100000 ? 'high' : opp.value.amount > 25000 ? 'medium' : 'low'}`,
        `type_${opp.dealType}`,
        `source_${opp.sourceType}`,
      ],
    }
  }

  /**
   * Check if two opportunities are similar
   */
  private isSimilar(opp1: PartnerOpportunity, opp2: PartnerOpportunity): boolean {
    // Industry match
    if (opp1.customer.industry !== opp2.customer.industry) {
      return false
    }

    // Deal size similarity (within 2x)
    const ratio = opp1.value.amount / opp2.value.amount
    if (ratio < 0.5 || ratio > 2) {
      return false
    }

    // Deal type match
    if (opp1.dealType !== opp2.dealType) {
      return false
    }

    return true
  }

  /**
   * Update pattern weights
   */
  private updatePatterns(record: LearningRecord, multiplier: number = 1): void {
    const { customer_profile, success_factors } = record.patterns

    // Weight by quality
    const weight = (record.feedback.quality / 10) * multiplier

    // Update customer patterns
    if (customer_profile.industry) {
      const key = `industry:${customer_profile.industry}`
      this.patterns.set(key, (this.patterns.get(key) || 0) + weight)
    }

    if (customer_profile.region) {
      const key = `region:${customer_profile.region}`
      this.patterns.set(key, (this.patterns.get(key) || 0) + weight)
    }

    // Update success factor patterns
    success_factors.forEach((factor: string) => {
      this.patterns.set(factor, (this.patterns.get(factor) || 0) + weight)
    })
  }
}
