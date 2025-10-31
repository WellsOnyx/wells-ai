/**
 * GTM Adapter Framework - Base Interfaces
 *
 * Wells AI Intelligence Layer works with ANY user stack:
 * - Microsoft (Dynamics, Outlook)
 * - Google (Gmail, Calendar)
 * - Salesforce
 * - HubSpot
 * - Or nothing (we provision)
 *
 * Same Wells Onyx playbook, different execution pipes.
 */

// ===== BASE TYPES =====

export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  company?: string
  title?: string
  linkedInUrl?: string
  twitterHandle?: string
  customFields?: Record<string, any>
}

export interface Deal {
  id: string
  title: string
  value: number
  stage: string
  contactId: string
  closedAt?: Date
  wonLost?: 'won' | 'lost'
  customFields?: Record<string, any>
}

export interface Activity {
  id: string
  type: 'email' | 'call' | 'meeting' | 'linkedin' | 'note'
  contactId: string
  dealId?: string
  subject?: string
  body?: string
  timestamp: Date
  outcome?: string
}

export interface EmailMessage {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  html?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
  }>
}

export interface CalendarEvent {
  id?: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  attendees: string[]
  location?: string
  meetingLink?: string
}

export interface EnrichmentData {
  email?: string
  phone?: string
  company?: {
    name: string
    domain: string
    industry: string
    size: number
    revenue?: number
  }
  social?: {
    linkedin?: string
    twitter?: string
  }
  jobHistory?: Array<{
    company: string
    title: string
    startDate: string
    endDate?: string
  }>
}

// ===== CRM ADAPTER =====

export interface CRMAdapter {
  name: string
  type: 'dynamics' | 'salesforce' | 'hubspot' | 'notion' | 'custom'

  // Contacts
  getContact(id: string): Promise<Contact>
  searchContacts(query: string): Promise<Contact[]>
  createContact(contact: Omit<Contact, 'id'>): Promise<Contact>
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact>

  // Deals
  getDeal(id: string): Promise<Deal>
  getDeals(filters?: { stage?: string; wonLost?: 'won' | 'lost' }): Promise<Deal[]>
  createDeal(deal: Omit<Deal, 'id'>): Promise<Deal>
  updateDeal(id: string, updates: Partial<Deal>): Promise<Deal>

  // Activities
  getActivities(contactId: string): Promise<Activity[]>
  logActivity(activity: Omit<Activity, 'id'>): Promise<Activity>

  // ICP Analysis (learn from past wins)
  analyzeWonDeals(): Promise<{
    avgDealSize: number
    topIndustries: string[]
    topTitles: string[]
    avgSalesCycle: number
    winRate: number
  }>
}

// ===== EMAIL ADAPTER =====

export interface EmailAdapter {
  name: string
  type: 'outlook' | 'gmail' | 'instantly' | 'custom'

  // Send email
  send(message: EmailMessage): Promise<{ id: string; sent: boolean }>

  // Send bulk (campaign)
  sendBulk(messages: EmailMessage[]): Promise<{ sent: number; failed: number }>

  // Get inbox (for response tracking)
  getInbox(filters?: { since?: Date; from?: string }): Promise<Array<{
    id: string
    from: string
    subject: string
    body: string
    receivedAt: Date
  }>>

  // Track opens/clicks (if supported)
  getTracking?(emailId: string): Promise<{
    opened: boolean
    openedAt?: Date
    clicked: boolean
    clickedAt?: Date
  }>
}

// ===== CALENDAR ADAPTER =====

export interface CalendarAdapter {
  name: string
  type: 'outlook' | 'google' | 'calcom' | 'custom'

  // Get availability
  getAvailability(startDate: Date, endDate: Date): Promise<Array<{
    start: Date
    end: Date
  }>>

  // Create meeting
  createEvent(event: CalendarEvent): Promise<CalendarEvent & { id: string }>

  // Update meeting
  updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent>

  // Cancel meeting
  cancelEvent(id: string): Promise<{ cancelled: boolean }>

  // Get booking link (if calendar supports it)
  getBookingLink?(): Promise<string>
}

// ===== ENRICHMENT ADAPTER =====

export interface EnrichmentAdapter {
  name: string
  type: 'zoominfo' | 'clearbit' | 'apollo' | 'custom'

  // Enrich by email
  enrichByEmail(email: string): Promise<EnrichmentData>

  // Enrich by domain
  enrichByDomain(domain: string): Promise<{
    company: EnrichmentData['company']
    employees?: Array<{
      name: string
      email?: string
      title: string
      linkedin?: string
    }>
  }>

  // Find similar companies
  findSimilarCompanies(domain: string, limit?: number): Promise<string[]>
}

// ===== PROSPECTING ADAPTER =====

export interface ProspectingAdapter {
  name: string
  type: 'apollo' | 'linkedin' | 'hunter' | 'custom'

  // Search for prospects
  search(filters: {
    titles?: string[]
    industries?: string[]
    companySize?: { min?: number; max?: number }
    location?: string
    keywords?: string[]
  }): Promise<Array<{
    name: string
    email?: string
    title: string
    company: string
    linkedInUrl?: string
  }>>

  // Get contact details
  getContactDetails(linkedInUrl: string): Promise<{
    email?: string
    phone?: string
    verified: boolean
  }>
}

// ===== LINKEDIN ADAPTER =====

export interface LinkedInAdapter {
  name: string
  type: 'sales-navigator' | 'basic' | 'phantombuster' | 'custom'

  // Search Sales Navigator
  search?(filters: {
    title?: string
    company?: string
    industry?: string
    seniority?: string
  }): Promise<Array<{
    name: string
    title: string
    company: string
    profileUrl: string
  }>>

  // Send connection request
  connect(profileUrl: string, message?: string): Promise<{ sent: boolean }>

  // Send message (if connected)
  sendMessage(profileUrl: string, message: string): Promise<{ sent: boolean }>

  // Get profile data
  getProfile(profileUrl: string): Promise<{
    name: string
    title: string
    company: string
    location: string
    about?: string
    experience: Array<{
      title: string
      company: string
      duration: string
    }>
  }>
}

// ===== USER STACK CONFIGURATION =====

export interface UserStack {
  userId: string

  // Existing tools (what user already has)
  existing: {
    crm?: CRMAdapter
    email?: EmailAdapter
    calendar?: CalendarAdapter
    enrichment?: EnrichmentAdapter
    prospecting?: ProspectingAdapter
    linkedin?: LinkedInAdapter
  }

  // Provisioned tools (what Wells AI adds)
  provisioned: {
    crm?: CRMAdapter
    email?: EmailAdapter
    calendar?: CalendarAdapter
    enrichment?: EnrichmentAdapter
    prospecting?: ProspectingAdapter
    linkedin?: LinkedInAdapter
  }

  // Credentials (encrypted in Clerk metadata)
  credentials: {
    [key: string]: {
      accessToken?: string
      refreshToken?: string
      apiKey?: string
      domain?: string
    }
  }
}

/**
 * Get effective adapter (existing or provisioned)
 */
export function getAdapter<T>(
  stack: UserStack,
  type: keyof UserStack['existing']
): T | null {
  return (stack.existing[type] || stack.provisioned[type]) as T | null
}

/**
 * Check if user has a specific tool type
 */
export function hasAdapter(
  stack: UserStack,
  type: keyof UserStack['existing']
): boolean {
  return !!(stack.existing[type] || stack.provisioned[type])
}

export default {
  getAdapter,
  hasAdapter,
}
