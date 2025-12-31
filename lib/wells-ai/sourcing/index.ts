/**
 * Wells AI Sourcing System
 *
 * Buyer-side sourcing intake and discovery system.
 * Helps buyers tell Wells what they need and find matching suppliers.
 */

export * from './categories';

// Re-export key types for convenience
export type {
  Category,
  SubCategory,
  CategorySpec,
  MatchingWeight
} from './categories';

export type {
  SourcingRequestStatus,
  MatchStatus,
  SourcingUrgency
} from './categories';
