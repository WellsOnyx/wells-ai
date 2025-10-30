/**
 * Wells AI - Partner Configuration
 * Centralized partner identity, authentication, and metadata
 */

// ===== TYPES =====

export enum PartnerAuthType {
  OAuth2 = 'oauth2',
  APIKey = 'api_key',
  BasicAuth = 'basic_auth',
  None = 'none'
}

export enum PartnerCategory {
  Cloud = 'cloud',
  CRM = 'crm',
  Payments = 'payments',
  Security = 'security',
  Analytics = 'analytics',
  DevTools = 'dev_tools',
  Collaboration = 'collaboration',
  Other = 'other'
}

export interface PartnerCredentials {
  clientId?: string
  clientSecret?: string
  apiKey?: string
  username?: string
  password?: string
}

export interface PartnerConfig {
  // Identity
  id: string
  name: string
  displayName: string
  description: string
  category: PartnerCategory

  // Branding
  logoUrl: string
  brandColor: string
  websiteUrl: string

  // Authentication
  authType: PartnerAuthType
  portalUrl: string
  apiBaseUrl?: string
  oauthAuthorizeUrl?: string
  oauthTokenUrl?: string
  oauthScopes?: string[]

  // Environment Variables (for credentials)
  envVars: {
    clientId?: string
    clientSecret?: string
    apiKey?: string
    username?: string
    password?: string
  }

  // Capabilities
  capabilities: {
    discover: boolean      // Can discover opportunities
    dealReg: boolean       // Can register deals
    coSell: boolean        // Supports co-sell requests
    partnerIntro: boolean  // Can request partner intros
    quote: boolean         // Can request quotes
  }

  // Status
  status: 'active' | 'beta' | 'coming_soon' | 'deprecated'
}

// ===== PARTNER DEFINITIONS =====

export const PARTNERS: Record<string, PartnerConfig> = {
  // ===== IBM =====
  ibm: {
    id: 'ibm',
    name: 'IBM',
    displayName: 'IBM PartnerWorld',
    description: 'IBM Cloud, Watson AI, Red Hat, and enterprise solutions',
    category: PartnerCategory.Cloud,

    logoUrl: 'https://www.ibm.com/favicon.ico',
    brandColor: '#0f62fe',
    websiteUrl: 'https://www.ibm.com',

    authType: PartnerAuthType.OAuth2,
    portalUrl: 'https://partnerportal.ibm.com/s/',
    apiBaseUrl: 'https://api.ibm.com/partnerworld/v1',
    oauthAuthorizeUrl: 'https://login.ibm.com/oidc/endpoint/default/authorize',
    oauthTokenUrl: 'https://login.ibm.com/oidc/endpoint/default/token',
    oauthScopes: ['openid', 'profile', 'email', 'partner.opportunities.read'],

    envVars: {
      clientId: 'IBM_CLIENT_ID',
      clientSecret: 'IBM_CLIENT_SECRET'
    },

    capabilities: {
      discover: true,
      dealReg: true,
      coSell: true,
      partnerIntro: true,
      quote: true
    },

    status: 'active'
  },

  // ===== CISCO =====
  cisco: {
    id: 'cisco',
    name: 'Cisco',
    displayName: 'Cisco Partner Hub',
    description: 'Networking, security, collaboration, and cloud solutions',
    category: PartnerCategory.Security,

    logoUrl: 'https://www.cisco.com/favicon.ico',
    brandColor: '#049fd9',
    websiteUrl: 'https://www.cisco.com',

    authType: PartnerAuthType.OAuth2,
    portalUrl: 'https://www.cisco.com/c/en/us/partners.html',
    apiBaseUrl: 'https://api.cisco.com/partner/v1',
    oauthAuthorizeUrl: 'https://cloudsso.cisco.com/as/authorization.oauth2',
    oauthTokenUrl: 'https://cloudsso.cisco.com/as/token.oauth2',
    oauthScopes: ['partner.opportunities', 'partner.deals'],

    envVars: {
      clientId: 'CISCO_CLIENT_ID',
      clientSecret: 'CISCO_CLIENT_SECRET'
    },

    capabilities: {
      discover: true,
      dealReg: true,
      coSell: true,
      partnerIntro: false,
      quote: true
    },

    status: 'beta'
  },

  // ===== AWS =====
  aws: {
    id: 'aws',
    name: 'AWS',
    displayName: 'AWS Partner Network',
    description: 'Cloud computing, storage, databases, and machine learning',
    category: PartnerCategory.Cloud,

    logoUrl: 'https://a0.awsstatic.com/libra-css/images/site/fav/favicon.ico',
    brandColor: '#ff9900',
    websiteUrl: 'https://aws.amazon.com',

    authType: PartnerAuthType.APIKey,
    portalUrl: 'https://partnercentral.awspartner.com/',
    apiBaseUrl: 'https://partners.amazonaws.com/api/v1',

    envVars: {
      apiKey: 'AWS_PARTNER_API_KEY',
      clientId: 'AWS_PARTNER_CLIENT_ID',
      clientSecret: 'AWS_PARTNER_CLIENT_SECRET'
    },

    capabilities: {
      discover: true,
      dealReg: true,
      coSell: true,
      partnerIntro: true,
      quote: false
    },

    status: 'active'
  },

  // ===== SALESFORCE =====
  salesforce: {
    id: 'salesforce',
    name: 'Salesforce',
    displayName: 'Salesforce Partner Community',
    description: 'CRM, sales, service, marketing, and platform solutions',
    category: PartnerCategory.CRM,

    logoUrl: 'https://www.salesforce.com/favicon.ico',
    brandColor: '#00a1e0',
    websiteUrl: 'https://www.salesforce.com',

    authType: PartnerAuthType.OAuth2,
    portalUrl: 'https://partners.salesforce.com/',
    apiBaseUrl: 'https://api.salesforce.com/services/data/v58.0',
    oauthAuthorizeUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    oauthTokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    oauthScopes: ['api', 'refresh_token'],

    envVars: {
      clientId: 'SALESFORCE_CLIENT_ID',
      clientSecret: 'SALESFORCE_CLIENT_SECRET'
    },

    capabilities: {
      discover: true,
      dealReg: true,
      coSell: true,
      partnerIntro: true,
      quote: false
    },

    status: 'active'
  },

  // ===== PLAID =====
  plaid: {
    id: 'plaid',
    name: 'Plaid',
    displayName: 'Plaid Partner Portal',
    description: 'Financial data connectivity and payment infrastructure',
    category: PartnerCategory.Payments,

    logoUrl: 'https://plaid.com/favicon.ico',
    brandColor: '#000000',
    websiteUrl: 'https://plaid.com',

    authType: PartnerAuthType.APIKey,
    portalUrl: 'https://dashboard.plaid.com/',
    apiBaseUrl: 'https://production.plaid.com',

    envVars: {
      clientId: 'PLAID_CLIENT_ID',
      clientSecret: 'PLAID_SECRET'
    },

    capabilities: {
      discover: true,
      dealReg: false,
      coSell: true,
      partnerIntro: true,
      quote: false
    },

    status: 'active'
  },

  // ===== MICROSOFT =====
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    displayName: 'Microsoft Partner Center',
    description: 'Azure, Microsoft 365, Dynamics 365, and Power Platform',
    category: PartnerCategory.Cloud,

    logoUrl: 'https://www.microsoft.com/favicon.ico',
    brandColor: '#00a4ef',
    websiteUrl: 'https://www.microsoft.com',

    authType: PartnerAuthType.OAuth2,
    portalUrl: 'https://partner.microsoft.com/',
    apiBaseUrl: 'https://api.partnercenter.microsoft.com/v1',
    oauthAuthorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    oauthTokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    oauthScopes: ['https://api.partnercenter.microsoft.com/user_impersonation'],

    envVars: {
      clientId: 'MICROSOFT_CLIENT_ID',
      clientSecret: 'MICROSOFT_CLIENT_SECRET'
    },

    capabilities: {
      discover: true,
      dealReg: true,
      coSell: true,
      partnerIntro: true,
      quote: true
    },

    status: 'coming_soon'
  },

  // ===== GOOGLE CLOUD =====
  google: {
    id: 'google',
    name: 'Google Cloud',
    displayName: 'Google Cloud Partner Portal',
    description: 'Cloud computing, data analytics, and machine learning',
    category: PartnerCategory.Cloud,

    logoUrl: 'https://www.gstatic.com/devrel-devsite/prod/v2210deb8920cd4a55bd580441aa58e7853afc04b39a9d9ac4198e1cd7fbe04ef/cloud/images/favicons/onecloud/favicon.ico',
    brandColor: '#4285f4',
    websiteUrl: 'https://cloud.google.com',

    authType: PartnerAuthType.OAuth2,
    portalUrl: 'https://console.cloud.google.com/partner',
    apiBaseUrl: 'https://cloudpartner.googleapis.com/v1',
    oauthAuthorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    oauthTokenUrl: 'https://oauth2.googleapis.com/token',
    oauthScopes: ['https://www.googleapis.com/auth/cloud-platform'],

    envVars: {
      clientId: 'GOOGLE_CLIENT_ID',
      clientSecret: 'GOOGLE_CLIENT_SECRET'
    },

    capabilities: {
      discover: true,
      dealReg: true,
      coSell: true,
      partnerIntro: false,
      quote: false
    },

    status: 'coming_soon'
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Get partner configuration by ID
 */
export function getPartner(partnerId: string): PartnerConfig | undefined {
  return PARTNERS[partnerId]
}

/**
 * Get all partners
 */
export function getAllPartners(): PartnerConfig[] {
  return Object.values(PARTNERS)
}

/**
 * Get partners by category
 */
export function getPartnersByCategory(category: PartnerCategory): PartnerConfig[] {
  return Object.values(PARTNERS).filter(p => p.category === category)
}

/**
 * Get partners by status
 */
export function getPartnersByStatus(status: PartnerConfig['status']): PartnerConfig[] {
  return Object.values(PARTNERS).filter(p => p.status === status)
}

/**
 * Get active partners
 */
export function getActivePartners(): PartnerConfig[] {
  return getPartnersByStatus('active')
}

/**
 * Get partner credentials from environment variables
 */
export function getPartnerCredentials(partnerId: string): PartnerCredentials | null {
  const partner = getPartner(partnerId)
  if (!partner) return null

  const credentials: PartnerCredentials = {}

  if (partner.envVars.clientId) {
    credentials.clientId = process.env[partner.envVars.clientId]
  }

  if (partner.envVars.clientSecret) {
    credentials.clientSecret = process.env[partner.envVars.clientSecret]
  }

  if (partner.envVars.apiKey) {
    credentials.apiKey = process.env[partner.envVars.apiKey]
  }

  if (partner.envVars.username) {
    credentials.username = process.env[partner.envVars.username]
  }

  if (partner.envVars.password) {
    credentials.password = process.env[partner.envVars.password]
  }

  return credentials
}

/**
 * Check if partner has valid credentials configured
 */
export function hasValidCredentials(partnerId: string): boolean {
  const credentials = getPartnerCredentials(partnerId)
  if (!credentials) return false

  const partner = getPartner(partnerId)
  if (!partner) return false

  // Check required credentials based on auth type
  switch (partner.authType) {
    case PartnerAuthType.OAuth2:
      return !!(credentials.clientId && credentials.clientSecret)
    case PartnerAuthType.APIKey:
      return !!credentials.apiKey
    case PartnerAuthType.BasicAuth:
      return !!(credentials.username && credentials.password)
    case PartnerAuthType.None:
      return true
    default:
      return false
  }
}

/**
 * Get partner statistics
 */
export function getPartnerStats() {
  const all = getAllPartners()

  return {
    total: all.length,
    active: all.filter(p => p.status === 'active').length,
    beta: all.filter(p => p.status === 'beta').length,
    comingSoon: all.filter(p => p.status === 'coming_soon').length,
    byCategory: {
      cloud: getPartnersByCategory(PartnerCategory.Cloud).length,
      crm: getPartnersByCategory(PartnerCategory.CRM).length,
      payments: getPartnersByCategory(PartnerCategory.Payments).length,
      security: getPartnersByCategory(PartnerCategory.Security).length,
      analytics: getPartnersByCategory(PartnerCategory.Analytics).length,
      devTools: getPartnersByCategory(PartnerCategory.DevTools).length,
      collaboration: getPartnersByCategory(PartnerCategory.Collaboration).length,
      other: getPartnersByCategory(PartnerCategory.Other).length
    },
    capabilities: {
      discover: all.filter(p => p.capabilities.discover).length,
      dealReg: all.filter(p => p.capabilities.dealReg).length,
      coSell: all.filter(p => p.capabilities.coSell).length,
      partnerIntro: all.filter(p => p.capabilities.partnerIntro).length,
      quote: all.filter(p => p.capabilities.quote).length
    }
  }
}

// ===== EXPORTS =====

export default PARTNERS
