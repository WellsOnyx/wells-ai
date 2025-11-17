/**
 * Contact Response Formatter
 *
 * Formats contact data into conversational, readable responses for chat
 */

export interface ContactResult {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  company?: string | null
  title?: string | null
  location?: string | null
  linkedinUrl?: string | null
  targetingScore?: number | null
  targetingZone?: string | null
  industry?: string | null
  companySize?: string | null
  lastContacted?: Date | null
}

export interface SearchResults {
  contacts: ContactResult[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface ContactStats {
  total: number
  byZone: {
    '80-90': number
    '50-below': number
    '100-avoid': number
    unscored: number
  }
  bySource: {
    uploaded: number
    apollo: number
    clay: number
    manual: number
  }
  recentlyAdded: number // Last 7 days
  recentlyContacted: number // Last 7 days
}

/**
 * Format search results for conversational display
 */
export function formatSearchResults(results: SearchResults, query: string): string {
  if (results.total === 0) {
    return `I couldn't find any contacts matching "${query}". Try:\n- Broader search terms\n- Different job titles\n- Other locations or industries`
  }

  const { contacts, total, hasMore } = results

  // Build the response
  let response = `Found ${total} contact${total === 1 ? '' : 's'}`

  // Add query context
  if (query) {
    response += ` matching your search`
  }

  response += `:\n\n`

  // Group by targeting zone if available
  const byZone = groupByZone(contacts)

  if (byZone['80-90'].length > 0) {
    response += `🎯 **Best Targets (80-90% Match)** - Top priorities:\n`
    response += formatContactList(byZone['80-90'].slice(0, 5))
    response += `\n`
  }

  if (byZone['50-below'].length > 0 && byZone['80-90'].length < 5) {
    response += `📊 **Potential Targets (50% and below)**:\n`
    response += formatContactList(byZone['50-below'].slice(0, 3))
    response += `\n`
  }

  if (byZone.unscored.length > 0 && contacts.length <= 10) {
    response += `📋 **Other Contacts** (not yet scored):\n`
    response += formatContactList(byZone.unscored.slice(0, 5))
    response += `\n`
  }

  // Add pagination hint
  if (hasMore) {
    const remaining = total - contacts.length
    response += `\n_Showing first ${contacts.length} of ${total} contacts. ${remaining} more available._\n`
  }

  // Add action suggestions
  response += `\n**What's next?**\n`
  response += `- "Create a campaign with these contacts"\n`
  response += `- "Show me more details about [name]"\n`
  response += `- "Filter these by [criteria]"\n`

  return response
}

/**
 * Format a single contact for display
 */
export function formatContact(contact: ContactResult, includeDetails: boolean = true): string {
  let formatted = `**${contact.firstName} ${contact.lastName}**`

  if (contact.title && contact.company) {
    formatted += `\n${contact.title} @ ${contact.company}`
  } else if (contact.title) {
    formatted += `\n${contact.title}`
  } else if (contact.company) {
    formatted += `\n${contact.company}`
  }

  if (includeDetails) {
    const details: string[] = []

    if (contact.location) {
      details.push(`📍 ${contact.location}`)
    }

    if (contact.industry) {
      details.push(`🏢 ${contact.industry}`)
    }

    if (contact.companySize) {
      details.push(`👥 ${contact.companySize} employees`)
    }

    if (contact.targetingScore !== null && contact.targetingScore !== undefined) {
      const emoji = contact.targetingScore >= 80 ? '🎯' : contact.targetingScore >= 50 ? '📊' : '⚠️'
      details.push(`${emoji} ${contact.targetingScore}% match`)
    }

    if (details.length > 0) {
      formatted += `\n${details.join(' • ')}`
    }

    if (contact.email) {
      formatted += `\n✉️ ${contact.email}`
    }

    if (contact.linkedinUrl) {
      formatted += `\n🔗 [LinkedIn](${contact.linkedinUrl})`
    }

    if (contact.lastContacted) {
      const daysAgo = Math.floor((Date.now() - new Date(contact.lastContacted).getTime()) / (1000 * 60 * 60 * 24))
      formatted += `\n📅 Last contacted ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`
    }
  }

  return formatted
}

/**
 * Format a list of contacts (compact view)
 */
function formatContactList(contacts: ContactResult[]): string {
  return contacts.map((contact, index) => {
    const num = index + 1
    let line = `${num}. **${contact.firstName} ${contact.lastName}**`

    if (contact.title) {
      line += ` - ${contact.title}`
    }

    if (contact.company) {
      line += ` @ ${contact.company}`
    }

    if (contact.location) {
      line += ` (${contact.location})`
    }

    if (contact.targetingScore !== null && contact.targetingScore !== undefined) {
      line += ` [${contact.targetingScore}%]`
    }

    return line
  }).join('\n')
}

/**
 * Format contact stats
 */
export function formatContactStats(stats: ContactStats): string {
  let response = `📊 **Your Contact Database**\n\n`

  response += `**Total Contacts:** ${stats.total.toLocaleString()}\n\n`

  // By targeting zone
  response += `**By Targeting Zone:**\n`
  response += `- 🎯 80-90% (Best): ${stats.byZone['80-90'].toLocaleString()}\n`
  response += `- 📊 50% and below: ${stats.byZone['50-below'].toLocaleString()}\n`
  response += `- ⚠️ 100% (Avoid): ${stats.byZone['100-avoid'].toLocaleString()}\n`
  response += `- ❓ Not yet scored: ${stats.byZone.unscored.toLocaleString()}\n\n`

  // By source
  response += `**By Source:**\n`
  response += `- 📤 Uploaded: ${stats.bySource.uploaded.toLocaleString()}\n`
  response += `- 🔍 Apollo: ${stats.bySource.apollo.toLocaleString()}\n`
  response += `- 🧱 Clay: ${stats.bySource.clay.toLocaleString()}\n`
  response += `- ✍️ Manual: ${stats.bySource.manual.toLocaleString()}\n\n`

  // Recent activity
  response += `**Recent Activity (Last 7 Days):**\n`
  response += `- 📥 Added: ${stats.recentlyAdded.toLocaleString()}\n`
  response += `- 📧 Contacted: ${stats.recentlyContacted.toLocaleString()}\n\n`

  // Suggestions
  response += `**Quick Actions:**\n`
  response += `- "Show me my best targets" (80-90% zone)\n`
  response += `- "Find contacts at [company/industry]"\n`
  response += `- "Create a campaign with top targets"\n`

  return response
}

/**
 * Format upload success message
 */
export function formatUploadSuccess(
  totalRows: number,
  validRows: number,
  duplicates: number,
  errors: number
): string {
  let response = `✅ **Upload Complete!**\n\n`

  response += `- ✅ Valid contacts: ${validRows.toLocaleString()}\n`

  if (duplicates > 0) {
    response += `- ⚠️ Duplicates skipped: ${duplicates.toLocaleString()}\n`
  }

  if (errors > 0) {
    response += `- ❌ Errors: ${errors.toLocaleString()}\n`
  }

  response += `\n**Total processed:** ${totalRows.toLocaleString()} rows\n\n`

  if (validRows > 0) {
    response += `Your contacts are ready! What would you like to do?\n`
    response += `- "Show me my best targets"\n`
    response += `- "Find all VPs at tech companies"\n`
    response += `- "Create a sales campaign"\n`
  }

  return response
}

/**
 * Format campaign creation confirmation
 */
export function formatCampaignCreated(
  campaignName: string,
  contactCount: number,
  useCase: string
): string {
  let response = `🚀 **Campaign Created!**\n\n`

  response += `**Name:** ${campaignName}\n`
  response += `**Type:** ${useCase}\n`
  response += `**Contacts:** ${contactCount.toLocaleString()}\n\n`

  response += `Your campaign is ready to launch. Next steps:\n`
  response += `1. Review personalized messages\n`
  response += `2. Set sending schedule\n`
  response += `3. Launch when ready\n\n`

  response += `Want to review the messages or make changes?`

  return response
}

/**
 * Format error message
 */
export function formatError(error: string, suggestion?: string): string {
  let response = `❌ ${error}\n`

  if (suggestion) {
    response += `\n💡 **Suggestion:** ${suggestion}\n`
  }

  return response
}

/**
 * Group contacts by targeting zone
 */
function groupByZone(contacts: ContactResult[]): Record<string, ContactResult[]> {
  const grouped: Record<string, ContactResult[]> = {
    '80-90': [],
    '50-below': [],
    '100-avoid': [],
    'unscored': []
  }

  contacts.forEach(contact => {
    if (contact.targetingZone === '80-90') {
      grouped['80-90'].push(contact)
    } else if (contact.targetingZone === '50-below') {
      grouped['50-below'].push(contact)
    } else if (contact.targetingZone === '100-avoid') {
      grouped['100-avoid'].push(contact)
    } else {
      grouped.unscored.push(contact)
    }
  })

  return grouped
}

/**
 * Format pagination info
 */
export function formatPaginationHint(
  currentPage: number,
  totalPages: number,
  hasMore: boolean
): string {
  if (!hasMore) {
    return ''
  }

  return `\n_Page ${currentPage} of ${totalPages}. Say "show me more" to continue._`
}

/**
 * Suggest follow-up actions based on results
 */
export function suggestActions(results: SearchResults): string[] {
  const suggestions: string[] = []

  if (results.total === 0) {
    suggestions.push('Try a broader search')
    suggestions.push('Upload more contacts')
    suggestions.push('Use different search criteria')
  } else if (results.total > 50) {
    suggestions.push('Create a campaign with these contacts')
    suggestions.push('Filter by targeting score')
    suggestions.push('Sort by most recent')
  } else {
    suggestions.push('Create a campaign')
    suggestions.push('View individual contact details')
    suggestions.push('Export to CSV')
  }

  return suggestions
}
