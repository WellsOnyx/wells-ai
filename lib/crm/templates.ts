/**
 * CRM Template Management
 *
 * Handles message template CRUD, variable substitution, and validation
 */

import { query } from '../db'
import type { Template, Contact } from './types'

// ============================================================================
// Template CRUD Operations
// ============================================================================

/**
 * Create a new template
 */
export async function createTemplate(
  userId: string,
  data: {
    name: string
    channel: Template['channel']
    subject?: string
    body: string
  }
): Promise<Template> {
  // Extract variables from template
  const variables = extractVariables(data.body)
  if (data.subject) {
    variables.push(...extractVariables(data.subject))
  }
  const uniqueVariables = [...new Set(variables)]

  const result = await query<Template>(
    `INSERT INTO crm_templates (user_id, name, channel, subject, body, variables)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      userId,
      data.name,
      data.channel,
      data.subject || null,
      data.body,
      uniqueVariables
    ]
  )

  return result.rows[0]
}

/**
 * Update an existing template
 */
export async function updateTemplate(
  userId: string,
  templateId: string,
  data: Partial<{
    name: string
    channel: Template['channel']
    subject: string
    body: string
  }>
): Promise<Template | null> {
  const updates: string[] = []
  const params: any[] = []
  let paramIndex = 1

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex}`)
    params.push(data.name)
    paramIndex++
  }

  if (data.channel !== undefined) {
    updates.push(`channel = $${paramIndex}`)
    params.push(data.channel)
    paramIndex++
  }

  if (data.subject !== undefined) {
    updates.push(`subject = $${paramIndex}`)
    params.push(data.subject)
    paramIndex++
  }

  if (data.body !== undefined) {
    updates.push(`body = $${paramIndex}`)
    params.push(data.body)
    paramIndex++

    // Update variables based on new content
    const variables = extractVariables(data.body)
    if (data.subject) {
      variables.push(...extractVariables(data.subject))
    }
    const uniqueVariables = [...new Set(variables)]
    updates.push(`variables = $${paramIndex}`)
    params.push(uniqueVariables)
    paramIndex++
  }

  if (updates.length === 0) return null

  params.push(templateId, userId)

  const result = await query<Template>(
    `UPDATE crm_templates
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
    RETURNING *`,
    params
  )

  return result.rows[0] || null
}

/**
 * Delete a template
 */
export async function deleteTemplate(
  userId: string,
  templateId: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM crm_templates WHERE id = $1 AND user_id = $2`,
    [templateId, userId]
  )

  return result.rowCount > 0
}

/**
 * Get all templates for a user
 */
export async function getTemplates(
  userId: string,
  options: {
    channel?: Template['channel']
    search?: string
    limit?: number
    offset?: number
  } = {}
): Promise<{ templates: Template[]; total: number }> {
  const { channel, search, limit = 50, offset = 0 } = options

  let whereClause = 'WHERE user_id = $1'
  const params: any[] = [userId]
  let paramIndex = 2

  if (channel) {
    whereClause += ` AND channel = $${paramIndex}`
    params.push(channel)
    paramIndex++
  }

  if (search) {
    whereClause += ` AND (name ILIKE $${paramIndex} OR body ILIKE $${paramIndex})`
    params.push(`%${search}%`)
    paramIndex++
  }

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM crm_templates ${whereClause}`,
    params
  )
  const total = parseInt(countResult.rows[0]?.count || '0', 10)

  // Get templates
  const result = await query<Template>(
    `SELECT * FROM crm_templates
    ${whereClause}
    ORDER BY updated_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  )

  return {
    templates: result.rows,
    total
  }
}

/**
 * Get a single template by ID
 */
export async function getTemplate(
  userId: string,
  templateId: string
): Promise<Template | null> {
  const result = await query<Template>(
    `SELECT * FROM crm_templates WHERE id = $1 AND user_id = $2`,
    [templateId, userId]
  )

  return result.rows[0] || null
}

// ============================================================================
// Template Rendering
// ============================================================================

/**
 * Available template variables
 */
export const AVAILABLE_VARIABLES = {
  first_name: 'Contact first name',
  last_name: 'Contact last name',
  full_name: 'Contact full name',
  email: 'Contact email address',
  phone: 'Contact phone number',
  company: 'Contact company name',
  title: 'Contact job title',
  twitter_handle: 'Contact Twitter handle',
  linkedin_url: 'Contact LinkedIn URL',
  // Date/time variables
  today: 'Current date',
  current_year: 'Current year',
  // Sender variables
  sender_name: 'Sender name',
  sender_company: 'Sender company',
  sender_email: 'Sender email',
  sender_phone: 'Sender phone'
}

/**
 * Extract variable names from a template string
 */
export function extractVariables(template: string): string[] {
  const regex = /\{\{(\w+)\}\}/g
  const variables: string[] = []
  let match

  while ((match = regex.exec(template)) !== null) {
    variables.push(match[1])
  }

  return variables
}

/**
 * Render a template with contact data
 */
export function renderTemplate(
  template: string,
  contact: Contact,
  additionalVars: Record<string, string> = {}
): string {
  const now = new Date()

  const variables: Record<string, string> = {
    // Contact variables
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    full_name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
    email: contact.email || '',
    phone: contact.phone || '',
    company: contact.company || '',
    title: contact.title || '',
    twitter_handle: contact.twitter_handle ? `@${contact.twitter_handle.replace('@', '')}` : '',
    linkedin_url: contact.linkedin_url || '',

    // Date/time variables
    today: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    current_year: now.getFullYear().toString(),

    // Additional variables (sender info, custom, etc.)
    ...additionalVars
  }

  // Add custom fields from contact
  if (contact.custom_fields) {
    for (const [key, value] of Object.entries(contact.custom_fields)) {
      variables[key] = String(value)
    }
  }

  // Replace all {{variable}} patterns
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] ?? match
  })
}

/**
 * Render a full template object (subject + body)
 */
export function renderFullTemplate(
  template: Template,
  contact: Contact,
  additionalVars: Record<string, string> = {}
): { subject?: string; body: string } {
  return {
    subject: template.subject ? renderTemplate(template.subject, contact, additionalVars) : undefined,
    body: renderTemplate(template.body, contact, additionalVars)
  }
}

// ============================================================================
// Template Validation
// ============================================================================

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  missingVariables: string[]
  unknownVariables: string[]
}

/**
 * Validate a template
 */
export function validateTemplate(
  template: string,
  channel: Template['channel'],
  sampleContact?: Partial<Contact>
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    missingVariables: [],
    unknownVariables: []
  }

  // Extract variables
  const variables = extractVariables(template)

  // Check for unknown variables
  const knownVariables = new Set(Object.keys(AVAILABLE_VARIABLES))
  for (const varName of variables) {
    if (!knownVariables.has(varName)) {
      // Check if it might be a custom field
      if (!varName.startsWith('custom_')) {
        result.unknownVariables.push(varName)
        result.warnings.push(`Unknown variable: {{${varName}}}. Consider using a known variable or a custom field.`)
      }
    }
  }

  // Channel-specific validation
  switch (channel) {
    case 'sms':
      // SMS has a 160 character limit (or 1600 for concatenated)
      if (template.length > 1600) {
        result.errors.push('SMS content exceeds maximum length of 1600 characters')
        result.valid = false
      } else if (template.length > 160) {
        result.warnings.push('SMS content exceeds 160 characters and will be sent as multiple messages')
      }
      break

    case 'twitter':
      // Twitter DMs have a 10,000 character limit
      if (template.length > 10000) {
        result.errors.push('Twitter DM content exceeds maximum length of 10,000 characters')
        result.valid = false
      }
      break

    case 'linkedin':
      // LinkedIn InMail has a 1,900 character limit
      if (template.length > 1900) {
        result.errors.push('LinkedIn message content exceeds maximum length of 1,900 characters')
        result.valid = false
      }
      break

    case 'email':
      // Email should have some content
      if (template.trim().length < 10) {
        result.warnings.push('Email content is very short')
      }
      break
  }

  // Check if sample contact would satisfy required variables
  if (sampleContact) {
    const requiredFields: Record<string, keyof Contact> = {
      first_name: 'first_name',
      last_name: 'last_name',
      email: 'email',
      phone: 'phone',
      company: 'company',
      title: 'title',
      twitter_handle: 'twitter_handle',
      linkedin_url: 'linkedin_url'
    }

    for (const varName of variables) {
      const contactField = requiredFields[varName]
      if (contactField && !sampleContact[contactField]) {
        result.missingVariables.push(varName)
        result.warnings.push(`Variable {{${varName}}} may be empty for some contacts`)
      }
    }
  }

  // Check for empty template
  if (template.trim().length === 0) {
    result.errors.push('Template content cannot be empty')
    result.valid = false
  }

  return result
}

/**
 * Preview a template with sample contact data
 */
export function previewTemplate(
  template: string,
  sampleContact?: Partial<Contact>
): string {
  const defaultContact: Partial<Contact> = {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone: '+15551234567',
    company: 'Acme Corp',
    title: 'CEO',
    twitter_handle: 'johndoe',
    linkedin_url: 'https://linkedin.com/in/johndoe',
    custom_fields: {}
  }

  const contact = { ...defaultContact, ...sampleContact } as Contact

  return renderTemplate(template, contact, {
    sender_name: 'Wells AI',
    sender_company: 'Wells Onyx',
    sender_email: 'outreach@wellsonyx.io',
    sender_phone: '+15559876543'
  })
}

// ============================================================================
// Template Helpers
// ============================================================================

/**
 * Get template suggestions based on channel
 */
export function getTemplateSuggestions(channel: Template['channel']): {
  name: string
  subject?: string
  body: string
}[] {
  switch (channel) {
    case 'email':
      return [
        {
          name: 'Initial Outreach',
          subject: 'Quick question for {{first_name}}',
          body: `Hi {{first_name}},

I noticed {{company}} is doing great work in your industry. I'd love to learn more about your current challenges and see if there might be a fit for us to work together.

Would you be open to a brief call this week?

Best,
{{sender_name}}`
        },
        {
          name: 'Follow Up',
          subject: 'Following up - {{company}}',
          body: `Hi {{first_name}},

I wanted to follow up on my previous message. I understand you're busy, but I believe there could be a valuable opportunity for {{company}}.

Let me know if you'd prefer I reach out at a different time.

Best,
{{sender_name}}`
        },
        {
          name: 'Meeting Request',
          subject: 'Meeting request from {{sender_company}}',
          body: `Hi {{first_name}},

I'm reaching out because I think {{sender_company}} could help {{company}} achieve its goals.

Would you be available for a 15-minute call next week?

Best regards,
{{sender_name}}
{{sender_company}}`
        }
      ]

    case 'sms':
      return [
        {
          name: 'Quick Check-in',
          body: 'Hi {{first_name}}, this is {{sender_name}} from {{sender_company}}. I sent you an email - did you have a chance to look at it? Reply STOP to opt out.'
        },
        {
          name: 'Meeting Reminder',
          body: 'Hi {{first_name}}! Just a reminder about our call today. Looking forward to speaking with you. - {{sender_name}}'
        }
      ]

    case 'twitter':
      return [
        {
          name: 'Introduction',
          body: `Hey {{first_name}}! I've been following {{company}}'s work and I'm impressed. Would love to connect and chat about potential collaboration opportunities.`
        }
      ]

    case 'linkedin':
      return [
        {
          name: 'Connection Request Follow-up',
          body: `Hi {{first_name}},

Thanks for connecting! I noticed your work at {{company}} and thought we might have some synergies to explore.

Would you be open to a brief conversation?

Best,
{{sender_name}}`
        }
      ]

    default:
      return []
  }
}

/**
 * Duplicate a template
 */
export async function duplicateTemplate(
  userId: string,
  templateId: string,
  newName?: string
): Promise<Template | null> {
  const template = await getTemplate(userId, templateId)

  if (!template) {
    return null
  }

  return createTemplate(userId, {
    name: newName || `${template.name} (Copy)`,
    channel: template.channel,
    subject: template.subject,
    body: template.body
  })
}
