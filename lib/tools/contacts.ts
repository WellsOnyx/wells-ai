/**
 * Contact Management Tools for Wells AI
 *
 * Enables natural language contact management through the chat interface
 */

import type { ToolExecutionContext } from './index'

export const CONTACT_TOOLS = [
  // Search contacts
  {
    name: 'search_contacts',
    description: 'Search the user\'s contact database with natural language queries. Use this when they want to find contacts, prospects, or leads based on criteria like job title, company, location, or industry.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query (e.g., "VPs at tech startups in SF")'
        },
        titles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Job titles to filter by (e.g., ["VP Sales", "CTO"])'
        },
        companies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Company names to filter by'
        },
        locations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Locations to filter by (city, state, or country)'
        },
        industries: {
          type: 'array',
          items: { type: 'string' },
          description: 'Industries to filter by (e.g., ["SaaS", "FinTech"])'
        },
        targetingZone: {
          type: 'string',
          enum: ['80-90', '50-below', '100-avoid'],
          description: 'Filter by targeting score zone (80-90 is best matches)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 50, max 1000)'
        }
      },
      required: ['query']
    }
  },

  // Get contact by ID
  {
    name: 'get_contact',
    description: 'Get detailed information about a specific contact by their ID or email. Use this when the user asks for details about a specific person.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactId: {
          type: 'string',
          description: 'Contact ID to retrieve'
        },
        email: {
          type: 'string',
          description: 'Email address of the contact (alternative to contactId)'
        }
      },
      required: []
    }
  },

  // Add contact
  {
    name: 'add_contact',
    description: 'Add a new contact to the database. Use this when the user wants to manually add a contact or save someone\'s information.',
    input_schema: {
      type: 'object' as const,
      properties: {
        firstName: {
          type: 'string',
          description: 'First name (required)'
        },
        lastName: {
          type: 'string',
          description: 'Last name (required)'
        },
        email: {
          type: 'string',
          description: 'Email address'
        },
        phone: {
          type: 'string',
          description: 'Phone number'
        },
        company: {
          type: 'string',
          description: 'Company name'
        },
        title: {
          type: 'string',
          description: 'Job title'
        },
        location: {
          type: 'string',
          description: 'Location (city, state, or full address)'
        },
        linkedinUrl: {
          type: 'string',
          description: 'LinkedIn profile URL'
        },
        industry: {
          type: 'string',
          description: 'Industry'
        }
      },
      required: ['firstName', 'lastName']
    }
  },

  // Update contact
  {
    name: 'update_contact',
    description: 'Update an existing contact\'s information. Use this when the user wants to change or add details to a contact.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contactId: {
          type: 'string',
          description: 'ID of the contact to update (required)'
        },
        email: {
          type: 'string',
          description: 'New email address'
        },
        phone: {
          type: 'string',
          description: 'New phone number'
        },
        company: {
          type: 'string',
          description: 'New company name'
        },
        title: {
          type: 'string',
          description: 'New job title'
        },
        location: {
          type: 'string',
          description: 'New location'
        },
        linkedinUrl: {
          type: 'string',
          description: 'New LinkedIn URL'
        }
      },
      required: ['contactId']
    }
  },

  // Get contact stats
  {
    name: 'get_contact_stats',
    description: 'Get statistics about the user\'s contact database - total contacts, breakdown by zone, source, recent activity. Use this when they ask about their database or contact counts.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },

  // Create campaign from contacts
  {
    name: 'create_contact_campaign',
    description: 'Create a GTM campaign using selected contacts. Use this when the user wants to start outreach to a group of contacts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaignName: {
          type: 'string',
          description: 'Name for the campaign'
        },
        useCase: {
          type: 'string',
          enum: ['sales', 'hiring', 'partnerships', 'fundraising', 'job_seeking'],
          description: 'Type of campaign'
        },
        contactIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of contact IDs to include in the campaign'
        },
        searchCriteria: {
          type: 'object',
          description: 'Alternative to contactIds - use search criteria to select contacts dynamically'
        }
      },
      required: ['campaignName', 'useCase']
    }
  }
]

/**
 * Execute contact search
 */
export async function executeSearchContacts(
  input: any,
  context: ToolExecutionContext
): Promise<any> {
  const response = await fetch(`${context.baseUrl}/api/contacts/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: input.query,
      filters: {
        titles: input.titles,
        companies: input.companies,
        locations: input.locations,
        industries: input.industries,
        targetingZone: input.targetingZone
      },
      limit: input.limit || 50,
      offset: 0,
      userId: context.userId
    })
  })

  const result = await response.json()

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Contact search failed'
    }
  }

  return {
    success: true,
    result: {
      contacts: result.contacts,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
      formatted: result.formattedResponse // Pre-formatted by API
    }
  }
}

/**
 * Execute get contact by ID or email
 */
export async function executeGetContact(
  input: any,
  context: ToolExecutionContext
): Promise<any> {
  const queryParam = input.contactId
    ? `id=${input.contactId}`
    : `email=${encodeURIComponent(input.email)}`

  const response = await fetch(
    `${context.baseUrl}/api/contacts/get?${queryParam}&userId=${context.userId}`,
    { method: 'GET' }
  )

  const result = await response.json()

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Contact not found'
    }
  }

  return {
    success: true,
    result: {
      contact: result.contact,
      formatted: result.formattedResponse
    }
  }
}

/**
 * Execute add contact
 */
export async function executeAddContact(
  input: any,
  context: ToolExecutionContext
): Promise<any> {
  const response = await fetch(`${context.baseUrl}/api/contacts/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      userId: context.userId
    })
  })

  const result = await response.json()

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to add contact'
    }
  }

  return {
    success: true,
    result: {
      contact: result.contact,
      message: `✅ Added ${input.firstName} ${input.lastName} to your contacts`
    }
  }
}

/**
 * Execute update contact
 */
export async function executeUpdateContact(
  input: any,
  context: ToolExecutionContext
): Promise<any> {
  const response = await fetch(`${context.baseUrl}/api/contacts/update`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contactId: input.contactId,
      updates: {
        email: input.email,
        phone: input.phone,
        company: input.company,
        title: input.title,
        location: input.location,
        linkedinUrl: input.linkedinUrl
      },
      userId: context.userId
    })
  })

  const result = await response.json()

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to update contact'
    }
  }

  return {
    success: true,
    result: {
      contact: result.contact,
      message: `✅ Updated contact successfully`
    }
  }
}

/**
 * Execute get contact stats
 */
export async function executeGetContactStats(
  input: any,
  context: ToolExecutionContext
): Promise<any> {
  const response = await fetch(
    `${context.baseUrl}/api/contacts/stats?userId=${context.userId}`,
    { method: 'GET' }
  )

  const result = await response.json()

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to get contact stats'
    }
  }

  return {
    success: true,
    result: {
      stats: result.stats,
      formatted: result.formattedResponse
    }
  }
}

/**
 * Execute create campaign from contacts
 */
export async function executeCreateContactCampaign(
  input: any,
  context: ToolExecutionContext
): Promise<any> {
  const response = await fetch(`${context.baseUrl}/api/contacts/create-campaign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignName: input.campaignName,
      useCase: input.useCase,
      contactIds: input.contactIds,
      searchCriteria: input.searchCriteria,
      userId: context.userId
    })
  })

  const result = await response.json()

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to create campaign'
    }
  }

  return {
    success: true,
    result: {
      campaign: result.campaign,
      contactCount: result.contactCount,
      message: `🚀 Created campaign "${input.campaignName}" with ${result.contactCount} contacts`,
      nextSteps: result.nextSteps
    }
  }
}
