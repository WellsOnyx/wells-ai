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
export * from './negotiation-tools'
export * from './scheduling-tools'

// Import tool registries
import { rfqTools } from './rfq-tools'
import { erpTools } from './erp-tools'
import { jobsTools } from './jobs-tools'
import { insightsTools } from './insights-tools'
import { paymentTools } from './payment-tools'
import { negotiationTools } from './negotiation-tools'
import { schedulingTools } from './scheduling-tools'

// Import inbox tools
import { inboxTools } from '../handlers/inbox-handler'
export { inboxTools } from '../handlers/inbox-handler'

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
  negotiation: negotiationTools,
  scheduling: schedulingTools,
  inbox: inboxTools,
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
  negotiation: {
    name: 'Negotiation Tools',
    description: 'AI-to-AI negotiation, counter-offers, and deal management',
    capabilities: [
      'Start AI-to-AI negotiations',
      'Send counter-offers',
      'Set negotiation limits',
      'Accept or reject offers',
      'Track negotiation progress',
    ],
    examples: [
      'Help me negotiate with TechCorp',
      'Counter at $45,000',
      'Let AI negotiate for me',
      'Accept their offer',
      'Set walk-away price at $40K',
    ],
  },
  scheduling: {
    name: 'Scheduling Tools',
    description: 'Meeting scheduling, calendar integration, and availability',
    capabilities: [
      'Schedule meetings',
      'Check availability',
      'Find mutual availability',
      'Reschedule or cancel meetings',
      'View upcoming meetings',
    ],
    examples: [
      'Schedule a call with John about the deal',
      'When am I free tomorrow?',
      'Find a time that works for everyone',
      'What meetings do I have today?',
      'Cancel my 3pm meeting',
    ],
  },
  inbox: {
    name: 'Unified Inbox Tools',
    description: 'Manage all communications across Email, Slack, Discord, LinkedIn, SMS, WhatsApp, Teams, and more',
    capabilities: [
      'Check messages across all channels',
      'Filter by channel (Slack, Email, SMS, etc.)',
      'Reply to messages conversationally',
      'Forward/delegate messages',
      'Search messages across all channels',
      'Set priorities (urgent, important, normal, low)',
      'Snooze and archive messages',
      'Summarize unread messages',
      'Compose new messages to any channel',
    ],
    examples: [
      'Any urgent messages?',
      'Show me my Slack messages',
      'Reply to John\'s email saying I\'ll call tomorrow',
      'Forward that to Sarah',
      'Find emails about the Acme deal',
      'Mark that as urgent',
      'Remind me about this tomorrow',
      'Summarize my unread messages',
      'Send a LinkedIn message to Sarah about the partnership',
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

    // Negotiation intents
    startNegotiation: { toolGroup: 'negotiation', toolName: 'startNegotiation' },
    sendCounter: { toolGroup: 'negotiation', toolName: 'sendCounterOffer' },
    counterOffer: { toolGroup: 'negotiation', toolName: 'sendCounterOffer' },
    negotiationStatus: { toolGroup: 'negotiation', toolName: 'getNegotiationStatus' },
    acceptDeal: { toolGroup: 'negotiation', toolName: 'acceptOffer' },
    rejectDeal: { toolGroup: 'negotiation', toolName: 'rejectNegotiation' },
    setLimits: { toolGroup: 'negotiation', toolName: 'setNegotiationLimits' },

    // Scheduling intents
    scheduleMeeting: { toolGroup: 'scheduling', toolName: 'scheduleMeeting' },
    checkAvailability: { toolGroup: 'scheduling', toolName: 'checkAvailability' },
    upcomingMeetings: { toolGroup: 'scheduling', toolName: 'getUpcomingMeetings' },
    rescheduleMeeting: { toolGroup: 'scheduling', toolName: 'rescheduleMeeting' },
    cancelMeeting: { toolGroup: 'scheduling', toolName: 'cancelMeeting' },
    findMutualTime: { toolGroup: 'scheduling', toolName: 'findMutualAvailability' },

    // Inbox intents
    checkMessages: { toolGroup: 'inbox', toolName: 'handleInboxIntent' },
    checkUrgent: { toolGroup: 'inbox', toolName: 'handleInboxIntent' },
    checkUnread: { toolGroup: 'inbox', toolName: 'handleInboxIntent' },
    filterChannel: { toolGroup: 'inbox', toolName: 'handleInboxIntent' },
    replyMessage: { toolGroup: 'inbox', toolName: 'handleInboxIntent' },
    forwardMessage: { toolGroup: 'inbox', toolName: 'handleInboxIntent' },
    searchMessages: { toolGroup: 'inbox', toolName: 'handleInboxIntent' },
    setPriority: { toolGroup: 'inbox', toolName: 'handleInboxIntent' },
    snoozeMessage: { toolGroup: 'inbox', toolName: 'handleInboxIntent' },
    archiveMessage: { toolGroup: 'inbox', toolName: 'handleInboxIntent' },
    summarizeMessages: { toolGroup: 'inbox', toolName: 'handleInboxIntent' },
    composeMessage: { toolGroup: 'inbox', toolName: 'handleInboxIntent' },
    inboxStats: { toolGroup: 'inbox', toolName: 'handleInboxIntent' },
  }

  return intentToToolMap[intent] || null
}

/**
 * Get all tools as a flat list with metadata.
 */
export function getAllToolsFlat(): Array<{
  category: string
  name: string
  description: string
}> {
  const tools: Array<{ category: string; name: string; description: string }> = []

  for (const [category, toolGroup] of Object.entries(allTools)) {
    const meta = toolMetadata[category as keyof typeof toolMetadata]
    for (const toolName of Object.keys(toolGroup)) {
      tools.push({
        category,
        name: toolName,
        description: meta?.capabilities?.find(c =>
          c.toLowerCase().includes(toolName.toLowerCase().replace(/([A-Z])/g, ' $1').trim())
        ) || meta?.description || '',
      })
    }
  }

  return tools
}

export default allTools
