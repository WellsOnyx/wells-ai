import { z } from 'zod'

/**
 * Validation schemas for API routes
 */

// Chat request schema
export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })),
  userData: z.any().optional(),
  organizationId: z.string().nullable().optional(),
})

// RFQ submission schema
export const rfqSubmissionSchema = z.object({
  category: z.string(),
  requirements: z.string(),
  organizationId: z.string().nullable().optional(),
})

// Supplier matching schema
export const supplierMatchSchema = z.object({
  category: z.string(),
  requirements: z.string(),
  organizationId: z.string().nullable().optional(),
})

// Supplier notification schema
export const supplierNotifySchema = z.object({
  supplierIds: z.array(z.string()),
  buyerName: z.string(),
  requirements: z.string(),
  category: z.string(),
  organizationId: z.string().nullable().optional(),
})

// Consent decision schema
export const consentDecideSchema = z.object({
  actionId: z.string(),
  decision: z.enum(['approve', 'reject']),
  decidedBy: z.string().optional(),
  reason: z.string().optional(),
})

// Job seeker onboarding schema
export const jobSeekerOnboardSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  yearsOfExperience: z.number().optional(),
  seniority: z.string().optional(),
  skills: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  desiredRole: z.string().optional(),
  resumeText: z.string().optional(),
})

// Job seeker profile update schema
export const jobSeekerProfileUpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  yearsOfExperience: z.number().optional(),
  seniority: z.string().optional(),
  skills: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  desiredRole: z.string().optional(),
  resumeText: z.string().optional(),
})

// Job seeker application schema
export const jobSeekerApplySchema = z.object({
  rfqId: z.string(),
  jobSeekerId: z.string(),
  coverLetter: z.string().optional(),
  customMessage: z.string().optional(),
})

// Resume parsing schema
export const resumeParseSchema = z.object({
  resumeText: z.string(),
})
