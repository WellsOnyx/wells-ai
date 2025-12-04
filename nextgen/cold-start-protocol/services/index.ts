// @ts-nocheck
/**
 * Cold Start Protocol - Services Index
 *
 * Exports all services for the autonomous demand generation engine.
 */

// Apollo Prospecting
export {
  ApolloService,
  createApolloService,
  executeApolloSearch,
  executeApolloEnrich,
} from './apollo-service'

// LinkedIn Automation
export {
  LinkedInService,
  createLinkedInService,
  executeLinkedInSearch,
  executeLinkedInConnection,
  executeLinkedInMessage,
} from './linkedin-service'

// RFP Hunter
export {
  RfpHunterService,
  createRfpHunterService,
  executeRfpDiscovery,
  executeRfpResponse,
  executeRfpSubmission,
} from './rfp-service'
export type { RfpSearchCriteria } from './rfp-service'

// Partnership Registration
export {
  PartnershipService,
  createPartnershipService,
  executePortalDiscovery,
  executePortalRegistration,
  executeEmailVerification,
} from './partnership-service'
export type {
  PortalSearchCriteria,
  FormAnalysis,
  FieldMapping,
  RegistrationResult,
} from './partnership-service'

// Orchestrator
export {
  ColdStartOrchestrator,
  createOrchestrator,
} from './orchestrator'
