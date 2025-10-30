/**
 * Wells AI - Opportunity Parsers
 * Normalize partner-specific formats into unified Opportunity schema
 */

import {
  Opportunity,
  OpportunityParser,
  OpportunityStage,
  OpportunityStatus,
  OpportunitySource,
  suggestWellsOpportunity
} from './opportunity'

// ===== HELPER FUNCTIONS =====

/**
 * Map various stage names to our unified OpportunityStage enum
 */
function normalizeStage(partnerStage: string): OpportunityStage {
  const stage = partnerStage.toLowerCase()

  if (stage.includes('lead') || stage.includes('new')) return OpportunityStage.Lead
  if (stage.includes('qualified')) return OpportunityStage.Qualified
  if (stage.includes('proposal') || stage.includes('submitted')) return OpportunityStage.Proposal
  if (stage.includes('negotiation') || stage.includes('negotiating')) return OpportunityStage.Negotiation
  if (stage.includes('closed') && stage.includes('won')) return OpportunityStage.ClosedWon
  if (stage.includes('closed') && stage.includes('lost')) return OpportunityStage.ClosedLost

  // Default to qualified if we can't determine
  return OpportunityStage.Qualified
}

/**
 * Map various status names to our unified OpportunityStatus enum
 */
function normalizeStatus(partnerStatus: string): OpportunityStatus {
  const status = partnerStatus.toLowerCase()

  if (status.includes('closed')) return OpportunityStatus.Closed
  if (status.includes('active') || status.includes('open') || status.includes('in progress')) {
    return OpportunityStatus.InProgress
  }

  return OpportunityStatus.Open
}

// ===== IBM PARSER =====

export class IBMOpportunityParser implements OpportunityParser {
  partnerId = 'ibm'

  parse(raw: any, supplierId: string = 'wells-onyx'): Opportunity {
    const normalized: Opportunity = {
      // Identity
      id: `ibm-${raw.opportunityId}`,
      supplierId, // Multi-tenant: which supplier owns this opportunity
      partnerId: 'ibm',
      partnerName: 'IBM',
      partnerOpportunityId: raw.opportunityId,

      // Core Fields
      title: raw.opportunityName,
      description: raw.opportunityDescription,
      companyName: raw.clientName,
      industry: raw.clientIndustry,

      // Financial
      estimatedValue: raw.estimatedValue,
      currency: raw.currency || 'USD',

      // Lifecycle
      stage: normalizeStage(raw.opportunityStage),
      status: normalizeStatus(raw.opportunityStatus),
      source: OpportunitySource.PartnerPortal,

      // Dates
      createdAt: raw.createdDate,
      updatedAt: raw.lastModifiedDate,
      expectedCloseDate: raw.expectedCloseDate,

      // Contact
      primaryContact: {
        name: `${raw.primaryContact.firstName} ${raw.primaryContact.lastName}`,
        email: raw.primaryContact.email,
        phone: raw.primaryContact.phone,
        title: raw.primaryContact.jobTitle
      },
      additionalContacts: raw.additionalContacts?.map((c: any) => ({
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        phone: c.phone,
        title: c.jobTitle
      })),

      // Products
      products: raw.products || [],

      // Geography
      region: raw.geography?.region,
      country: raw.geography?.country,
      state: raw.geography?.state,

      // Metadata
      metadata: {
        portalUrl: raw.partnerInfo?.portalUrl,
        coSellType: 'ibm-cosell',
        partnerEngagement: raw.partnerInfo?.partnerEngagement?.toLowerCase() as 'low' | 'medium' | 'high',
        partnerManager: raw.partnerInfo?.partnerManager,
        partnerManagerEmail: raw.partnerInfo?.partnerManagerEmail,
        raw
      }
    }

    // Add Wells opportunity suggestion
    normalized.wellsOpportunity = suggestWellsOpportunity(normalized)

    return normalized
  }
}

// ===== CISCO PARSER =====

export class CiscoOpportunityParser implements OpportunityParser {
  partnerId = 'cisco'

  parse(raw: any, supplierId: string = 'wells-onyx'): Opportunity {
    const normalized: Opportunity = {
      // Identity
      id: `cisco-${raw.dealId}`,
      supplierId, // Multi-tenant: which supplier owns this opportunity
      partnerId: 'cisco',
      partnerName: 'Cisco',
      partnerOpportunityId: raw.dealId,

      // Core Fields
      title: raw.dealName,
      description: raw.dealDescription,
      companyName: raw.customerName,
      industry: raw.customerIndustry,

      // Financial
      estimatedValue: raw.dealSize,
      currency: raw.currency || 'USD',

      // Lifecycle
      stage: normalizeStage(raw.dealStage),
      status: normalizeStatus(raw.dealStatus),
      source: OpportunitySource.PartnerPortal,

      // Dates
      createdAt: raw.registrationDate,
      updatedAt: raw.lastUpdate,
      expectedCloseDate: raw.forecastCloseDate,

      // Contact
      primaryContact: {
        name: raw.primaryCustomerContact.name,
        email: raw.primaryCustomerContact.email,
        phone: raw.primaryCustomerContact.phoneNumber,
        title: raw.primaryCustomerContact.role
      },
      additionalContacts: raw.technicalContacts?.map((c: any) => ({
        name: c.name,
        email: c.email,
        phone: c.phoneNumber,
        title: c.role
      })),

      // Products
      products: raw.solution?.products || [],

      // Geography
      region: raw.geography?.region,
      country: raw.geography?.country,
      state: raw.geography?.stateProvince,

      // Metadata
      metadata: {
        portalUrl: raw.partnerDetails?.dealRoomUrl,
        coSellType: 'cisco-cosell',
        partnerEngagement: raw.partnerDetails?.partnerEngagementLevel?.toLowerCase() as 'low' | 'medium' | 'high',
        partnerManager: raw.partnerDetails?.ciscoAccountManager,
        partnerManagerEmail: raw.partnerDetails?.ciscoAccountManagerEmail,
        raw
      }
    }

    // Add Wells opportunity suggestion
    normalized.wellsOpportunity = suggestWellsOpportunity(normalized)

    return normalized
  }
}

// ===== PLAID PARSER =====

export class PlaidOpportunityParser implements OpportunityParser {
  partnerId = 'plaid'

  parse(raw: any, supplierId: string = 'wells-onyx'): Opportunity {
    const normalized: Opportunity = {
      // Identity
      id: `plaid-${raw.referralId}`,
      supplierId, // Multi-tenant: which supplier owns this opportunity
      partnerId: 'plaid',
      partnerName: 'Plaid',
      partnerOpportunityId: raw.referralId,

      // Core Fields
      title: raw.projectTitle,
      description: raw.projectOverview,
      companyName: raw.companyInfo.companyName,
      industry: raw.companyInfo.industry,

      // Financial
      estimatedValue: raw.contractValue,
      currency: raw.currencyCode || 'USD',

      // Lifecycle
      stage: normalizeStage(raw.opportunityPhase),
      status: normalizeStatus(raw.opportunityState),
      source: OpportunitySource.Referral,

      // Dates
      createdAt: raw.submittedAt,
      updatedAt: raw.updatedAt,
      expectedCloseDate: raw.projectedSignDate,

      // Contact
      primaryContact: {
        name: raw.keyStakeholder.fullName,
        email: raw.keyStakeholder.emailAddress,
        phone: raw.keyStakeholder.phoneNumber,
        title: raw.keyStakeholder.position
      },
      additionalContacts: raw.technicalLead ? [{
        name: raw.technicalLead.fullName,
        email: raw.technicalLead.emailAddress,
        phone: raw.technicalLead.phoneNumber,
        title: raw.technicalLead.position
      }] : [],

      // Products
      products: raw.plaidProducts || [],

      // Geography
      region: raw.location?.region,
      country: raw.location?.country,
      state: raw.location?.state,

      // Metadata
      metadata: {
        portalUrl: raw.referralDetails?.referralPortalUrl,
        coSellType: 'plaid-cosell',
        partnerEngagement: raw.referralDetails?.partnerEngagement?.toLowerCase() as 'low' | 'medium' | 'high',
        partnerManager: raw.referralDetails?.plaidAccountExecutive,
        partnerManagerEmail: raw.referralDetails?.plaidAccountExecutiveEmail,
        raw
      }
    }

    // Add Wells opportunity suggestion
    normalized.wellsOpportunity = suggestWellsOpportunity(normalized)

    return normalized
  }
}

// ===== PARSER FACTORY =====

/**
 * Get the appropriate parser for a given partner
 */
export function getParser(partnerId: string): OpportunityParser {
  switch (partnerId.toLowerCase()) {
    case 'ibm':
      return new IBMOpportunityParser()
    case 'cisco':
      return new CiscoOpportunityParser()
    case 'plaid':
      return new PlaidOpportunityParser()
    default:
      throw new Error(`No parser available for partner: ${partnerId}`)
  }
}

/**
 * Parse opportunity from any partner (multi-tenant)
 */
export function parseOpportunity(partnerId: string, rawData: any, supplierId?: string): Opportunity {
  const parser = getParser(partnerId)
  return parser.parse(rawData, supplierId)
}
