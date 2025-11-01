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
