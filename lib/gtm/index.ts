/**
 * Grain & Vault - GTM Cold Start Engine
 *
 * Complete GTM toolkit for enterprise treasury/procurement outbound
 * Budget: $200-500/mo
 * Goal: 10 demos in first month
 *
 * Usage:
 *
 * import {
 *   // ICP & Targeting
 *   PRIMARY_ICP,
 *   BUYER_PERSONAS,
 *   getPersonaByTitle,
 *   calculateLeadScore,
 *
 *   // Email Templates
 *   EMAIL_SEQUENCES,
 *   personalizeTemplate,
 *   generatePersonalizationData,
 *
 *   // LinkedIn Scripts
 *   CONNECTION_REQUESTS,
 *   INMAILS,
 *   VOICE_NOTE_SCRIPTS,
 *   LINKEDIN_BEST_PRACTICES,
 *
 *   // Playbook
 *   TOOL_STACK,
 *   WEEK_1, WEEK_2, WEEK_3, WEEK_4,
 *   IDEAL_DAILY_SCHEDULE,
 *   ESCALATION_TRIGGERS,
 *
 * } from '@/lib/gtm'
 */

// =============================================================================
// ICP & TARGETING
// =============================================================================

export {
  // Types
  type ICPCompany,
  type BuyingSignal,
  type BuyerPersona,
  type TargetingChannel,
  type LeadScore,
  type ObjectionResponse,
  type Competitor,

  // Constants
  PRIMARY_ICP,
  SECONDARY_ICP,
  BUYER_PERSONAS,
  TARGETING_CHANNELS,
  OBJECTION_RESPONSES,
  COMPETITORS,

  // Functions
  scoreCompany,
  scorePersona,
  scoreTiming,
  scoreEngagement,
  calculateLeadScore,
  getPersonaByTitle,
  getObjectionsForPersona,
} from './icp'

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

export {
  // Types
  type EmailTemplate,
  type EmailSequence,

  // Constants
  PERSONALIZATION_TOKENS,
  EMAIL_SEQUENCES,
  SUBJECT_LINE_VARIANTS,

  // Individual Templates
  CFO_COLD_1,
  CFO_COLD_2,
  CFO_COLD_3,
  PROCUREMENT_COLD_1,
  PROCUREMENT_COLD_2,
  PROCUREMENT_COLD_3,
  CONTROLLER_COLD_1,
  CONTROLLER_COLD_2,
  TREASURY_COLD_1,
  TREASURY_COLD_2,
  DEMO_CONFIRMATION,
  NO_SHOW_FOLLOW_UP,
  NO_SHOW_LOOM,
  POST_DEMO_SAME_DAY,
  POST_DEMO_FOLLOW_UP,

  // Functions
  getSequenceForPersona,
  personalizeTemplate,
  calculateYieldPotential,
  calculateFeeSavings,
  generatePersonalizationData,
} from './email-templates'

// =============================================================================
// LINKEDIN SCRIPTS
// =============================================================================

export {
  // Types
  type LinkedInScript,
  type LinkedInSequence,

  // Constants
  CONNECTION_REQUESTS,
  INMAILS,
  FOLLOW_UP_SCRIPTS,
  VOICE_NOTE_SCRIPTS,
  ENGAGEMENT_COMMENTS,
  LINKEDIN_SEQUENCES,
  LINKEDIN_BEST_PRACTICES,
  PROFILE_HEADLINE_OPTIONS,
  SALES_NAV_SEARCHES,

  // Functions
  getConnectionRequest,
  getInMailForPersona,
  personalizeLinkedInMessage,
} from './linkedin-scripts'

// =============================================================================
// COLD START PLAYBOOK
// =============================================================================

export {
  // Types
  type DailyActivity,
  type WeeklyMilestone,
  type Metric,
  type Tool,
  type EscalationTrigger,
  type SuccessMetric,
  type DailySchedule,

  // Constants
  TOOL_STACK,
  WEEK_1,
  WEEK_2,
  WEEK_3,
  WEEK_4,
  IDEAL_DAILY_SCHEDULE,
  ESCALATION_TRIGGERS,
  SUCCESS_METRICS,
  CRM_COLUMNS,
  PIPELINE_STAGES,
  SCALING_TRIGGERS,

  // Functions
  calculateToolCosts,
  getWeeklyPlaybook,
  calculatePipelineValue,
  calculateCAC,
  isOnTrack,
} from './cold-start-playbook'

// =============================================================================
// QUICK START GUIDE
// =============================================================================

/**
 * GTM Cold Start - Quick Start Guide
 *
 * Week 1 Checklist:
 *
 * Day 1 - Setup (4 hours):
 * [ ] Sign up for LinkedIn Sales Navigator ($99/mo)
 * [ ] Sign up for Apollo.io ($49/mo)
 * [ ] Set up Calendly/Cal.com (free)
 * [ ] Set up Loom (free)
 * [ ] Create tracking spreadsheet (use CRM_COLUMNS)
 * [ ] Optimize LinkedIn profile (use PROFILE_HEADLINE_OPTIONS)
 *
 * Day 2-3 - Build List (3 hours):
 * [ ] Create saved searches in Sales Navigator (use SALES_NAV_SEARCHES)
 * [ ] Export first 50 contacts to Apollo
 * [ ] Verify emails in Apollo
 * [ ] Score leads (use calculateLeadScore)
 * [ ] Prioritize: CFOs > VP Procurement > Controllers
 *
 * Day 4-5 - First Outreach:
 * [ ] Send 10 cold emails (use CFO_COLD_1 or PROCUREMENT_COLD_1)
 * [ ] Send 5 LinkedIn connection requests (use CONNECTION_REQUESTS)
 * [ ] Record 2 personalized Looms for top prospects
 *
 * Daily Routine (see IDEAL_DAILY_SCHEDULE):
 * - 8-10am: Cold email batch
 * - 10-10:30am: LinkedIn engagement
 * - 10:30-12pm: Demo calls
 * - 1-2:30pm: Follow-ups & admin
 * - 2:30-4pm: More demos
 * - 4-5pm: List building & research
 * - 5-5:30pm: Update CRM, plan tomorrow
 *
 * Key Metrics to Track:
 * - Emails sent (target: 40-50/week)
 * - Response rate (target: 10-15%)
 * - Demos booked (target: 2-3/week)
 * - Demo show rate (target: 70%)
 *
 * Common Objections (see OBJECTION_RESPONSES):
 * - "How is principal protected?" -> USDC backed by cash + T-bills
 * - "This seems too good to be true" -> Explain yield sources
 * - "Board won't approve crypto" -> USD-in, USD-out
 * - "Locked into current ERP" -> We integrate alongside
 *
 * Escalation (see ESCALATION_TRIGGERS):
 * - <5% response rate after 50 emails -> Review messaging
 * - >40% no-show rate -> Add reminders
 * - 0 demos after Week 1 -> Try LinkedIn-first
 */

export const QUICK_START_CHECKLIST = {
  day1: [
    'Sign up for LinkedIn Sales Navigator ($99/mo)',
    'Sign up for Apollo.io ($49/mo)',
    'Set up Calendly or Cal.com (free)',
    'Set up Loom (free)',
    'Create Google Sheets CRM with standard columns',
    'Optimize LinkedIn profile with value-focused headline',
  ],
  day2_3: [
    'Create 4 saved searches in Sales Navigator',
    'Export first 50 contacts matching ICP',
    'Verify emails in Apollo',
    'Score and prioritize leads',
    'Research top 10 prospects for personalization',
  ],
  day4_5: [
    'Send 10 personalized cold emails',
    'Send 5 LinkedIn connection requests',
    'Record 2 Loom videos for top prospects',
    'Set up email tracking (opens/clicks)',
    'Schedule first demo slots in calendar',
  ],
  ongoing: [
    'Send 10 cold emails/day',
    'Make 5 LinkedIn connections/day',
    'Follow up on all opens within 24 hours',
    'Log all activities in CRM',
    'Weekly retrospective on what worked',
  ],
}
