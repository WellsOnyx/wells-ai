/**
 * Global Input Validation Layer
 *
 * Provides Zod-based schema validation for all API routes with:
 * - Consistent error responses (400 + VALIDATION_FAILED)
 * - Automatic audit logging of validation failures
 * - PII redaction before logging
 * - Type-safe request handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError, ZodSchema } from 'zod'
import { writeAuditAction } from './audit-ledger'

// ============================================================================
// PII DETECTION & REDACTION
// ============================================================================

/**
 * Fields that contain PII and should be redacted in logs
 */
const PII_FIELDS = new Set([
  'email',
  'phone',
  'phoneNumber',
  'ssn',
  'taxId',
  'dateOfBirth',
  'dob',
  'address',
  'street',
  'city',
  'zipCode',
  'postalCode',
  'creditCard',
  'cardNumber',
  'cvv',
  'password',
  'token',
  'apiKey',
  'secret',
  'accessToken',
  'refreshToken'
])

/**
 * Redact PII fields from an object before logging
 */
export function redactPII(data: any): any {
  if (!data || typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(redactPII)
  }

  const redacted: any = {}
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()

    // Check if this field contains PII
    const isPII = PII_FIELDS.has(lowerKey) ||
                  lowerKey.includes('password') ||
                  lowerKey.includes('secret') ||
                  lowerKey.includes('token')

    if (isPII && typeof value === 'string') {
      // Redact but preserve structure (show first 2 chars + length)
      redacted[key] = value.length > 2
        ? `${value.substring(0, 2)}${'*'.repeat(Math.min(value.length - 2, 8))}`
        : '***'
    } else if (typeof value === 'object') {
      redacted[key] = redactPII(value)
    } else {
      redacted[key] = value
    }
  }

  return redacted
}

// ============================================================================
// VALIDATION ERROR HANDLING
// ============================================================================

export interface ValidationError {
  errorCode: 'VALIDATION_FAILED'
  message: string
  errors: Array<{
    path: string[]
    message: string
    code: string
  }>
}

/**
 * Format Zod errors into a consistent structure
 */
function formatValidationErrors(error: ZodError): ValidationError {
  return {
    errorCode: 'VALIDATION_FAILED',
    message: 'Request validation failed',
    errors: error.errors.map(err => ({
      path: err.path.map(String),
      message: err.message,
      code: err.code
    }))
  }
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

export interface ValidatedRequest<T> extends NextRequest {
  validatedBody: T
}

export type ValidatedHandler<T, R = any> = (
  request: ValidatedRequest<T>
) => Promise<NextResponse<R>>

/**
 * Validate request body against a Zod schema
 *
 * Usage:
 * ```ts
 * export const POST = withValidation(
 *   z.object({ email: z.string().email() }),
 *   async (req) => {
 *     const { email } = req.validatedBody // Fully typed!
 *     // ... handle request
 *   }
 * )
 * ```
 */
export function withValidation<T extends ZodSchema>(
  schema: T,
  handler: ValidatedHandler<z.infer<T>>
) {
  return async (request: NextRequest) => {
    try {
      // Parse request body
      let body: any
      try {
        body = await request.json()
      } catch (e) {
        const error: ValidationError = {
          errorCode: 'VALIDATION_FAILED',
          message: 'Invalid JSON in request body',
          errors: [{
            path: ['body'],
            message: 'Failed to parse JSON',
            code: 'invalid_json'
          }]
        }

        // Log to audit (best effort - don't fail if audit logging fails)
        try {
          await writeAuditAction({
            actionId: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            actionType: 'validation',
            title: 'Validation Failed: Invalid JSON',
            description: 'Failed to parse JSON in request body',
            decision: 'error',
            decidedBy: 'system',
            metadata: {
              error: 'invalid_json',
              path: request.url
            }
          })
        } catch (auditError) {
          console.warn('[VALIDATION] Failed to write audit log:', auditError)
        }

        return NextResponse.json(error, { status: 400 })
      }

      // Validate against schema
      const result = schema.safeParse(body)

      if (!result.success) {
        const validationError = formatValidationErrors(result.error)

        // Log validation failure with redacted data (best effort)
        try {
          await writeAuditAction({
            actionId: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            actionType: 'validation',
            title: 'Validation Failed: Schema Mismatch',
            description: validationError.message,
            decision: 'error',
            decidedBy: 'system',
            metadata: {
              errors: validationError.errors,
              requestBody: redactPII(body),
              path: request.url,
              method: request.method
            }
          })
        } catch (auditError) {
          console.warn('[VALIDATION] Failed to write audit log:', auditError)
        }

        return NextResponse.json(validationError, { status: 400 })
      }

      // Attach validated data to request
      const validatedRequest = request as ValidatedRequest<z.infer<T>>
      validatedRequest.validatedBody = result.data

      // Call handler with validated request
      return await handler(validatedRequest)

    } catch (error: any) {
      // Log unexpected errors (best effort)
      try {
        await writeAuditAction({
          actionId: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          actionType: 'validation',
          title: 'Validation Error: Unexpected',
          description: error.message || 'An unexpected error occurred during validation',
          decision: 'error',
          decidedBy: 'system',
          metadata: {
            error: error.message,
            stack: error.stack,
            path: request.url
          }
        })
      } catch (auditError) {
        console.warn('[VALIDATION] Failed to write audit log:', auditError)
      }

      return NextResponse.json({
        errorCode: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during validation'
      }, { status: 500 })
    }
  }
}

// ============================================================================
// QUERY PARAMETER VALIDATION
// ============================================================================

/**
 * Validate URL query parameters
 */
export function withQueryValidation<T extends ZodSchema>(
  schema: T,
  handler: (params: z.infer<T>, request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url)
      const params = Object.fromEntries(searchParams.entries())

      const result = schema.safeParse(params)

      if (!result.success) {
        const validationError = formatValidationErrors(result.error)

        try {
          await writeAuditAction({
            actionId: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            actionType: 'validation',
            title: 'Query Validation Failed',
            description: validationError.message,
            decision: 'error',
            decidedBy: 'system',
            metadata: {
              errors: validationError.errors,
              params: redactPII(params),
              path: request.url
            }
          })
        } catch (auditError) {
          console.warn('[VALIDATION] Failed to write audit log:', auditError)
        }

        return NextResponse.json(validationError, { status: 400 })
      }

      return await handler(result.data, request)

    } catch (error: any) {
      try {
        await writeAuditAction({
          actionId: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          actionType: 'validation',
          title: 'Query Validation Error: Unexpected',
          description: error.message || 'An unexpected error occurred during query validation',
          decision: 'error',
          decidedBy: 'system',
          metadata: {
            error: error.message,
            path: request.url
          }
        })
      } catch (auditError) {
        console.warn('[VALIDATION] Failed to write audit log:', auditError)
      }

      return NextResponse.json({
        errorCode: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during query validation'
      }, { status: 500 })
    }
  }
}

// ============================================================================
// COMMON VALIDATORS & REFINEMENTS
// ============================================================================

/**
 * Common validation helpers
 */
export const validators = {
  /** Email with maxLength */
  email: () => z.string().email().max(255),

  /** Phone number (basic format) */
  phone: () => z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),

  /** URL with maxLength */
  url: () => z.string().url().max(2048),

  /** Non-empty string with maxLength */
  nonEmpty: (max: number = 1000) => z.string().min(1).max(max),

  /** Positive integer */
  positiveInt: () => z.number().int().positive(),

  /** UUID */
  uuid: () => z.string().uuid(),

  /** ISO date string */
  isoDate: () => z.string().datetime(),

  /** Enum with custom error */
  enum: <T extends readonly [string, ...string[]]>(values: T, name: string) =>
    z.enum(values, {
      errorMap: () => ({ message: `Must be one of: ${values.join(', ')}` })
    }),

  /** Optional with null coercion */
  nullable: <T extends ZodSchema>(schema: T) =>
    z.union([schema, z.null(), z.undefined()]).optional()
}
