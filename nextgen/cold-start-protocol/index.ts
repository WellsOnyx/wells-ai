// @ts-nocheck
/**
 * Cold Start Protocol
 *
 * ⚠️  MASTER ACCESS ONLY ⚠️
 *
 * Autonomous demand generation engine for the owner.
 * Handles prospecting, outreach, RFP responses, and partnership registrations
 * with minimal human intervention.
 *
 * Usage:
 *   "Wells, I need a cold start protocol for tort law firms"
 *   → Wells autonomously sources, reaches out, registers, responds to RFPs,
 *     and only escalates when stuck.
 *
 * Capabilities:
 * - Apollo.io prospecting (free tier: 10k credits/month)
 * - LinkedIn outreach (personal + Recruiter)
 * - RFP discovery and auto-response
 * - Partnership portal registration
 * - Email campaigns
 * - Intelligent escalation
 *
 * Security:
 * - Protected by COLD_START_MASTER_KEY
 * - All actions logged
 * - Rate limited to avoid detection
 */

// Types
export * from './types'

// Services
export {
  // Apollo
  ApolloService,
  createApolloService,
  executeApolloSearch,
  executeApolloEnrich,

  // LinkedIn
  LinkedInService,
  createLinkedInService,
  executeLinkedInSearch,
  executeLinkedInConnection,
  executeLinkedInMessage,

  // RFP
  RfpHunterService,
  createRfpHunterService,
  executeRfpDiscovery,
  executeRfpResponse,
  executeRfpSubmission,

  // Partnership
  PartnershipService,
  createPartnershipService,
  executePortalDiscovery,
  executePortalRegistration,
  executeEmailVerification,

  // Orchestrator
  ColdStartOrchestrator,
  createOrchestrator,
} from './services'

// API Route Handlers
export { POST, GET, DELETE } from './api/route-cold-start'
