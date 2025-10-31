/**
 * Central Schema Registry
 *
 * All API request/response schemas in one place
 */

import { z } from 'zod'
import { validators } from '../validation'

// ============================================================================
// CHAT API
// ============================================================================

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: validators.nonEmpty(10000)
})

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
  userData: z.object({
    userId: z.string().max(255).optional(),
    userType: z.enum(['buyer', 'seller', 'both']).optional(),
    name: z.string().max(255).optional(),
    company: z.string().max(255).optional(),
    email: validators.email().optional()
  }).optional()
})

// ============================================================================
// SUPPLIER APIs
// ============================================================================

export const supplierMatchSchema = z.object({
  category: validators.nonEmpty(100),
  requirements: validators.nonEmpty(5000)
})

export const supplierNotifySchema = z.object({
  supplierIds: z.array(z.string()).min(1).max(10),
  buyerName: validators.nonEmpty(255),
  requirements: validators.nonEmpty(5000),
  category: validators.nonEmpty(100)
})

export const supplierOnboardSchema = z.object({
  name: validators.nonEmpty(255),
  email: validators.email(),
  phone: validators.phone().optional(),
  capabilities: z.array(z.string()).min(1).max(20),
  description: validators.nonEmpty(2000).optional(),
  website: validators.url().optional()
})

// ============================================================================
// PARTNERSHIP APIs
// ============================================================================

export const partnershipCreateSchema = z.object({
  categorySlug: validators.nonEmpty(100),
  tier: z.enum(['1', '2', '3']).transform(Number),
  companyName: validators.nonEmpty(255),
  contactName: validators.nonEmpty(255),
  contactEmail: validators.email(),
  contactPhone: validators.phone().optional()
})

export const partnershipUpdateSchema = z.object({
  partnershipId: validators.uuid(),
  status: z.enum(['pending', 'active', 'cancelled']).optional(),
  notes: z.string().max(5000).optional()
})

// ============================================================================
// GTM APIs
// ============================================================================

export const gtmDiscoverSchema = z.object({
  practiceGroup: validators.nonEmpty(100),
  targetProfile: z.object({
    jobTitles: z.array(z.string()).min(1).max(10),
    industries: z.array(z.string()).optional(),
    companySize: z.enum(['startup', 'smb', 'mid-market', 'enterprise']).optional(),
    region: z.string().max(100).optional()
  }),
  limit: z.number().int().min(1).max(100).default(25)
})

export const gtmOutreachApproveSchema = z.object({
  outreachId: validators.uuid(),
  approved: z.boolean(),
  customMessage: z.string().max(5000).optional()
})

export const gtmDealCloseSchema = z.object({
  dealId: validators.uuid(),
  acv: validators.positiveInt(),
  closeDate: validators.isoDate(),
  notes: z.string().max(5000).optional()
})

// ============================================================================
// EMAIL APIs
// ============================================================================

export const emailSendSchema = z.object({
  to: validators.email(),
  toName: z.string().max(255).optional(),
  subject: validators.nonEmpty(255),
  html: validators.nonEmpty(100000),
  text: validators.nonEmpty(50000).optional(),
  from: validators.email().optional(),
  fromName: z.string().max(255).optional(),
  replyTo: validators.email().optional(),
  metadata: z.record(z.any()).optional()
})

// ============================================================================
// CONSENT APIs
// ============================================================================

export const consentDecideSchema = z.object({
  actionId: validators.uuid(),
  decision: z.enum(['approve', 'reject']),
  decidedBy: z.string().max(255).optional(),
  reason: z.string().max(1000).optional()
})

// ============================================================================
// RFQ APIs
// ============================================================================

export const rfqCreateSchema = z.object({
  category: validators.nonEmpty(100),
  title: validators.nonEmpty(255),
  description: validators.nonEmpty(10000),
  budget: z.number().positive().optional(),
  deadline: validators.isoDate().optional(),
  contactEmail: validators.email(),
  contactName: validators.nonEmpty(255)
})

// ============================================================================
// HR APIs
// ============================================================================

export const hrCreateEmploymentSchema = z.object({
  employeeName: validators.nonEmpty(255),
  email: validators.email(),
  role: validators.nonEmpty(100),
  department: z.string().max(100).optional(),
  startDate: validators.isoDate(),
  salary: validators.positiveInt().optional(),
  employmentType: z.enum(['full-time', 'part-time', 'contract', 'intern'])
})

// ============================================================================
// PAYMENT APIs
// ============================================================================

export const paymentCreateIntentSchema = z.object({
  amount: validators.positiveInt(),
  currency: z.enum(['usd', 'eur', 'gbp']).default('usd'),
  description: validators.nonEmpty(1000),
  metadata: z.record(z.string()).optional()
})

// ============================================================================
// WEBHOOK APIs
// ============================================================================

export const smsWebhookSchema = z.object({
  From: validators.phone(),
  Body: validators.nonEmpty(1600), // SMS max length
  MessageSid: z.string().max(100).optional(),
  To: validators.phone().optional()
})

// ============================================================================
// PLAYBOOK APIs
// ============================================================================

export const playbookExecuteSchema = z.object({
  playbookId: z.string().max(100),
  input: z.record(z.any()),
  context: z.record(z.any()).optional()
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ChatRequest = z.infer<typeof chatRequestSchema>
export type SupplierMatch = z.infer<typeof supplierMatchSchema>
export type SupplierNotify = z.infer<typeof supplierNotifySchema>
export type SupplierOnboard = z.infer<typeof supplierOnboardSchema>
export type PartnershipCreate = z.infer<typeof partnershipCreateSchema>
export type PartnershipUpdate = z.infer<typeof partnershipUpdateSchema>
export type GTMDiscover = z.infer<typeof gtmDiscoverSchema>
export type GTMOutreachApprove = z.infer<typeof gtmOutreachApproveSchema>
export type GTMDealClose = z.infer<typeof gtmDealCloseSchema>
export type EmailSend = z.infer<typeof emailSendSchema>
export type ConsentDecide = z.infer<typeof consentDecideSchema>
export type RFQCreate = z.infer<typeof rfqCreateSchema>
export type HRCreateEmployment = z.infer<typeof hrCreateEmploymentSchema>
export type PaymentCreateIntent = z.infer<typeof paymentCreateIntentSchema>
export type SMSWebhook = z.infer<typeof smsWebhookSchema>
export type PlaybookExecute = z.infer<typeof playbookExecuteSchema>

// ============================================================================
// JOB SEEKER APIs
// ============================================================================

export const jobSeekerOnboardSchema = z.object({
  name: validators.nonEmpty(255),
  email: validators.email(),
  phone: validators.phone().optional(),
  currentRole: validators.nonEmpty(255),
  desiredRole: validators.nonEmpty(255),
  skills: z.array(z.string()).min(1).max(50),
  experience: validators.nonEmpty(5000),
  location: validators.nonEmpty(255),
  resumeText: validators.nonEmpty(50000).optional(),
  careerGoals: validators.nonEmpty(2000).optional(),
  preferences: z.object({
    remotePreferred: z.boolean().optional(),
    willingToRelocate: z.boolean().optional(),
    salaryExpectation: z.number().positive().optional(),
    availabilityDate: validators.isoDate().optional()
  }).optional()
})

export const jobSeekerApplySchema = z.object({
  rfqId: z.string().min(1),
  jobSeekerId: z.string().min(1),
  coverLetter: validators.nonEmpty(10000).optional(),
  customMessage: validators.nonEmpty(2000).optional()
})

export const jobSeekerMatchSchema = z.object({
  jobSeekerId: z.string().min(1),
  category: validators.nonEmpty(100).optional(),
  limit: z.number().int().min(1).max(50).default(20)
})

export const jobSeekerProfileUpdateSchema = z.object({
  jobSeekerId: z.string().min(1),
  updates: z.object({
    currentRole: validators.nonEmpty(255).optional(),
    desiredRole: validators.nonEmpty(255).optional(),
    skills: z.array(z.string()).min(1).max(50).optional(),
    experience: validators.nonEmpty(5000).optional(),
    location: validators.nonEmpty(255).optional(),
    resumeText: validators.nonEmpty(50000).optional(),
    careerGoals: validators.nonEmpty(2000).optional(),
    preferences: z.object({
      remotePreferred: z.boolean().optional(),
      willingToRelocate: z.boolean().optional(),
      salaryExpectation: z.number().positive().optional(),
      availabilityDate: validators.isoDate().optional()
    }).optional()
  })
})

export const resumeParseSchema = z.object({
  resumeText: validators.nonEmpty(50000)
})

export type JobSeekerOnboard = z.infer<typeof jobSeekerOnboardSchema>
export type JobSeekerApply = z.infer<typeof jobSeekerApplySchema>
export type JobSeekerMatch = z.infer<typeof jobSeekerMatchSchema>
export type JobSeekerProfileUpdate = z.infer<typeof jobSeekerProfileUpdateSchema>
export type ResumeParse = z.infer<typeof resumeParseSchema>
