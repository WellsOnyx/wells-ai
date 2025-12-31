/**
 * Wells AI Progressive Profile Building System
 *
 * Profiles that build themselves through conversation.
 * Users never "fill out a profile" - they just talk to Wells.
 *
 * @module lib/onboarding
 */

// ============================================================================
// SCHEMA & TYPES
// ============================================================================

export type {
  ProgressiveProfile,
  Journey,
  BuyerProfile,
  SellerProfile,
  FounderProfile,
  JobSeekerProfile,
  JobPreferences,
  SalaryRange,
  BudgetRange,
  CapacityInfo,
  ExtractionEvent,
  ConfidenceScores,
  ProfileFieldDef,
  FounderPriority,
} from './profile-schema'

export {
  PROFILE_FIELDS,
  COMPLETENESS_THRESHOLDS,
  JOURNEY_REQUIRED_FIELDS,
  JOURNEY_IMPORTANT_FIELDS,
  createEmptyProfile,
  calculateCompleteness,
  getNestedValue,
  setNestedValue,
  getMissingFields,
  getFieldsToAskAbout,
} from './profile-schema'

// ============================================================================
// EXTRACTOR
// ============================================================================

export type {
  ExtractionResult,
  ExtractedData,
} from './extractor'

export {
  extractFromMessage,
  mergeExtractionIntoProfile,
  Extractor,
} from './extractor'

// ============================================================================
// QUESTIONS
// ============================================================================

export type {
  SmartQuestion,
  QuestionContext,
} from './questions'

export {
  getNextQuestion,
  getQuestionsForSession,
  generateConversationalQuestion,
  getProgressFeedback,
  getExtractionAcknowledgment,
  buildNaturalQuestion,
  Questions,
} from './questions'

// ============================================================================
// DATABASE
// ============================================================================

export {
  getProfile,
  upsertProfile,
  getOrCreateProfile,
  updateProfileFields,
  addExtractionEvents,
  getExtractionHistory,
  getProfilesByJourney,
  getIncompleteProfiles,
  searchProfiles,
  getProfileStats,
  ProfileDB,
} from './db'

// ============================================================================
// HOOKS (Client-side)
// ============================================================================

// Note: These are exported separately for use in client components
// Import from './hooks' for client-side usage:
// import { useProgressiveProfile } from '@/lib/onboarding/hooks'

// ============================================================================
// EXISTING CONVERSATIONAL ONBOARDING
// ============================================================================

export {
  ConversationalOnboarding,
  getOrCreateConversation,
  processOnboardingMessage,
  generateWelcomeMessage,
  skipCurrentPhase,
  saveConversation,
} from './conversational-onboarding'

export type {
  ConversationPhase,
  OnboardingConversation,
  OnboardingMessage,
  CollectedOnboardingData,
  UserPreferences,
  SuggestedAction,
  OnboardingResponse,
} from './conversational-onboarding'

// ============================================================================
// TYPES FROM EXISTING SYSTEM
// ============================================================================

export type {
  UserJourney,
  OnboardingStep,
  OnboardingState,
  UserProfile,
  FounderProfile as LegacyFounderProfile,
  BuyerProfile as LegacyBuyerProfile,
  SellerProfile as LegacySellerProfile,
  JobsProfile as LegacyJobsProfile,
  Integration,
  IntegrationProvider,
  TreasuryWallet,
  PaymentMethod,
  ERPSystemChoice,
  ERPChoice,
} from './types'

export {
  ONBOARDING_STEPS,
  STEP_CONFIG,
  JOURNEY_CONFIG,
  ERP_OPTIONS,
} from './types'
