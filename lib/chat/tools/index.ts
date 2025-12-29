// @ts-nocheck
/**
 * Chat Tools Index
 *
 * Central registry for all chat tools used by the Wells AI conversational router.
 */

// Import all tool modules
export * from './rfq-tools'
export * from './erp-tools'
export * from './jobs-tools'
export * from './insights-tools'
export * from './payment-tools'

// Import tool registries
import { rfqTools } from './rfq-tools'
import { erpTools } from './erp-tools'
import { jobsTools } from './jobs-tools'
import { insightsTools } from './insights-tools'
import { paymentTools } from './payment-tools'

// ============================================================================
// UNIFIED TOOL REGISTRY
// ============================================================================

/**
 * All available chat tools organized by category.
 */
export const allTools = {
  rfq: rfqTools,
  erp: erpTools,
  jobs: jobsTools,
  insights: insightsTools,
  payments: paymentTools,
}

/**
 * Tool metadata for discovery and help.
 */
export const toolMetadata = {
  rfq: {
    name: 'RFQ Tools',
    description: 'Request for quotes, supplier matching, and negotiation',
    capabilities: [
      'Create RFQs for products or services',
      'Check RFQ status and quotes',
      'Negotiate with suppliers',
      'Accept quotes and generate POs',
      'Find and match suppliers',
    ],
    examples: [
      'I need 500 ball bearings, budget $3000',
      'Check my RFQs',
      'Negotiate that quote down 10%',
      'Accept the best quote',
    ],
  },
  erp: {
    name: 'ERP Tools',
    description: 'Invoices, purchase orders, vendors, and financials',
    capabilities: [
      'View and create invoices',
      'Track purchase orders',
      'Manage vendors',
      'Get financial overview',
      'Analyze spend by category',
    ],
    examples: [
      'Show my invoices',
      'Create invoice for Acme Corp',
      'What\'s my spend this month?',
      'Track my POs',
    ],
  },
  jobs: {
    name: 'Jobs Tools',
    description: 'Job search, applications, and offer negotiation',
    capabilities: [
      'Search for jobs matching your profile',
      'Track job applications',
      'Apply to jobs with optimized materials',
      'View and negotiate offers',
      'Get salary intelligence',
    ],
    examples: [
      'Find me a CTO role',
      'Check my applications',
      'Apply to that job',
      'Negotiate my offer',
    ],
  },
  insights: {
    name: 'Insights Tools',
    description: 'Proactive insights, alerts, and recommendations',
    capabilities: [
      'Get personalized insights',
      'View and manage alerts',
      'Get AI-powered recommendations',
      'Track key metrics',
      'Daily business digest',
    ],
    examples: [
      'What should I know today?',
      'Show my alerts',
      'How can I reduce costs?',
      'Give me my daily digest',
    ],
  },
  payments: {
    name: 'Payment Tools',
    description: 'Payments, transfers, and treasury management',
    capabilities: [
      'Initiate payments',
      'Transfer funds',
      'Check payment status',
      'Manage treasury',
      'GRAIN wallet operations',
    ],
    examples: [
      'Pay invoice INV-001',
      'Transfer $5000 to John',
      'What\'s my balance?',
      'Show my GRAIN rewards',
    ],
  },
}

/**
 * Get tool by name.
 */
export function getTool(category: keyof typeof allTools, toolName: string) {
  const toolGroup = allTools[category]
  if (!toolGroup) return null
  return (toolGroup as Record<string, unknown>)[toolName] || null
}

/**
 * Get all tool names for a category.
 */
export function getToolNames(category: keyof typeof allTools): string[] {
  const toolGroup = allTools[category]
  if (!toolGroup) return []
  return Object.keys(toolGroup)
}

/**
 * Get help text for all tools.
 */
export function getToolsHelp(): string {
  const sections = Object.entries(toolMetadata).map(([key, meta]) => {
    return `**${meta.name}**
${meta.description}

Examples:
${meta.examples.map(e => `- "${e}"`).join('\n')}`
  })

  return sections.join('\n\n---\n\n')
}

/**
 * Find the best matching tool for a given intent.
 */
export function findToolForIntent(
  intent: string,
  category: string
): { toolGroup: keyof typeof allTools; toolName: string } | null {
  const intentToToolMap: Record<string, { toolGroup: keyof typeof allTools; toolName: string }> = {
    // RFQ intents
    createRFQ: { toolGroup: 'rfq', toolName: 'createRFQ' },
    rfqStatus: { toolGroup: 'rfq', toolName: 'getRFQStatus' },
    negotiateRFQ: { toolGroup: 'rfq', toolName: 'negotiateRFQ' },
    acceptQuote: { toolGroup: 'rfq', toolName: 'acceptQuote' },
    findSuppliers: { toolGroup: 'rfq', toolName: 'findSuppliers' },

    // ERP intents
    viewInvoices: { toolGroup: 'erp', toolName: 'getInvoices' },
    createInvoice: { toolGroup: 'erp', toolName: 'createInvoice' },
    viewPOs: { toolGroup: 'erp', toolName: 'getPurchaseOrders' },
    createPO: { toolGroup: 'erp', toolName: 'createPurchaseOrder' },
    viewVendors: { toolGroup: 'erp', toolName: 'getVendors' },
    financialOverview: { toolGroup: 'erp', toolName: 'getFinancialOverview' },
    spendAnalysis: { toolGroup: 'erp', toolName: 'getSpendAnalysis' },

    // Jobs intents
    searchJobs: { toolGroup: 'jobs', toolName: 'searchJobs' },
    jobDetails: { toolGroup: 'jobs', toolName: 'getJobDetails' },
    viewApplications: { toolGroup: 'jobs', toolName: 'getApplications' },
    applyJob: { toolGroup: 'jobs', toolName: 'applyToJob' },
    viewOffers: { toolGroup: 'jobs', toolName: 'getOffers' },
    negotiateOffer: { toolGroup: 'jobs', toolName: 'negotiateOffer' },
    acceptOffer: { toolGroup: 'jobs', toolName: 'acceptOffer' },
    salaryIntel: { toolGroup: 'jobs', toolName: 'getSalaryIntel' },

    // Insights intents
    getInsights: { toolGroup: 'insights', toolName: 'getInsights' },
    viewAlerts: { toolGroup: 'insights', toolName: 'getAlerts' },
    createAlert: { toolGroup: 'insights', toolName: 'createAlert' },
    getRecommendations: { toolGroup: 'insights', toolName: 'getRecommendations' },
    getAnalytics: { toolGroup: 'insights', toolName: 'getAnalytics' },
    dailyDigest: { toolGroup: 'insights', toolName: 'getDailyDigest' },

    // Payment intents
    initiatePayment: { toolGroup: 'payments', toolName: 'initiatePayment' },
    initiateTransfer: { toolGroup: 'payments', toolName: 'initiateTransfer' },
    paymentStatus: { toolGroup: 'payments', toolName: 'getPaymentStatus' },
    treasuryStatus: { toolGroup: 'payments', toolName: 'getTreasuryStatus' },
    grainStatus: { toolGroup: 'payments', toolName: 'getGrainStatus' },
    paymentHistory: { toolGroup: 'payments', toolName: 'getPaymentHistory' },
  }

  return intentToToolMap[intent] || null
}

export default allTools
