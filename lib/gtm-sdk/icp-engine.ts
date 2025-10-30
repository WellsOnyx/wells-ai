/**
 * @wells/gtm-sdk - ICP Engine
 * Score prospects against Ideal Customer Profile
 */

import Anthropic from '@anthropic-ai/sdk'
import { ICPDefinition, Prospect, GTMResponse } from './types'

export class ICPEngine {
  private icp: ICPDefinition
  private anthropic: Anthropic

  constructor(icp: ICPDefinition, anthropic: Anthropic) {
    this.icp = icp
    this.anthropic = anthropic
  }

  async initialize(): Promise<void> {
    console.log('[ICP Engine] Initialized with ICP:', this.icp)
  }

  /**
   * Score a prospect against the ICP (0-100)
   * Higher score = better fit
   */
  async scoreProspect(prospect: Prospect): Promise<number> {
    let score = 0
    let maxScore = 0

    // Role match (30 points)
    maxScore += 30
    if (this.matchesRole(prospect.role)) {
      score += 30
    } else if (this.isRelatedRole(prospect.role)) {
      score += 15
    }

    // Company size (20 points)
    maxScore += 20
    if (this.matchesCompanySize(prospect.company.size)) {
      score += 20
    }

    // Industry (20 points)
    maxScore += 20
    if (this.matchesIndustry(prospect.company.industry)) {
      score += 20
    }

    // Geography (10 points)
    maxScore += 10
    if (this.matchesGeography(prospect.company.location)) {
      score += 10
    }

    // Tech stack (10 points)
    maxScore += 10
    if (this.matchesTechStack(prospect.company.techStack || [])) {
      score += 10
    }

    // Signals (10 points)
    maxScore += 10
    const signalScore = this.scoreSignals(prospect.signals)
    score += signalScore

    // Normalize to 0-100
    const finalScore = Math.round((score / maxScore) * 100)

    console.log(`[ICP Engine] Scored ${prospect.name} (${prospect.company.name}): ${finalScore}/100`)

    return finalScore
  }

  private matchesRole(role: string): boolean {
    const icpRoles = Array.isArray(this.icp.role) ? this.icp.role : [this.icp.role]
    return icpRoles.some(r => role.toLowerCase().includes(r.toLowerCase()))
  }

  private isRelatedRole(role: string): boolean {
    const relatedRoles: Record<string, string[]> = {
      CPO: ['Chief Product', 'VP Product', 'Head of Product'],
      CTO: ['Chief Technology', 'VP Engineering', 'Head of Engineering'],
      CFO: ['Chief Financial', 'VP Finance', 'Head of Finance'],
    }

    for (const [key, related] of Object.entries(relatedRoles)) {
      if (this.icp.role.toString().includes(key)) {
        return related.some(r => role.toLowerCase().includes(r.toLowerCase()))
      }
    }

    return false
  }

  private matchesCompanySize(size: string): boolean {
    if (!this.icp.companySize) return true

    // Parse size ranges (e.g., "500-5000")
    const icpRange = this.parseCompanySize(this.icp.companySize)
    const prospectRange = this.parseCompanySize(size)

    if (!icpRange || !prospectRange) return false

    // Check if ranges overlap
    return (
      (prospectRange.min >= icpRange.min && prospectRange.min <= icpRange.max) ||
      (prospectRange.max >= icpRange.min && prospectRange.max <= icpRange.max)
    )
  }

  private parseCompanySize(size: string): { min: number; max: number } | null {
    if (size.includes('+')) {
      const min = parseInt(size.replace('+', ''))
      return { min, max: Infinity }
    }

    if (size.includes('-')) {
      const [min, max] = size.split('-').map(s => parseInt(s))
      return { min, max }
    }

    return null
  }

  private matchesIndustry(industry: string): boolean {
    if (!this.icp.industry) return true

    const icpIndustries = Array.isArray(this.icp.industry) ? this.icp.industry : [this.icp.industry]
    return icpIndustries.some(i => industry.toLowerCase().includes(i.toLowerCase()))
  }

  private matchesGeography(location: string): boolean {
    if (!this.icp.geography) return true

    const icpGeos = Array.isArray(this.icp.geography) ? this.icp.geography : [this.icp.geography]
    return icpGeos.some(g => location.toLowerCase().includes(g.toLowerCase()))
  }

  private matchesTechStack(techStack: string[]): boolean {
    if (!this.icp.techStack || this.icp.techStack.length === 0) return true

    // Check if prospect uses any of the ICP tech stack
    return this.icp.techStack.some(tech =>
      techStack.some(t => t.toLowerCase().includes(tech.toLowerCase()))
    )
  }

  private scoreSignals(signals: Prospect['signals']): number {
    if (!this.icp.signals || this.icp.signals.length === 0) return 0

    let score = 0
    const maxSignals = Math.min(signals.length, this.icp.signals.length)

    for (const signal of signals) {
      if (this.icp.signals.some(s => s.type === signal.type)) {
        score += 10 / maxSignals
      }
    }

    return Math.min(score, 10)
  }

  /**
   * Generate ICP report using AI
   */
  async generateICPReport(prospects: Prospect[]): Promise<string> {
    const scoredProspects = await Promise.all(
      prospects.map(async p => ({
        ...p,
        score: await this.scoreProspect(p),
      }))
    )

    const topProspects = scoredProspects.filter(p => p.score >= 80).slice(0, 10)
    const avgScore = scoredProspects.reduce((sum, p) => sum + p.score, 0) / scoredProspects.length

    return `ICP Analysis Report

Total Prospects: ${prospects.length}
Average ICP Score: ${Math.round(avgScore)}/100
High-Fit Prospects (≥80): ${topProspects.length}

Top 10 Prospects:
${topProspects
  .map((p, i) => `${i + 1}. ${p.name} (${p.company.name}) - Score: ${p.score}/100`)
  .join('\n')}

ICP Criteria:
- Role: ${Array.isArray(this.icp.role) ? this.icp.role.join(', ') : this.icp.role}
- Company Size: ${this.icp.companySize || 'Any'}
- Industry: ${this.icp.industry || 'Any'}
- Geography: ${this.icp.geography || 'Any'}`
  }
}
