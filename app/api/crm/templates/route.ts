/**
 * CRM Templates API
 *
 * GET /api/crm/templates - List all templates
 * POST /api/crm/templates - Create a new template
 * PUT /api/crm/templates - Update a template
 * DELETE /api/crm/templates - Delete a template
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  validateTemplate,
  previewTemplate,
  getTemplateSuggestions,
  duplicateTemplate,
  AVAILABLE_VARIABLES
} from '@/lib/crm/templates'
import type { Template, Contact } from '@/lib/crm/types'

export const dynamic = 'force-dynamic'

// ============================================================================
// GET - List templates or get a single template
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Get available variables
    if (searchParams.get('variables') === 'true') {
      return NextResponse.json({ variables: AVAILABLE_VARIABLES })
    }

    // Get template suggestions for a channel
    const suggestChannel = searchParams.get('suggest') as Template['channel'] | null
    if (suggestChannel) {
      const suggestions = getTemplateSuggestions(suggestChannel)
      return NextResponse.json({ suggestions })
    }

    // Get a single template by ID
    const templateId = searchParams.get('id')
    if (templateId) {
      const template = await getTemplate(userId, templateId)

      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }

      // Preview if requested
      if (searchParams.get('preview') === 'true') {
        const preview = previewTemplate(template.body)
        const subjectPreview = template.subject ? previewTemplate(template.subject) : undefined

        return NextResponse.json({
          template,
          preview: {
            subject: subjectPreview,
            body: preview
          }
        })
      }

      return NextResponse.json({ template })
    }

    // List templates with filtering
    const options = {
      channel: searchParams.get('channel') as Template['channel'] | undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '50', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10)
    }

    const result = await getTemplates(userId, options)

    return NextResponse.json({
      templates: result.templates,
      total: result.total,
      limit: options.limit,
      offset: options.offset,
      hasMore: options.offset + result.templates.length < result.total
    })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Create a new template or validate/preview
// ============================================================================

interface CreateTemplateRequest {
  name: string
  channel: Template['channel']
  subject?: string
  body: string
}

interface ValidateTemplateRequest {
  action: 'validate' | 'preview'
  body: string
  subject?: string
  channel: Template['channel']
  sampleContact?: Partial<Contact>
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Handle validation/preview requests
    if (body.action === 'validate' || body.action === 'preview') {
      const validateRequest = body as ValidateTemplateRequest

      if (!validateRequest.body) {
        return NextResponse.json(
          { error: 'body is required' },
          { status: 400 }
        )
      }

      if (body.action === 'validate') {
        const result = validateTemplate(
          validateRequest.body,
          validateRequest.channel,
          validateRequest.sampleContact
        )

        // Also validate subject if provided
        let subjectValidation = undefined
        if (validateRequest.subject) {
          subjectValidation = validateTemplate(
            validateRequest.subject,
            validateRequest.channel,
            validateRequest.sampleContact
          )
        }

        return NextResponse.json({
          valid: result.valid && (!subjectValidation || subjectValidation.valid),
          body: result,
          subject: subjectValidation
        })
      }

      if (body.action === 'preview') {
        const preview = previewTemplate(validateRequest.body, validateRequest.sampleContact)
        const subjectPreview = validateRequest.subject
          ? previewTemplate(validateRequest.subject, validateRequest.sampleContact)
          : undefined

        return NextResponse.json({
          preview: {
            subject: subjectPreview,
            body: preview
          }
        })
      }
    }

    // Handle duplicate request
    if (body.action === 'duplicate' && body.templateId) {
      const newTemplate = await duplicateTemplate(userId, body.templateId, body.newName)

      if (!newTemplate) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        template: newTemplate
      })
    }

    // Create new template
    const createRequest = body as CreateTemplateRequest

    // Validate required fields
    if (!createRequest.name) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      )
    }

    if (!createRequest.channel) {
      return NextResponse.json(
        { error: 'Channel is required (email, sms, twitter, or linkedin)' },
        { status: 400 }
      )
    }

    if (!createRequest.body) {
      return NextResponse.json(
        { error: 'Template body is required' },
        { status: 400 }
      )
    }

    // Validate channel
    const validChannels = ['email', 'sms', 'twitter', 'linkedin']
    if (!validChannels.includes(createRequest.channel)) {
      return NextResponse.json(
        { error: `Invalid channel. Must be one of: ${validChannels.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate template content
    const validation = validateTemplate(createRequest.body, createRequest.channel)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Template validation failed',
          validation
        },
        { status: 400 }
      )
    }

    // Create the template
    const template = await createTemplate(userId, {
      name: createRequest.name,
      channel: createRequest.channel,
      subject: createRequest.subject,
      body: createRequest.body
    })

    return NextResponse.json({
      success: true,
      template
    })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT - Update a template
// ============================================================================

interface UpdateTemplateRequest {
  id: string
  name?: string
  channel?: Template['channel']
  subject?: string
  body?: string
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as UpdateTemplateRequest

    if (!body.id) {
      return NextResponse.json(
        { error: 'Template id is required' },
        { status: 400 }
      )
    }

    // Check template exists
    const existing = await getTemplate(userId, body.id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Validate new body if provided
    if (body.body) {
      const channel = body.channel || existing.channel
      const validation = validateTemplate(body.body, channel)
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: 'Template validation failed',
            validation
          },
          { status: 400 }
        )
      }
    }

    // Update the template
    const template = await updateTemplate(userId, body.id, {
      name: body.name,
      channel: body.channel,
      subject: body.subject,
      body: body.body
    })

    if (!template) {
      return NextResponse.json(
        { error: 'No changes provided' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      template
    })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Delete a template
// ============================================================================

interface DeleteTemplateRequest {
  id: string
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as DeleteTemplateRequest

    if (!body.id) {
      return NextResponse.json(
        { error: 'Template id is required' },
        { status: 400 }
      )
    }

    const deleted = await deleteTemplate(userId, body.id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      deleted: true
    })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
