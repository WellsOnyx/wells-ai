/**
 * Wells AI - Deal Registration Form Mapper
 * Maps normalized Opportunity to partner-specific deal registration forms
 */

import { Opportunity } from './opportunity'

// ===== TYPES =====

export type DealRegFields = Record<string, string | number | boolean | string[] | null | undefined>

export interface DealRegMapper {
  partnerId: string
  map(opportunity: Opportunity): DealRegFields
}

// ===== IBM DEAL REGISTRATION MAPPER =====

export class IBMDealRegMapper implements DealRegMapper {
  partnerId = 'ibm'

  map(opportunity: Opportunity): DealRegFields {
    return {
      // Opportunity Identity
      opportunity_id: opportunity.partnerOpportunityId,
      opportunity_name: opportunity.title,

      // Customer Information
      customer_name: opportunity.companyName,
      customer_industry: opportunity.industry || 'Other',

      // Financial Details
      estimated_value: opportunity.estimatedValue,
      currency: opportunity.currency,
      expected_close_date: opportunity.expectedCloseDate || '',

      // Opportunity Status
      opportunity_stage: this.mapStage(opportunity.stage),
      opportunity_status: this.mapStatus(opportunity.status),

      // Products/Solutions
      products: opportunity.products.join(', '),
      solution_description: opportunity.description,

      // Geography
      region: opportunity.region || '',
      country: opportunity.country || '',
      state: opportunity.state || '',

      // Contact Information
      primary_contact_name: opportunity.primaryContact?.name || '',
      primary_contact_email: opportunity.primaryContact?.email || '',
      primary_contact_phone: opportunity.primaryContact?.phone || '',
      primary_contact_title: opportunity.primaryContact?.title || '',

      // Partner Information
      partner_type: opportunity.metadata.coSellType || 'ibm-cosell',
      partner_engagement: opportunity.metadata.partnerEngagement || 'medium',
      partner_manager: opportunity.metadata.partnerManager || '',
      partner_manager_email: opportunity.metadata.partnerManagerEmail || '',

      // Competition
      competitors: opportunity.metadata.raw?.competitorInfo?.competingWith?.join(', ') || '',
      ibm_advantage: opportunity.metadata.raw?.competitorInfo?.ibmAdvantage || '',

      // Technical Requirements
      technical_scope: opportunity.metadata.raw?.technicalRequirements?.migrationScope || '',
      compliance_needs: opportunity.metadata.raw?.technicalRequirements?.complianceNeeds?.join(', ') || '',
      ai_use_cases: opportunity.metadata.raw?.technicalRequirements?.aiUseCases?.join(', ') || '',
      timeline: opportunity.metadata.raw?.technicalRequirements?.timeline || '',

      // Portal Reference
      portal_url: opportunity.metadata.portalUrl || '',

      // Timestamps
      created_at: opportunity.createdAt,
      updated_at: opportunity.updatedAt
    }
  }

  private mapStage(stage: string): string {
    const stageMap: Record<string, string> = {
      'lead': 'Prospect',
      'qualified': 'Qualified',
      'proposal': 'Proposal Submitted',
      'negotiation': 'Negotiation',
      'closed-won': 'Closed Won',
      'closed-lost': 'Closed Lost'
    }
    return stageMap[stage] || stage
  }

  private mapStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'open': 'Active',
      'in-progress': 'In Progress',
      'closed': 'Closed'
    }
    return statusMap[status] || status
  }
}

// ===== CISCO DEAL REGISTRATION MAPPER =====

export class CiscoDealRegMapper implements DealRegMapper {
  partnerId = 'cisco'

  map(opportunity: Opportunity): DealRegFields {
    return {
      // Cisco uses different field names
      deal_id: opportunity.partnerOpportunityId,
      deal_name: opportunity.title,

      // Customer
      account_name: opportunity.companyName,
      vertical: opportunity.industry || 'Enterprise',

      // Financial
      deal_size: opportunity.estimatedValue,
      currency_code: opportunity.currency,
      close_date: opportunity.expectedCloseDate || '',

      // Stage
      deal_stage: this.mapStage(opportunity.stage),

      // Products
      product_family: opportunity.products[0] || '',
      all_products: opportunity.products.join('; '),
      solution_summary: opportunity.description,

      // Location
      theater: opportunity.region || 'Americas',
      country_code: opportunity.country || 'US',

      // Contacts
      end_customer_contact: opportunity.primaryContact?.name || '',
      contact_email: opportunity.primaryContact?.email || '',
      contact_phone: opportunity.primaryContact?.phone || '',

      // Partner
      engagement_type: 'Co-Sell',
      cisco_am: opportunity.metadata.partnerManager || '',

      // Competition
      competing_vendors: opportunity.metadata.raw?.competitorInfo?.competingWith?.join(', ') || ''
    }
  }

  private mapStage(stage: string): string {
    const stageMap: Record<string, string> = {
      'lead': 'Identify',
      'qualified': 'Qualify',
      'proposal': 'Propose',
      'negotiation': 'Negotiate',
      'closed-won': 'Win',
      'closed-lost': 'Lost'
    }
    return stageMap[stage] || stage
  }
}

// ===== AWS DEAL REGISTRATION MAPPER =====

export class AWSDealRegMapper implements DealRegMapper {
  partnerId = 'aws'

  map(opportunity: Opportunity): DealRegFields {
    return {
      // AWS Partner Portal fields
      opportunity_identifier: opportunity.partnerOpportunityId,
      opportunity_title: opportunity.title,
      opportunity_description: opportunity.description,

      // Customer
      customer_company_name: opportunity.companyName,
      industry_vertical: opportunity.industry || 'Other',

      // Deal Details
      total_contract_value: opportunity.estimatedValue,
      annual_recurring_revenue: Math.round(opportunity.estimatedValue * 0.2), // Estimate 20% ARR
      expected_monthly_aws_revenue: Math.round(opportunity.estimatedValue / 36), // 3-year estimate
      target_close_date: opportunity.expectedCloseDate || '',

      // Stage & Status
      sales_stage: this.mapStage(opportunity.stage),
      opportunity_status: 'Active',

      // AWS Services
      primary_workload: opportunity.products[0] || 'Compute',
      aws_services: opportunity.products.join(', '),

      // Geography
      customer_region: opportunity.region || 'US-East',
      customer_country: opportunity.country || 'United States',

      // Contacts
      customer_contact_name: opportunity.primaryContact?.name || '',
      customer_contact_email: opportunity.primaryContact?.email || '',
      customer_contact_role: opportunity.primaryContact?.title || '',

      // Partner Details
      partner_engagement_type: 'Co-Sell',
      aws_account_manager: opportunity.metadata.partnerManager || '',

      // Competition
      competitive_landscape: opportunity.metadata.raw?.competitorInfo?.competingWith?.join(', ') || 'None identified',
      aws_differentiators: opportunity.metadata.raw?.competitorInfo?.ibmAdvantage || 'AWS native services'
    }
  }

  private mapStage(stage: string): string {
    const stageMap: Record<string, string> = {
      'lead': 'Prospect',
      'qualified': 'Qualified',
      'proposal': 'Technical Validation',
      'negotiation': 'Business Validation',
      'closed-won': 'Closed Won',
      'closed-lost': 'Closed Lost'
    }
    return stageMap[stage] || stage
  }
}

// ===== MAPPER REGISTRY =====

const mappers: Record<string, DealRegMapper> = {
  ibm: new IBMDealRegMapper(),
  cisco: new CiscoDealRegMapper(),
  aws: new AWSDealRegMapper()
}

// ===== MAIN FUNCTION =====

/**
 * Map a normalized Opportunity to partner-specific deal registration fields
 *
 * @param partnerId - Partner identifier ('ibm', 'cisco', 'aws', etc.)
 * @param opportunity - Normalized opportunity object
 * @returns Flat object with partner-specific form fields
 *
 * @example
 * const fields = mapDealReg('ibm', opportunity)
 * // Returns: { opportunity_name: 'Deal XYZ', customer_name: 'Acme Corp', ... }
 */
export function mapDealReg(partnerId: string, opportunity: Opportunity): DealRegFields {
  const mapper = mappers[partnerId]

  if (!mapper) {
    throw new Error(`No deal registration mapper found for partner: ${partnerId}`)
  }

  return mapper.map(opportunity)
}

/**
 * Get all supported partner IDs for deal registration
 */
export function getSupportedPartners(): string[] {
  return Object.keys(mappers)
}

/**
 * Check if a partner has a deal registration mapper
 */
export function hasMapper(partnerId: string): boolean {
  return partnerId in mappers
}

// ===== EXPORTS =====

export default mapDealReg
