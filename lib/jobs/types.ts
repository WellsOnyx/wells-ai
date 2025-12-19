/**
 * Wells AI Job Marketplace Types
 * Complete type definitions for worker profiles, tasks, applications,
 * assignments, deliverables, reviews, earnings, and attribution
 */

// =====================================================
// ENUMS & UNION TYPES
// =====================================================

/**
 * Task type classification
 */
export type TaskType =
  | 'micro_task'   // Quick tasks < 2 hours
  | 'project'      // Multi-day/week projects
  | 'contract'     // Ongoing contract work
  | 'placement';   // Full-time/part-time placement

/**
 * Task lifecycle status
 */
export type TaskStatus =
  | 'draft'        // Created but not published
  | 'posted'       // Published and accepting applications
  | 'matching'     // AI actively matching workers
  | 'assigned'     // Worker(s) assigned
  | 'in_progress'  // Work underway
  | 'submitted'    // Work submitted for review
  | 'approved'     // Work approved
  | 'paid'         // Payment completed
  | 'disputed'     // Under dispute resolution
  | 'cancelled';   // Task cancelled

/**
 * Worker account status
 */
export type WorkerStatus =
  | 'pending'      // Awaiting verification
  | 'verified'     // Identity verified
  | 'active'       // Available for work
  | 'busy'         // Currently at capacity
  | 'unavailable'  // Temporarily unavailable
  | 'suspended';   // Account suspended

/**
 * Skill categories for marketplace organization
 */
export type SkillCategory =
  | 'development'
  | 'design'
  | 'marketing'
  | 'sales'
  | 'operations'
  | 'research'
  | 'writing'
  | 'data'
  | 'finance'
  | 'legal'
  | 'hr'
  | 'customer_support'
  | 'project_management'
  | 'consulting'
  | 'translation'
  | 'video_audio'
  | 'admin'
  | 'other';

/**
 * Skill proficiency levels
 */
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Worker availability status
 */
export type AvailabilityStatus =
  | 'available'    // Ready to take new work
  | 'busy'         // Working but can take more
  | 'unavailable'  // Not taking new work
  | 'looking'      // Actively seeking
  | 'full_time'    // Seeking full-time
  | 'part_time'    // Seeking part-time
  | 'contract'     // Seeking contract work
  | 'freelance';   // Freelance only

export type ExperienceLevel = 'any' | 'entry' | 'intermediate' | 'senior' | 'expert';
export type LocationType = 'remote' | 'onsite' | 'hybrid';
export type PaymentType = 'fixed' | 'hourly' | 'milestone' | 'negotiable';
export type TaskVisibility = 'public' | 'private' | 'invite_only';
export type PosterType = 'buyer' | 'seller' | 'platform' | 'referral_partner';

// =====================================================
// WORKER SKILL
// =====================================================

/**
 * Individual skill with proficiency and metadata
 */
export interface WorkerSkill {
  id: string;
  workerId: string;

  // Skill details
  name: string;
  category: SkillCategory;
  level: SkillLevel;

  // Experience
  yearsExperience?: number;
  lastUsed?: Date;

  // Verification
  verified: boolean;
  verifiedAt?: Date;
  verificationMethod?: 'test' | 'portfolio' | 'certification' | 'endorsement' | 'ai_assessment';
  certificationUrl?: string;

  // Stats
  tasksCompleted: number;
  averageRating?: number;
  endorsementCount: number;

  // Display
  featured: boolean;
  sortOrder: number;

  createdAt: Date;
  updatedAt: Date;
}

// =====================================================
// WORKER PROFILE
// =====================================================

/**
 * Complete worker profile with skills, rates, availability, and stats
 */
export interface WorkerProfile {
  id: string;
  userId: string;
  displayName: string;
  headline?: string;
  bio?: string;
  avatarUrl?: string;

  // Skills & Experience
  skills: WorkerSkill[];
  skillNames: string[];  // Denormalized for quick search
  skillLevels?: Record<string, SkillLevel>;
  categories: SkillCategory[];
  experienceYears?: number;

  // Rates
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  preferredRate?: number;
  preferredCurrency: string;
  minimumProjectValue?: number;

  // Portfolio & Links
  portfolioUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  resumeUrl?: string;

  // Availability
  availability: AvailabilityStatus;
  hoursPerWeek?: number;
  timezone?: string;
  locations?: string[];
  remoteOnly: boolean;
  willingToRelocate: boolean;
  availableFrom?: Date;

  // Work Preferences
  preferredTaskTypes?: TaskType[];
  preferredIndustries?: string[];
  minTaskValue?: number;
  maxTasksActive?: number;
  preferredProjectLength?: 'short' | 'medium' | 'long' | 'ongoing';

  // Verification
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  backgroundChecked: boolean;
  verificationLevel: 'none' | 'basic' | 'standard' | 'premium';
  verifiedAt?: Date;

  // AI Settings
  aiMatchingEnabled: boolean;
  aiAutoApplyEnabled: boolean;
  aiAutoApplyThreshold?: number;
  proactiveOpportunities: boolean;
  aiPersonality?: 'professional' | 'casual' | 'technical' | 'creative';

  // Stats (cached for performance)
  stats: WorkerStats;
  completedTasks: number;
  totalEarnings: number;
  averageRating?: number;
  reviewCount: number;
  responseRate?: number;
  completionRate?: number;
  successRate?: number;
  onTimeRate?: number;
  repeatClientRate?: number;

  // Network & Attribution
  referredBy?: string;
  referralCode?: string;
  attributionEarnings: number;
  networkSize: number;

  // Status
  status: WorkerStatus;
  suspendedAt?: Date;
  suspendedReason?: string;
  lastActiveAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

// =====================================================
// TASK POSTING
// =====================================================

/**
 * Task posting with full details, requirements, and poster info
 */
export interface TaskPosting {
  id: string;

  // Poster Information
  posterId: string;
  posterType: PosterType;
  posterName: string;
  posterCompany?: string;
  posterAvatarUrl?: string;
  posterRating?: number;
  posterTasksPosted: number;
  posterVerified: boolean;

  // Task Details
  title: string;
  description: string;
  shortDescription?: string;
  category: SkillCategory;
  categoryId?: string;
  subcategory?: string;
  subcategoryId?: string;

  // Skills Required
  requiredSkills: string[];
  preferredSkills?: string[];
  skillLevelRequired?: Record<string, SkillLevel>;

  tags?: string[];

  // Type & Scope
  taskType: TaskType;
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  experienceLevel: ExperienceLevel;
  estimatedHours?: number;
  estimatedDuration?: string;
  estimatedDurationDays?: number;

  // Budget
  budgetType: PaymentType;
  budgetMin?: number;
  budgetMax?: number;
  fixedPrice?: number;
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  currency: string;
  escrowRequired: boolean;

  // Requirements
  experienceRequired?: number;
  certifications?: string[];
  portfolioRequired: boolean;
  coverLetterRequired: boolean;
  screeningQuestions?: ScreeningQuestion[];

  // Location
  locationType: LocationType;
  location?: string;
  timezone?: string;
  timezoneFlexibility: 'strict' | 'flexible' | 'any';

  // Timing
  startDate?: Date;
  deadline?: Date;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  flexibleDeadline: boolean;

  // Application Settings
  maxApplications?: number;
  currentApplications: number;
  autoScreen: boolean;
  autoScreenCriteria?: AutoScreenCriteria;
  requiresInterview: boolean;
  autoAssign: boolean;
  preferredWorkerIds?: string[];
  blockedWorkerIds?: string[];

  // Visibility
  visibility: TaskVisibility;
  invitedWorkerIds?: string[];
  featuredUntil?: Date;

  // Status & Stats
  status: TaskStatus;
  applicationCount: number;
  viewCount: number;
  assignmentCount: number;
  saveCount: number;

  // AI Features
  aiMatchScores?: Record<string, number>;
  suggestedWorkers?: string[];
  aiGeneratedDescription?: boolean;
  aiEnhancedMatching: boolean;

  // Milestones (if applicable)
  milestones?: TaskMilestone[];
  milestonesTotal?: number;

  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  expiresAt?: Date;
  closedAt?: Date;
  closedReason?: string;
}

export interface ScreeningQuestion {
  id: string;
  question: string;
  type: 'text' | 'choice' | 'number' | 'boolean';
  required: boolean;
  options?: string[];
  correctAnswer?: string;
  isEliminatory: boolean;
}

export interface AutoScreenCriteria {
  minRating?: number;
  minCompletedTasks?: number;
  requiredSkills?: string[];
  minExperienceYears?: number;
  requiredVerification?: ('email' | 'phone' | 'identity' | 'background')[];
  preferredTimezones?: string[];
  maxHourlyRate?: number;
}

// =====================================================
// TASK APPLICATION
// =====================================================

/**
 * Worker application with proposal, rate, and timeline
 */
export interface TaskApplication {
  id: string;
  taskId: string;
  workerId: string;

  // Worker Info (denormalized for display)
  workerName: string;
  workerHeadline?: string;
  workerAvatarUrl?: string;
  workerRating?: number;
  workerCompletedTasks?: number;
  workerSkills: string[];

  // Proposal Content
  coverLetter: string;
  proposalSummary?: string;
  proposedApproach?: string;

  // Rate & Timeline
  proposedRate: number;
  rateType: 'fixed' | 'hourly';
  proposedTimeline: string;
  estimatedHours?: number;
  estimatedCompletionDate?: Date;
  canStartDate?: Date;

  // Supporting Materials
  portfolioLinks?: string[];
  attachments?: ApplicationAttachment[];
  relevantExperience?: string;

  // Screening Answers
  screeningAnswers?: Record<string, string | number | boolean>;

  // Match Analysis
  matchScore: number;
  matchReasons?: string[];
  aiRecommendation?: 'strong_yes' | 'yes' | 'maybe' | 'no';
  skillMatchPercent?: number;
  rateMatchPercent?: number;

  // Status
  status: ApplicationStatus;
  rejectionReason?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;

  // Interview
  interviewScheduledAt?: Date;
  interviewCompletedAt?: Date;
  interviewNotes?: string;
  interviewRating?: number;

  // AI Features
  aiGenerated: boolean;
  aiPersonalization?: AIPersonalization;

  createdAt: Date;
  updatedAt: Date;
  withdrawnAt?: Date;

  // Joined data
  task?: TaskPosting;
  worker?: WorkerProfile;
}

export type ApplicationStatus =
  | 'pending'
  | 'reviewed'
  | 'shortlisted'
  | 'interviewing'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export interface ApplicationAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

export interface AIPersonalization {
  toneUsed: string;
  keyPointsHighlighted: string[];
  skillsEmphasized: string[];
  experienceReferenced: string[];
}

// =====================================================
// TASK ASSIGNMENT
// =====================================================

/**
 * Awarded task with milestones, escrow, and tracking info
 */
export interface TaskAssignment {
  id: string;
  taskId: string;
  workerId: string;
  applicationId?: string;

  // Task Info (denormalized)
  taskTitle: string;
  taskType: TaskType;
  posterName: string;
  posterId: string;
  posterCompany?: string;

  // Worker Info (denormalized)
  workerName: string;
  workerAvatarUrl?: string;

  // Terms
  agreedRate: number;
  rateType: 'fixed' | 'hourly';
  estimatedTotal: number;
  estimatedHours?: number;
  platformFeePercent: number;
  platformFee: number;
  workerPayout: number;
  agreedDeadline?: Date;

  // Escrow
  escrowAmount: number;
  escrowStatus: EscrowStatus;
  escrowId?: string;
  escrowFundedAt?: Date;
  escrowReleasedAt?: Date;

  // Milestones
  milestones: TaskMilestone[];
  milestonesCompleted: number;
  milestonesTotal: number;
  currentMilestoneId?: string;

  // Timeline
  startDate: Date;
  expectedEndDate?: Date;
  actualEndDate?: Date;

  // Progress
  status: AssignmentStatus;
  progressPercent: number;
  lastActivityAt?: Date;

  // Deliverables
  deliverables: TaskDeliverable[];
  currentDeliverable?: string;
  submissionCount: number;

  // Communication
  messageCount: number;
  lastMessageAt?: Date;
  unreadMessages: number;

  // Time Tracking
  hoursLogged: number;
  timeEntries?: TimeEntry[];

  // Completion
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  cancelledBy?: string;

  // Payment
  paymentStatus: PaymentStatus;
  paidAt?: Date;
  totalPaid: number;

  // Dispute
  disputeId?: string;
  disputeStatus?: 'open' | 'investigating' | 'resolved' | 'escalated';

  createdAt: Date;
  updatedAt: Date;

  // Joined data
  task?: TaskPosting;
  worker?: WorkerProfile;
  review?: TaskReview;
}

export type AssignmentStatus =
  | 'pending'            // Awaiting start
  | 'active'             // Work in progress
  | 'paused'             // Temporarily paused
  | 'submitted'          // Work submitted
  | 'under_review'       // Being reviewed
  | 'revision_requested' // Changes requested
  | 'completed'          // Successfully completed
  | 'cancelled'          // Cancelled
  | 'disputed';          // Under dispute

export type PaymentStatus =
  | 'pending'
  | 'in_escrow'
  | 'released'
  | 'processing'
  | 'paid'
  | 'refunded'
  | 'failed';

export type EscrowStatus =
  | 'pending'
  | 'funded'
  | 'partial'
  | 'released'
  | 'refunded'
  | 'disputed';

export interface TimeEntry {
  id: string;
  assignmentId: string;
  date: Date;
  hours: number;
  description?: string;
  approved: boolean;
  approvedAt?: Date;
}

// =====================================================
// TASK MILESTONE
// =====================================================

/**
 * Deliverable milestone with amount, due date, and status
 */
export interface TaskMilestone {
  id: string;
  assignmentId: string;
  taskId?: string;

  // Details
  title: string;
  description?: string;
  deliverables?: string[];
  acceptanceCriteria?: string[];

  // Payment
  amount: number;
  currency: string;
  percentOfTotal: number;

  // Timeline
  dueDate?: Date;
  estimatedHours?: number;
  order: number;

  // Status
  status: MilestoneStatus;
  startedAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;

  // Feedback
  feedback?: string;
  revisionCount: number;
  lastRevisionNote?: string;

  // Payment
  paymentId?: string;
  paidAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type MilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'paid';

// =====================================================
// TASK SUBMISSION
// =====================================================

/**
 * Submitted work with attachments and notes
 */
export interface TaskSubmission {
  id: string;
  assignmentId: string;
  workerId: string;
  milestoneId?: string;

  // Submission Details
  title: string;
  description?: string;
  notes?: string;

  // Attachments
  attachments: SubmissionAttachment[];
  links?: SubmissionLink[];

  // Files Summary
  totalFiles: number;
  totalFileSize: number;

  // Status
  status: SubmissionStatus;
  version: number;
  isRevision: boolean;
  previousSubmissionId?: string;

  // Review
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  rating?: number;

  // Approval
  approvedAt?: Date;
  approvedBy?: string;

  // Rejection
  rejectedAt?: Date;
  rejectionReason?: string;
  revisionRequested: boolean;
  revisionInstructions?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionAttachment {
  id: string;
  submissionId: string;

  // File info
  fileName: string;
  fileUrl: string;
  fileType: string;
  mimeType: string;
  fileSize: number;

  // Preview
  thumbnailUrl?: string;
  previewUrl?: string;

  // Metadata
  description?: string;
  isMainDeliverable: boolean;

  uploadedAt: Date;
}

export interface SubmissionLink {
  id: string;
  url: string;
  title?: string;
  description?: string;
  type: 'demo' | 'repository' | 'documentation' | 'preview' | 'other';
}

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'revision_requested';

// =====================================================
// TASK DELIVERABLES (Legacy support)
// =====================================================

export interface TaskDeliverable {
  id: string;
  assignmentId: string;
  workerId: string;
  milestoneId?: string;

  // Content
  title: string;
  description?: string;
  fileUrls?: string[];
  links?: string[];
  notes?: string;
  fileType?: string;

  // Status
  status: DeliverableStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;

  // Feedback
  feedback?: string;
  revisionCount: number;
  revisionNotes?: string;

  createdAt: Date;
  updatedAt?: Date;
}

export type DeliverableStatus =
  | 'pending'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'revision_requested';

// =====================================================
// TASK REVIEW
// =====================================================

/**
 * Rating and feedback with recommendations
 */
export interface TaskReview {
  id: string;
  assignmentId: string;
  taskId: string;

  // Reviewer info
  reviewerId: string;
  reviewerType: 'poster' | 'worker';
  reviewerName: string;
  reviewerAvatarUrl?: string;

  // Reviewee info
  revieweeId: string;
  revieweeType: 'poster' | 'worker';
  revieweeName: string;

  // Rating
  rating: number;
  ratingBreakdown: RatingBreakdown;

  // Content
  title?: string;
  comment: string;
  highlights?: string[];
  isPublic: boolean;

  // Recommendations
  wouldRecommend: boolean;
  recommendationNote?: string;
  recommendedFor?: string[];  // e.g., ['similar projects', 'frontend work']

  // Response
  responseComment?: string;
  respondedAt?: Date;

  // Moderation
  status: ReviewStatus;
  flaggedAt?: Date;
  flagReason?: string;
  moderatedAt?: Date;
  moderatorNotes?: string;

  // Helpful votes
  helpfulCount: number;
  notHelpfulCount: number;
  reportCount: number;

  // AI Analysis
  sentimentScore?: number;
  aiSummary?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface RatingBreakdown {
  quality: number;
  communication: number;
  timeliness: number;
  professionalism: number;
  expertise: number;
  wouldHireAgain?: boolean;
  wouldWorkAgain?: boolean;
}

export type ReviewStatus = 'pending' | 'published' | 'hidden' | 'flagged' | 'removed';

// =====================================================
// WORKER EARNINGS (GRAIN Payment Record)
// =====================================================

/**
 * GRAIN payment record for worker earnings
 */
export interface WorkerEarning {
  id: string;
  workerId: string;
  assignmentId?: string;
  taskId?: string;
  milestoneId?: string;

  // Type & Description
  type: EarningType;
  description: string;
  category: EarningCategory;

  // GRAIN Amounts
  grainAmount: number;
  grainRate: number;  // USD to GRAIN rate at time of earning

  // USD Amounts
  grossAmountUsd: number;
  platformFeeUsd: number;
  processingFeeUsd: number;
  netAmountUsd: number;

  // Final amounts
  grossAmount: number;
  platformFee: number;
  processingFee: number;
  netAmount: number;
  currency: string;

  // Attribution details (for referral/attribution earnings)
  attributedFromId?: string;
  attributedFromName?: string;
  attributionLevel?: number;
  attributionPercent?: number;
  sourceEarningId?: string;

  // Status
  status: EarningStatus;
  availableAt?: Date;
  processedAt?: Date;
  paidAt?: Date;
  payoutId?: string;
  withdrawnAt?: Date;

  // Transaction details
  transactionHash?: string;
  vaultId?: string;

  // Metadata
  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt?: Date;
}

export type EarningType =
  | 'task_payment'
  | 'milestone'
  | 'hourly'
  | 'bonus'
  | 'tip'
  | 'referral'
  | 'attribution'
  | 'adjustment'
  | 'refund';

export type EarningCategory =
  | 'work'           // Direct work earnings
  | 'referral'       // Referral commissions
  | 'attribution'    // Attribution chain earnings
  | 'bonus'          // Platform bonuses
  | 'adjustment';    // Manual adjustments

export type EarningStatus =
  | 'pending'        // Awaiting completion/approval
  | 'available'      // Ready for withdrawal
  | 'processing'     // Withdrawal in progress
  | 'paid'           // Paid to worker
  | 'withdrawn'      // Withdrawn to external
  | 'held'           // On hold (dispute, etc.)
  | 'failed'         // Payment failed
  | 'refunded';      // Refunded to poster

// Legacy alias for backward compatibility
export type WorkerEarnings = WorkerEarning;
export type EarningsType = EarningType;
export type EarningsStatus = EarningStatus;

// =====================================================
// PROACTIVE MATCH
// =====================================================

/**
 * AI-suggested match with score and reasoning
 */
export interface ProactiveMatch {
  id: string;
  workerId: string;
  taskId: string;

  // Match Details
  matchScore: number;  // 0-100
  matchConfidence: 'low' | 'medium' | 'high' | 'very_high';

  // Reasoning
  matchReasons: MatchReason[];
  aiRationale: string;
  strengthsSummary: string;
  potentialConcerns?: string[];

  // Skill Analysis
  skillMatchPercent: number;
  matchedSkills: string[];
  missingSkills?: string[];
  skillGaps?: SkillGap[];

  // Rate Analysis
  rateMatchPercent: number;
  workerRate: number;
  taskBudget: number;
  rateCompatibility: 'below' | 'within' | 'above' | 'negotiable';

  // Availability Analysis
  availabilityMatchPercent: number;
  timezoneOverlap?: number;
  canMeetDeadline: boolean;

  // Experience Analysis
  experienceMatchPercent: number;
  relevantExperience?: string[];
  similarTasksCompleted: number;

  // Potential Earnings
  estimatedEarnings: number;
  estimatedHours?: number;
  estimatedDuration?: string;

  // Suggested Action
  suggestedAction: 'apply_now' | 'review' | 'skip' | 'save';
  actionReason: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';

  // Status
  status: ProactiveMatchStatus;
  presentedAt?: Date;
  viewedAt?: Date;
  actedAt?: Date;
  action?: 'applied' | 'saved' | 'dismissed' | 'ignored';
  dismissReason?: string;

  // Expiration
  expiresAt?: Date;
  expired: boolean;

  createdAt: Date;
  updatedAt: Date;

  // Joined data
  task?: TaskPosting;
  worker?: WorkerProfile;
}

export interface MatchReason {
  factor: string;
  description: string;
  weight: number;
  score: number;
  isPositive: boolean;
}

export interface SkillGap {
  skill: string;
  required: SkillLevel;
  current?: SkillLevel;
  canLearn: boolean;
  learningResources?: string[];
}

export type ProactiveMatchStatus =
  | 'new'
  | 'presented'
  | 'viewed'
  | 'acted'
  | 'dismissed'
  | 'expired';

// =====================================================
// JOB ATTRIBUTION
// =====================================================

/**
 * Individual attribution record for referrer commission
 */
export interface JobAttribution {
  id: string;

  // Source of the earning
  sourceWorkerId: string;
  sourceWorkerName?: string;
  sourceEarningId: string;
  sourceType: EarningType;
  sourceAmount: number;

  // Beneficiary (referrer)
  referrerId: string;
  referrerName?: string;
  referrerLevel: 1 | 2 | 3 | 4;

  // Commission
  commissionPercent: number;
  commissionAmount: number;
  currency: string;

  // GRAIN
  grainAmount: number;
  grainRate: number;

  // Task details
  taskId?: string;
  taskTitle?: string;
  assignmentId?: string;

  // Status
  status: AttributionStatus;
  processedAt?: Date;
  paidAt?: Date;
  payoutId?: string;

  // Vault
  vaultId?: string;
  transactionHash?: string;

  createdAt: Date;
  updatedAt: Date;
}

export type AttributionStatus =
  | 'pending'      // Awaiting source earning to be confirmed
  | 'confirmed'    // Source earning confirmed
  | 'available'    // Ready for payout
  | 'processing'   // Payout in progress
  | 'paid'         // Paid to referrer
  | 'cancelled';   // Source earning was refunded/cancelled

// =====================================================
// WORKER ATTRIBUTION (4-Level Chain)
// =====================================================

/**
 * Complete attribution chain for a worker
 */
export interface WorkerAttribution {
  id: string;
  workerId: string;

  // 4-level attribution chain
  level1ReferrerId?: string;
  level1Percent: number;
  level2ReferrerId?: string;
  level2Percent: number;
  level3ReferrerId?: string;
  level3Percent: number;
  level4ReferrerId?: string;
  level4Percent: number;

  // Totals
  totalEarningsGenerated: number;
  totalAttributionPaid: number;

  // Status
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;

  // Joined data (populated when needed)
  level1Referrer?: WorkerProfile;
  level2Referrer?: WorkerProfile;
  level3Referrer?: WorkerProfile;
  level4Referrer?: WorkerProfile;
}

export interface AttributionChain {
  workerId: string;
  workerName?: string;
  chain: AttributionLevel[];
  totalPercent: number;
}

export interface AttributionLevel {
  level: number;
  referrerId: string;
  referrerName?: string;
  referrerAvatarUrl?: string;
  percent: number;
  totalEarningsFromWorker?: number;
}

// Default attribution percentages
export const DEFAULT_ATTRIBUTION_PERCENTS = {
  level1: 5.0,  // Direct referrer gets 5%
  level2: 2.5,  // Second level gets 2.5%
  level3: 1.0,  // Third level gets 1%
  level4: 0.5,  // Fourth level gets 0.5%
};

// =====================================================
// PROACTIVE OPPORTUNITIES
// =====================================================

export interface ProactiveOpportunity {
  id: string;
  workerId: string;
  taskId?: string;

  // Type & Details
  type: OpportunityType;
  title: string;
  description: string;
  reason: string;
  source: OpportunitySource;

  // Related Entity
  relatedTaskId?: string;
  relatedCompanyId?: string;
  relatedWorkerId?: string;

  // Match Details
  matchScore?: number;
  matchFactors?: string[];
  aiRationale?: string;
  potentialEarnings?: number;
  estimatedHours?: number;

  // Actions
  suggestedAction: string;
  primaryAction: string;
  primaryActionUrl?: string;
  secondaryAction?: string;
  actionDeadline?: Date;

  // Status
  status: OpportunityStatus;
  expiresAt?: Date;
  outcome?: string;

  createdAt: Date;
  viewedAt?: Date;
  actedAt?: Date;
  dismissedAt?: Date;
}

export type OpportunityType =
  | 'task_match'
  | 'skill_demand'
  | 'network_opportunity'
  | 'upsell'
  | 'referral_bonus'
  | 'skill_upgrade'
  | 'profile_boost'
  | 'featured_task'
  | 'recurring_opportunity';

export type OpportunitySource =
  | 'ai_matching'
  | 'buyer_invite'
  | 'skill_gap'
  | 'platform_promotion'
  | 'referral_network'
  | 'trending';

export type OpportunityStatus =
  | 'new'
  | 'pending'
  | 'viewed'
  | 'acted'
  | 'dismissed'
  | 'expired';

// =====================================================
// TASK CATEGORIES
// =====================================================

export interface TaskCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  iconUrl?: string;
  color?: string;
  isActive: boolean;
  sortOrder: number;
  taskCount?: number;
  createdAt: Date;
  updatedAt?: Date;
}

// =====================================================
// LEGACY TASK TYPE (for backward compatibility)
// =====================================================

export interface Task extends TaskPosting {
  // Additional fields from legacy Task interface
  skills: string[];
  assignments?: TaskAssignment[];
  categoryData?: TaskCategory;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

/**
 * Base API response with conversational message
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  conversationalMessage?: string;  // Human-friendly message for chat UI
  data?: T;
  error?: string;
  errorCode?: string;
}

export interface WorkerProfileResponse extends ApiResponse<WorkerProfile> {
  profile?: WorkerProfile;
  suggestions?: string[];
  nextSteps?: string[];
  conversationalMessage: string;
}

export interface WorkerStatsResponse extends ApiResponse<WorkerStats> {
  stats: WorkerStats;
  insights?: string[];
  conversationalMessage: string;
}

export interface WorkerStats {
  totalEarnings: number;
  pendingEarnings: number;
  availableBalance: number;

  // GRAIN specific
  grainBalance: number;
  grainPending: number;
  grainVested: number;

  tasksCompleted: number;
  tasksInProgress: number;
  applicationsActive: number;
  applicationsPending: number;

  averageRating: number | null;
  totalRatings: number;
  successRate: number | null;
  onTimeRate: number | null;

  attributionEarnings: number;
  referralCount: number;
  networkSize: number;

  thisMonthEarnings: number;
  lastMonthEarnings: number;
  earningsGrowth: number | null;

  // Engagement
  profileViews: number;
  invitesReceived: number;
}

export interface WorkerEarningsResponse extends ApiResponse<WorkerEarning[]> {
  earnings: WorkerEarning[];
  summary: EarningsSummary;
  period?: {
    start: Date;
    end: Date;
  };
  conversationalMessage: string;
}

export interface EarningsSummary {
  totalGross: number;
  totalNet: number;
  totalFees: number;
  totalPlatformFee: number;
  totalProcessingFee: number;
  totalGrain: number;
  byType: Partial<Record<EarningType, number>>;
  byStatus: Partial<Record<EarningStatus, number>>;
  availableBalance: number;
  pendingAmount: number;
}

export interface WorkerAttributionResponse extends ApiResponse<WorkerAttribution> {
  attribution: WorkerAttribution | null;
  chain: AttributionChain | null;
  earnings: {
    totalGenerated: number;
    totalReceived: number;
    pendingAmount: number;
    byLevel: Record<number, number>;
  };
  referralCode?: string;
  referralLink?: string;
  conversationalMessage: string;
}

export interface ProactiveMatchesResponse extends ApiResponse<ProactiveMatch[]> {
  matches: ProactiveMatch[];
  topMatch?: ProactiveMatch;
  totalCount: number;
  filters?: {
    minScore?: number;
    taskTypes?: TaskType[];
    categories?: SkillCategory[];
  };
  conversationalMessage: string;
}

export interface ProactiveOpportunitiesResponse extends ApiResponse<ProactiveOpportunity[]> {
  opportunities: ProactiveOpportunity[];
  topMatch?: ProactiveOpportunity;
  totalCount: number;
  conversationalMessage: string;
}

export interface TaskSearchResponse extends ApiResponse<TaskPosting[]> {
  tasks: TaskPosting[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  filters?: TaskSearchFilters;
  suggestedFilters?: Partial<TaskSearchFilters>;
  conversationalMessage: string;
}

export interface TaskSearchFilters {
  query?: string;
  categories?: SkillCategory[];
  skills?: string[];
  paymentType?: PaymentType[];
  budgetMin?: number;
  budgetMax?: number;
  locationType?: LocationType[];
  experienceLevel?: ExperienceLevel[];
  taskType?: TaskType[];
  urgency?: string[];
  postedAfter?: Date;
  posterType?: PosterType[];
  sortBy?: 'relevance' | 'newest' | 'budget_high' | 'budget_low' | 'deadline' | 'match_score';
}

export interface ApplicationSubmitResponse extends ApiResponse<TaskApplication> {
  application?: TaskApplication;
  nextSteps?: string[];
  estimatedResponseTime?: string;
  conversationalMessage: string;
}

export interface AssignmentUpdateResponse extends ApiResponse<TaskAssignment> {
  assignment?: TaskAssignment;
  action?: string;
  nextSteps?: string[];
  conversationalMessage: string;
}

export interface SubmissionResponse extends ApiResponse<TaskSubmission> {
  submission?: TaskSubmission;
  nextSteps?: string[];
  estimatedReviewTime?: string;
  conversationalMessage: string;
}

export interface ReviewResponse extends ApiResponse<TaskReview> {
  review?: TaskReview;
  impactSummary?: {
    newRating?: number;
    ratingChange?: number;
    rankingChange?: string;
  };
  conversationalMessage: string;
}

export interface JobAttributionResponse extends ApiResponse<JobAttribution[]> {
  attributions: JobAttribution[];
  summary: {
    totalEarned: number;
    totalPending: number;
    byLevel: Record<number, number>;
    topReferrals: Array<{
      workerId: string;
      workerName: string;
      totalGenerated: number;
    }>;
  };
  conversationalMessage: string;
}

// =====================================================
// PARSING TYPES (for NL processing)
// =====================================================

export interface ParsedWorkerProfile {
  displayName?: string;
  headline?: string;
  bio?: string;
  skills?: string[];
  skillLevels?: Record<string, SkillLevel>;
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  hoursPerWeek?: number;
  availability?: AvailabilityStatus;
  categories?: SkillCategory[];
  experienceYears?: number;
  remoteOnly?: boolean;
  location?: string;
  timezone?: string;
  preferredTaskTypes?: TaskType[];
}

export interface SkillExtraction {
  skill: string;
  category?: SkillCategory;
  level?: SkillLevel;
  yearsExperience?: number;
  confidence: number;
}

// =====================================================
// FILTER TYPES
// =====================================================

export interface EarningsFilters {
  startDate?: Date;
  endDate?: Date;
  type?: EarningType[];
  status?: EarningStatus[];
  minAmount?: number;
  maxAmount?: number;
  assignmentId?: string;
  includeAttribution?: boolean;
}

export interface TaskFilters {
  status?: TaskStatus[];
  posterType?: PosterType[];
  category?: SkillCategory;
  minBudget?: number;
  maxBudget?: number;
  locationType?: LocationType[];
  skills?: string[];
  taskType?: TaskType[];
}

export interface ApplicationFilters {
  status?: ApplicationStatus[];
  taskId?: string;
  minMatchScore?: number;
}

export interface AttributionFilters {
  startDate?: Date;
  endDate?: Date;
  status?: AttributionStatus[];
  level?: (1 | 2 | 3 | 4)[];
  sourceWorkerId?: string;
  minAmount?: number;
}

// =====================================================
// CONVERSATIONAL MESSAGE HELPERS
// =====================================================

export interface ConversationalContext {
  userName?: string;
  userRole: 'worker' | 'poster' | 'admin';
  locale?: string;
  timezone?: string;
  tone?: 'formal' | 'casual' | 'friendly';
}

export interface ConversationalResponse {
  message: string;
  suggestions?: string[];
  actions?: ConversationalAction[];
  followUp?: string;
}

export interface ConversationalAction {
  label: string;
  action: string;
  url?: string;
  primary?: boolean;
}

/**
 * Generate a conversational message based on context
 */
export function createConversationalMessage(
  template: string,
  data: Record<string, unknown>,
  context?: ConversationalContext
): string {
  let message = template;

  // Replace placeholders
  for (const [key, value] of Object.entries(data)) {
    message = message.replace(new RegExp(`{${key}}`, 'g'), String(value));
  }

  // Add greeting if context provided
  if (context?.userName && message.startsWith('{greeting}')) {
    const greeting = context.tone === 'formal'
      ? `Hello ${context.userName},`
      : `Hey ${context.userName}!`;
    message = message.replace('{greeting}', greeting);
  }

  return message;
}
