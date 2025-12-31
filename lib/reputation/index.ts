/**
 * Trust & Reputation System
 *
 * Comprehensive trust scoring for all user journeys:
 * - Buyers: Transaction history, payment reliability, communication
 * - Sellers: Delivery reliability, quality ratings, response time
 * - Job Seekers: Interview attendance, offer acceptance, reliability
 * - Founders: Milestone achievement, investor communication, integrity
 */

// Types
export * from './types'

// Calculator
export {
  calculateTrustScore,
  getTierConfig,
  getNextTier,
  getScoreGrade,
  getScoreColor,
} from './calculator'

// Service
export {
  // Profile
  getOrCreateTrustProfile,
  getTrustProfile,
  updateTrustProfile,

  // Events
  recordTrustEvent,
  getEventType,
  getUserEvents,

  // Score calculation
  recalculateTrustScore,

  // Reviews
  createReview,
  getUserReviews,

  // Endorsements
  createEndorsement,
  getUserEndorsements,

  // Summary & Leaderboard
  getTrustSummary,
  getLeaderboard,

  // Verification
  markVerified,

  // Transaction helpers
  recordTransaction,
} from './service'
