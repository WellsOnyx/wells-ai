/**
 * Wells AI - IBM Partner Adapter
 * Observe Mode: Returns simulated opportunities from fixtures
 *
 * Future: Connect to IBM PartnerWorld API
 */

import { Opportunity, OpportunityStage } from '@/lib/opportunity'
import { parseOpportunity } from '@/lib/opportunity-parsers'

// ===== IBM ADAPTER =====

export interface IBMAdapterConfig {
  apiKey?: string
  partnerId: string
  environment: 'production' | 'sandbox' | 'stub'
}

export class IBMAdapter {
  private config: IBMAdapterConfig

  constructor(config: IBMAdapterConfig) {
    this.config = config
  }

  /**
   * Discover opportunities from IBM PartnerWorld
   *
   * OBSERVE MODE: Returns simulated opportunities from fixtures
   * FUTURE: Call IBM PartnerWorld API
   */
  async discover(supplierId: string = 'wells-onyx'): Promise<Opportunity[]> {
    console.log(`🔍 IBM Adapter: Discovering opportunities (${this.config.environment} mode)`)

    if (this.config.environment === 'stub') {
      return this.discoverStub(supplierId)
    }

    // Future: Connect to IBM PartnerWorld API
    throw new Error('IBM PartnerWorld API not yet implemented')
  }

  /**
   * Stub mode: Return 3 simulated opportunities from fixture-compatible data
   */
  private async discoverStub(supplierId: string): Promise<Opportunity[]> {
    // Create 3 opportunities based on the IBM fixture structure
    const stubOpportunities = [
      // Opportunity 1: Healthcare Cloud Migration (from fixture)
      {
        opportunityId: 'IBM-OPP-2025-04782',
        opportunityName: 'Healthcare Corp - IBM Cloud Migration & Watsonx AI Implementation',
        clientName: 'HealthTech Solutions Inc.',
        clientIndustry: 'Healthcare',
        opportunityDescription: 'HealthTech Solutions is migrating their on-premises infrastructure to IBM Cloud and implementing Watsonx AI for clinical decision support. Project includes hybrid cloud architecture, data migration, security compliance (HIPAA), and AI/ML model deployment.',
        estimatedValue: 3500000,
        currency: 'USD',
        opportunityStage: 'Qualified',
        opportunityStatus: 'Active',
        createdDate: '2025-09-15T08:30:00Z',
        lastModifiedDate: '2025-10-28T14:22:00Z',
        expectedCloseDate: '2026-01-15T00:00:00Z',
        primaryContact: {
          firstName: 'Sarah',
          lastName: 'Johnson',
          email: 'sarah.johnson@healthtechsolutions.com',
          phone: '+1-415-555-0187',
          jobTitle: 'VP of Technology'
        },
        additionalContacts: [
          {
            firstName: 'Michael',
            lastName: 'Chen',
            email: 'michael.chen@healthtechsolutions.com',
            phone: '+1-415-555-0188',
            jobTitle: 'CTO'
          }
        ],
        products: ['IBM Cloud', 'IBM Watsonx.ai', 'IBM Cloud Pak for Data', 'Red Hat OpenShift'],
        geography: {
          region: 'North America',
          country: 'United States',
          state: 'California'
        },
        partnerInfo: {
          partnerType: 'IBM Business Partner',
          coSellType: 'IBM Co-Sell',
          partnerManager: 'David Rodriguez',
          partnerManagerEmail: 'david.rodriguez@ibm.com',
          partnerEngagement: 'High',
          portalUrl: 'https://partnerportal.ibm.com/s/opportunity/IBM-OPP-2025-04782'
        },
        technicalRequirements: {
          migrationScope: 'Full datacenter migration (200+ VMs)',
          complianceNeeds: ['HIPAA', 'SOC 2 Type II'],
          aiUseCases: ['Clinical decision support', 'Patient risk stratification'],
          timeline: '6-month implementation'
        },
        competitorInfo: {
          competingWith: ['AWS', 'Microsoft Azure'],
          ibmAdvantage: 'Healthcare-specific AI models, HIPAA compliance expertise'
        }
      },

      // Opportunity 2: Retail Modernization
      {
        opportunityId: 'IBM-OPP-2025-05193',
        opportunityName: 'RetailCorp - Omnichannel Platform & AI Personalization',
        clientName: 'RetailCorp International',
        clientIndustry: 'Retail',
        opportunityDescription: 'RetailCorp is building a modern omnichannel platform on IBM Cloud with AI-powered personalization. Includes migration of legacy POS systems, inventory management, and customer data platform.',
        estimatedValue: 2800000,
        currency: 'USD',
        opportunityStage: 'Discovery',
        opportunityStatus: 'Active',
        createdDate: '2025-10-01T10:15:00Z',
        lastModifiedDate: '2025-10-29T16:45:00Z',
        expectedCloseDate: '2026-02-28T00:00:00Z',
        primaryContact: {
          firstName: 'Jennifer',
          lastName: 'Martinez',
          email: 'jmartinez@retailcorp.com',
          phone: '+1-212-555-0123',
          jobTitle: 'Chief Digital Officer'
        },
        additionalContacts: [
          {
            firstName: 'Robert',
            lastName: 'Thompson',
            email: 'rthompson@retailcorp.com',
            phone: '+1-212-555-0124',
            jobTitle: 'VP of Technology'
          }
        ],
        products: ['IBM Cloud', 'IBM Watsonx.ai', 'IBM Sterling Order Management'],
        geography: {
          region: 'North America',
          country: 'United States',
          state: 'New York'
        },
        partnerInfo: {
          partnerType: 'IBM Business Partner',
          coSellType: 'IBM Co-Sell',
          partnerManager: 'Lisa Chen',
          partnerManagerEmail: 'lisa.chen@ibm.com',
          partnerEngagement: 'Medium',
          portalUrl: 'https://partnerportal.ibm.com/s/opportunity/IBM-OPP-2025-05193'
        },
        technicalRequirements: {
          migrationScope: 'POS systems, inventory management, customer data platform',
          complianceNeeds: ['PCI DSS', 'GDPR'],
          aiUseCases: ['Product recommendations', 'Dynamic pricing', 'Inventory optimization'],
          timeline: '8-month implementation'
        },
        competitorInfo: {
          competingWith: ['Salesforce Commerce Cloud', 'SAP Commerce'],
          ibmAdvantage: 'Proven retail AI models, legacy system integration'
        }
      },

      // Opportunity 3: Financial Services Hybrid Cloud
      {
        opportunityId: 'IBM-OPP-2025-05874',
        opportunityName: 'Global Bank - Hybrid Cloud Infrastructure & Security',
        clientName: 'Global Financial Services Inc.',
        clientIndustry: 'Financial Services',
        opportunityDescription: 'Global Financial Services is implementing a hybrid cloud architecture with IBM Cloud as the primary provider. Includes mainframe modernization, container platform deployment, and advanced security controls.',
        estimatedValue: 5200000,
        currency: 'USD',
        opportunityStage: 'Qualified',
        opportunityStatus: 'Active',
        createdDate: '2025-08-20T09:00:00Z',
        lastModifiedDate: '2025-10-30T11:30:00Z',
        expectedCloseDate: '2025-12-15T00:00:00Z',
        primaryContact: {
          firstName: 'David',
          lastName: 'Williams',
          email: 'dwilliams@globalfinancial.com',
          phone: '+1-617-555-0199',
          jobTitle: 'CTO'
        },
        additionalContacts: [
          {
            firstName: 'Amanda',
            lastName: 'Lee',
            email: 'alee@globalfinancial.com',
            phone: '+1-617-555-0198',
            jobTitle: 'CISO'
          }
        ],
        products: ['IBM Cloud', 'Red Hat OpenShift', 'IBM Security', 'IBM Z'],
        geography: {
          region: 'North America',
          country: 'United States',
          state: 'Massachusetts'
        },
        partnerInfo: {
          partnerType: 'IBM Business Partner',
          coSellType: 'IBM Co-Sell',
          partnerManager: 'Michael Zhang',
          partnerManagerEmail: 'michael.zhang@ibm.com',
          partnerEngagement: 'High',
          portalUrl: 'https://partnerportal.ibm.com/s/opportunity/IBM-OPP-2025-05874'
        },
        technicalRequirements: {
          migrationScope: 'Mainframe modernization, container platform, security controls',
          complianceNeeds: ['SOX', 'PCI DSS', 'SOC 2 Type II'],
          aiUseCases: ['Fraud detection', 'Risk modeling'],
          timeline: '12-month implementation'
        },
        competitorInfo: {
          competingWith: ['Microsoft Azure', 'VMware'],
          ibmAdvantage: 'Mainframe expertise, financial services compliance'
        }
      }
    ]

    // Parse raw IBM data into normalized Opportunity format
    const opportunities = stubOpportunities.map(raw =>
      parseOpportunity('ibm', raw, supplierId)
    )

    console.log(`✅ IBM Adapter: Discovered ${opportunities.length} opportunities`)

    return opportunities
  }

  /**
   * Future: Authenticate with IBM PartnerWorld
   */
  async authenticate(): Promise<boolean> {
    if (this.config.environment === 'stub') {
      console.log('✅ IBM Adapter: Authentication skipped (stub mode)')
      return true
    }

    // Future: OAuth flow with IBM
    throw new Error('IBM PartnerWorld authentication not yet implemented')
  }

  /**
   * Future: Register deal with IBM PartnerWorld
   */
  async registerDeal(opportunityId: string, params: any): Promise<boolean> {
    if (this.config.environment === 'stub') {
      console.log(`✅ IBM Adapter: Deal registration simulated for ${opportunityId}`)
      return true
    }

    // Future: Call IBM PartnerWorld deal registration API
    throw new Error('IBM PartnerWorld deal registration not yet implemented')
  }

  /**
   * Future: Request co-sell support from IBM
   */
  async requestCoSell(opportunityId: string, params: any): Promise<boolean> {
    if (this.config.environment === 'stub') {
      console.log(`✅ IBM Adapter: Co-sell request simulated for ${opportunityId}`)
      return true
    }

    // Future: Call IBM PartnerWorld co-sell API
    throw new Error('IBM PartnerWorld co-sell request not yet implemented')
  }

  /**
   * Get adapter info
   */
  getInfo() {
    return {
      partnerId: this.config.partnerId,
      environment: this.config.environment,
      status: this.config.environment === 'stub' ? 'observe-mode' : 'not-configured',
      capabilities: {
        discover: this.config.environment === 'stub',
        authenticate: this.config.environment === 'stub',
        registerDeal: this.config.environment === 'stub',
        requestCoSell: this.config.environment === 'stub'
      }
    }
  }
}

// ===== SINGLETON INSTANCE =====

export const ibmAdapter = new IBMAdapter({
  partnerId: 'ibm',
  environment: 'stub' // OBSERVE MODE
})

// ===== EXPORTS =====

export default ibmAdapter
