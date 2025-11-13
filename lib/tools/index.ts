/**
 * Wells AI Tools System
 *
 * Gives Wells the ability to take real actions:
 * - Send emails
 * - Search the web
 * - Create documents
 * - Process files
 * - Book meetings
 * - Make API calls
 */

export const WELLS_TOOLS = [
  // Email Tool
  {
    name: 'send_email',
    description: 'Send an email on behalf of the user. Use this when they ask you to send an email, contact someone, or reach out via email. Just do it - don\'t ask for permission.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        message: {
          type: 'string',
          description: 'Email body (plain text, can include links)'
        },
        toName: {
          type: 'string',
          description: 'Recipient name for personalization (optional)'
        }
      },
      required: ['to', 'subject', 'message']
    }
  },

  // Web Search Tool
  {
    name: 'web_search',
    description: 'Search the web for current information. Use this when you need up-to-date data, company info, news, pricing, or anything not in your knowledge. Don\'t make up information - search for it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (be specific)'
        },
        num_results: {
          type: 'number',
          description: 'Number of results to return (default 5, max 10)'
        }
      },
      required: ['query']
    }
  },

  // Document Creation Tool
  {
    name: 'create_document',
    description: 'Create a professional document (proposal, one-pager, brief, summary). Use this when users need a formal document created. You write it, they get a link to download.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Document title'
        },
        content: {
          type: 'string',
          description: 'Document content in Markdown format'
        },
        type: {
          type: 'string',
          enum: ['proposal', 'one_pager', 'brief', 'summary', 'report'],
          description: 'Document type for formatting'
        },
        recipient: {
          type: 'string',
          description: 'Who this document is for (optional, for personalization)'
        }
      },
      required: ['title', 'content', 'type']
    }
  },

  // Supplier Search Tool
  {
    name: 'find_suppliers',
    description: 'Search the Wells marketplace for suppliers matching specific criteria. Use this when users need to source products, services, or talent.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'What they\'re looking for (e.g., "semiconductors", "CFO talent", "office equipment")'
        },
        requirements: {
          type: 'string',
          description: 'Specific requirements, constraints, or must-haves'
        },
        urgency: {
          type: 'string',
          enum: ['immediate', 'this_week', 'this_month', 'flexible'],
          description: 'Timeline for sourcing'
        }
      },
      required: ['category', 'requirements']
    }
  },

  // Calendar/Meeting Tool
  {
    name: 'schedule_meeting',
    description: 'Schedule a meeting or calendar event. Use this when users want to book time, set up a call, or create a calendar invitation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Meeting title'
        },
        participants: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of participant email addresses'
        },
        duration_minutes: {
          type: 'number',
          description: 'Meeting duration in minutes (default 30)'
        },
        proposed_times: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of proposed times in ISO format (if scheduling, not just proposing)'
        },
        description: {
          type: 'string',
          description: 'Meeting agenda or description (optional)'
        }
      },
      required: ['title', 'participants']
    }
  },

  // GTM Campaign Tool
  {
    name: 'launch_gtm_campaign',
    description: 'Launch a go-to-market campaign for sales, hiring, partnerships, or fundraising. Use this when users want to do systematic outreach at scale.',
    input_schema: {
      type: 'object' as const,
      properties: {
        use_case: {
          type: 'string',
          enum: ['sales', 'hiring', 'job_seeking', 'partnerships', 'fundraising', 'procurement'],
          description: 'Type of campaign'
        },
        target_description: {
          type: 'string',
          description: 'Who to target (ICP description)'
        },
        value_proposition: {
          type: 'string',
          description: 'What you\'re offering and why they should care'
        },
        channels: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['email', 'linkedin', 'sms']
          },
          description: 'Outreach channels to use'
        }
      },
      required: ['use_case', 'target_description', 'value_proposition']
    }
  },

  // Analysis Tool (for processing files/documents)
  {
    name: 'analyze_document',
    description: 'Analyze a document, extract key information, or answer questions about it. Use this when users share files or ask about documents.',
    input_schema: {
      type: 'object' as const,
      properties: {
        document_content: {
          type: 'string',
          description: 'The document content to analyze (text extracted from PDF/image/file)'
        },
        analysis_type: {
          type: 'string',
          enum: ['summarize', 'extract_data', 'answer_question', 'compare'],
          description: 'Type of analysis to perform'
        },
        specific_question: {
          type: 'string',
          description: 'Specific question to answer about the document (if analysis_type is answer_question)'
        }
      },
      required: ['document_content', 'analysis_type']
    }
  },

  // Product Sourcing Tool
  {
    name: 'source_products',
    description: 'Search real-time catalogs from Etsy, eBay, Amazon, Alibaba, and other marketplaces to find products for the user. Use this when they need to buy something, source products, or find suppliers. Wells earns affiliate commission on purchases. Be proactive - if they mention needing something, source it!',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'What they\'re looking for (e.g., "branded water bottles", "custom tote bags", "office furniture")'
        },
        quantity: {
          type: 'number',
          description: 'How many units they need (optional, default 1)'
        },
        max_price: {
          type: 'number',
          description: 'Maximum price per unit in USD (optional)'
        },
        customizable: {
          type: 'boolean',
          description: 'Must be customizable/personalizable (optional)'
        },
        marketplaces: {
          type: 'array',
          items: { type: 'string', enum: ['etsy', 'ebay', 'amazon', 'alibaba', 'faire'] },
          description: 'Which marketplaces to search (optional, defaults to all)'
        }
      },
      required: ['query']
    }
  }
]

/**
 * Tool execution handlers
 */

export interface ToolExecutionContext {
  userId?: string
  userEmail?: string
  userName?: string
  baseUrl: string
}

export async function executeWellsTool(
  toolName: string,
  toolInput: any,
  context: ToolExecutionContext
): Promise<{ success: boolean; result?: any; error?: string }> {
  console.log('[TOOLS] Executing tool:', toolName, 'with input:', toolInput)

  try {
    switch (toolName) {
      case 'send_email':
        return await executeSendEmail(toolInput, context)

      case 'web_search':
        return await executeWebSearch(toolInput, context)

      case 'create_document':
        return await executeCreateDocument(toolInput, context)

      case 'find_suppliers':
        return await executeFindSuppliers(toolInput, context)

      case 'schedule_meeting':
        return await executeScheduleMeeting(toolInput, context)

      case 'launch_gtm_campaign':
        return await executeLaunchGTMCampaign(toolInput, context)

      case 'analyze_document':
        return await executeAnalyzeDocument(toolInput, context)

      case 'source_products':
        return await executeSourceProducts(toolInput, context)

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`
        }
    }
  } catch (error: any) {
    console.error('[TOOLS] Tool execution error:', error)
    return {
      success: false,
      error: error.message || 'Tool execution failed'
    }
  }
}

// Tool implementations

async function executeSendEmail(input: any, context: ToolExecutionContext) {
  const response = await fetch(`${context.baseUrl}/api/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: input.to,
      subject: input.subject,
      message: input.message,
      toName: input.toName,
      fromEmail: context.userEmail,
      fromName: context.userName
    })
  })

  const result = await response.json()
  return result
}

async function executeWebSearch(input: any, context: ToolExecutionContext) {
  // Import the web search integration
  const { searchWeb, formatSearchResults } = await import('../integrations/web-search')

  const numResults = Math.min(Math.max(input.num_results || 5, 1), 10)

  const searchResponse = await searchWeb({
    query: input.query,
    num_results: numResults
  })

  if (!searchResponse.success) {
    return {
      success: false,
      error: searchResponse.error || 'Web search failed'
    }
  }

  return {
    success: true,
    result: {
      query: input.query,
      results: searchResponse.results || [],
      total_results: searchResponse.total_results || 0,
      cached: searchResponse.cached || false,
      formatted: formatSearchResults(searchResponse.results || [], input.query)
    }
  }
}

async function executeCreateDocument(input: any, context: ToolExecutionContext) {
  const response = await fetch(`${context.baseUrl}/api/documents/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      content: input.content,
      type: input.type,
      recipient: input.recipient,
      userId: context.userId
    })
  })

  const result = await response.json()
  return result
}

async function executeFindSuppliers(input: any, context: ToolExecutionContext) {
  const response = await fetch(`${context.baseUrl}/api/suppliers/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: input.category,
      requirements: input.requirements,
      urgency: input.urgency,
      buyerId: context.userId
    })
  })

  const result = await response.json()
  return result
}

async function executeScheduleMeeting(input: any, context: ToolExecutionContext) {
  // Check if user has calendar connected
  const statusResponse = await fetch(`${context.baseUrl}/api/calendar/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const status = await statusResponse.json()

  // If calendar not connected, return instructions
  if (!status.connected) {
    return {
      success: false,
      error: 'Calendar not connected',
      result: {
        message: 'To schedule meetings, please connect your calendar first. Go to Settings > Calendar and add your Cal.com API key.',
        instruction: 'Get your Cal.com API key from https://app.cal.com/settings/developer/api-keys',
      }
    }
  }

  // If user provided proposed_times, use the first one; otherwise use current time + 1 day
  let startTime: string
  if (input.proposed_times && input.proposed_times.length > 0) {
    startTime = input.proposed_times[0]
  } else {
    // Default: tomorrow at 10am
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)
    startTime = tomorrow.toISOString()
  }

  // Schedule the meeting
  const response = await fetch(`${context.baseUrl}/api/calendar/schedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      startTime,
      durationMinutes: input.duration_minutes || 30,
      attendees: input.participants.map((email: string) => ({
        email,
        name: email.split('@')[0], // Basic name extraction
      })),
      timezone: 'America/Los_Angeles', // TODO: Get from user preferences
    }),
  })

  const result = await response.json()

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to schedule meeting',
    }
  }

  return {
    success: true,
    result: {
      message: `Meeting scheduled successfully! Calendar invite sent to ${input.participants.join(', ')}`,
      booking: {
        id: result.booking.id,
        title: result.booking.title,
        startTime: result.booking.startTime,
        endTime: result.booking.endTime,
        meetingUrl: result.booking.meetingUrl,
        attendees: result.booking.attendees,
      },
    }
  }
}

async function executeLaunchGTMCampaign(input: any, context: ToolExecutionContext) {
  const response = await fetch(`${context.baseUrl}/api/gtm/launch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      useCase: input.use_case,
      targetDescription: input.target_description,
      valueProposition: input.value_proposition,
      channels: input.channels,
      userId: context.userId
    })
  })

  const result = await response.json()
  return result
}

async function executeAnalyzeDocument(input: any, context: ToolExecutionContext) {
  // Document analysis using Claude's document understanding
  return {
    success: true,
    result: {
      analysis_type: input.analysis_type,
      content_length: input.document_content.length,
      message: 'Document analysis ready. I can read PDFs, images, and extract information from them.'
    }
  }
}

async function executeSourceProducts(input: any, context: ToolExecutionContext) {
  const response = await fetch(`${context.baseUrl}/api/sourcing/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: input.query,
      quantity: input.quantity || 1,
      budget: input.max_price ? {
        max: input.max_price,
        currency: 'USD'
      } : undefined,
      requirements: {
        customizable: input.customizable
      },
      preferredMarketplaces: input.marketplaces
    })
  })

  const result = await response.json()

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Product sourcing failed'
    }
  }

  // Format the results for conversation
  const products = result.products || []
  const topResults = products.slice(0, 5)

  return {
    success: true,
    result: {
      message: `Found ${result.totalResults} products across ${result.marketplacesSearched.length} marketplaces`,
      total_found: result.totalResults,
      marketplaces_searched: result.marketplacesSearched,
      estimated_commission: result.estimatedTotalRevenue,
      top_products: topResults.map((p: any) => ({
        title: p.title,
        price: p.formattedPrice,
        marketplace: p.marketplace,
        supplier: p.supplierName,
        customizable: p.customizable,
        link: p.affiliateUrl,
        commission_potential: p.estimatedCommission
      })),
      best_match: result.bestMatch ? {
        title: result.bestMatch.title,
        price: result.bestMatch.formattedPrice,
        marketplace: result.bestMatch.marketplace,
        link: result.bestMatch.affiliateUrl
      } : null
    }
  }
}
