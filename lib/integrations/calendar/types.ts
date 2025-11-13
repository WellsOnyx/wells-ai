/**
 * Calendar Integration Types
 *
 * Unified types for Google Calendar, Microsoft Outlook/365, and Apple Calendar integrations
 */

// ==========================================
// CORE TYPES
// ==========================================

export type CalendarProvider = 'google' | 'microsoft' | 'apple'

export type EventStatus = 'confirmed' | 'tentative' | 'cancelled'

export type AttendeeStatus = 'needsAction' | 'accepted' | 'declined' | 'tentative'

// ==========================================
// CALENDAR CONNECTION
// ==========================================

export interface CalendarConnection {
  id: string
  userId: string
  provider: CalendarProvider
  providerAccountId: string
  email: string
  displayName?: string
  accessToken: string // Encrypted in database
  refreshToken: string // Encrypted in database
  tokenExpiresAt: Date
  scope: string
  connected: boolean
  isPrimary: boolean // User's primary calendar
  createdAt: Date
  updatedAt: Date
  lastSyncAt?: Date
}

// ==========================================
// CALENDAR EVENT
// ==========================================

export interface CalendarEvent {
  id: string
  userId: string
  connectionId: string
  provider: CalendarProvider
  providerEventId: string

  // Event details
  title: string
  description?: string
  location?: string

  // Time
  startTime: Date
  endTime: Date
  timezone: string
  isAllDay: boolean

  // Attendees
  organizer: EventAttendee
  attendees: EventAttendee[]

  // Meeting details
  meetingUrl?: string
  conferenceData?: ConferenceData

  // Metadata
  status: EventStatus
  visibility: 'public' | 'private' | 'confidential'
  htmlLink?: string
  icalUid?: string
  sequence: number

  // Recurrence
  isRecurring: boolean
  recurrenceRule?: string
  recurrenceExceptions?: string[]

  // Timestamps
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

export interface EventAttendee {
  email: string
  displayName?: string
  status: AttendeeStatus
  isOrganizer?: boolean
  isOptional?: boolean
  comment?: string
}

export interface ConferenceData {
  type: 'hangoutsMeet' | 'teamsForBusiness' | 'zoom' | 'webex' | 'other'
  uri: string
  label?: string
  entryPoints?: ConferenceEntryPoint[]
  conferenceId?: string
  password?: string
}

export interface ConferenceEntryPoint {
  type: 'video' | 'phone' | 'sip'
  uri: string
  label?: string
  pin?: string
}

// ==========================================
// API REQUEST/RESPONSE TYPES
// ==========================================

export interface CreateEventRequest {
  provider?: CalendarProvider // Optional: specify provider, defaults to primary
  title: string
  description?: string
  location?: string
  startTime: string // ISO 8601
  endTime: string // ISO 8601
  timezone?: string
  isAllDay?: boolean
  attendees?: Array<{
    email: string
    displayName?: string
    isOptional?: boolean
  }>
  meetingUrl?: string
  addConference?: boolean // Auto-create video meeting
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
    interval?: number
    count?: number
    until?: string
    byWeekDay?: string[]
  }
  sendNotifications?: boolean
  visibility?: 'public' | 'private' | 'confidential'
}

export interface UpdateEventRequest {
  eventId: string
  provider: CalendarProvider
  title?: string
  description?: string
  location?: string
  startTime?: string
  endTime?: string
  timezone?: string
  attendees?: Array<{
    email: string
    displayName?: string
    isOptional?: boolean
  }>
  meetingUrl?: string
  sendNotifications?: boolean
}

export interface DeleteEventRequest {
  eventId: string
  provider: CalendarProvider
  sendNotifications?: boolean
  cancelMessage?: string
}

export interface ListEventsRequest {
  provider?: CalendarProvider
  startDate: string
  endDate: string
  maxResults?: number
  showDeleted?: boolean
  search?: string
}

export interface CheckAvailabilityRequest {
  provider?: CalendarProvider // Check specific provider or all
  startDate: string
  endDate: string
  timeMin?: string // Minimum time for each day
  timeMax?: string // Maximum time for each day
  durationMinutes?: number // Check if this duration is available
}

export interface AvailabilitySlot {
  startTime: string
  endTime: string
  provider: CalendarProvider
  isBusy: boolean
}

export interface AvailabilityResponse {
  slots: AvailabilitySlot[]
  busyPeriods: Array<{
    startTime: string
    endTime: string
    provider: CalendarProvider
    eventTitle?: string
  }>
  freePeriods: Array<{
    startTime: string
    endTime: string
    durationMinutes: number
  }>
}

// ==========================================
// OAUTH TYPES
// ==========================================

export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scope: string
  tokenType: string
}

export interface OAuthState {
  userId: string
  provider: CalendarProvider
  returnUrl?: string
  isPrimary?: boolean
  nonce: string
  createdAt: number
}

export interface OAuthConfig {
  provider: CalendarProvider
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
  authorizationUrl: string
  tokenUrl: string
}

// ==========================================
// ERROR TYPES
// ==========================================

export class CalendarError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: CalendarProvider,
    public details?: any
  ) {
    super(message)
    this.name = 'CalendarError'
  }
}

export class CalendarConnectionError extends CalendarError {
  constructor(message: string, provider: CalendarProvider, details?: any) {
    super(message, 'CONNECTION_ERROR', provider, details)
    this.name = 'CalendarConnectionError'
  }
}

export class CalendarAuthError extends CalendarError {
  constructor(message: string, provider: CalendarProvider, details?: any) {
    super(message, 'AUTH_ERROR', provider, details)
    this.name = 'CalendarAuthError'
  }
}

export class CalendarRateLimitError extends CalendarError {
  constructor(message: string, provider: CalendarProvider, retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', provider, { retryAfter })
    this.name = 'CalendarRateLimitError'
  }
}

export class CalendarNotFoundError extends CalendarError {
  constructor(message: string, provider: CalendarProvider) {
    super(message, 'NOT_FOUND', provider)
    this.name = 'CalendarNotFoundError'
  }
}

// ==========================================
// SYNC TYPES
// ==========================================

export interface SyncLog {
  id: string
  userId: string
  connectionId: string
  provider: CalendarProvider
  syncType: 'full' | 'incremental'
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  eventsAdded: number
  eventsUpdated: number
  eventsDeleted: number
  error?: string
  startedAt: Date
  completedAt?: Date
}

export interface SyncToken {
  connectionId: string
  provider: CalendarProvider
  token: string
  expiresAt?: Date
  lastUsedAt: Date
}

// ==========================================
// PROVIDER-SPECIFIC TYPES
// ==========================================

// Google Calendar specific
export interface GoogleCalendarEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  attendees?: Array<{
    email: string
    displayName?: string
    responseStatus?: 'needsAction' | 'accepted' | 'declined' | 'tentative'
    organizer?: boolean
    optional?: boolean
  }>
  conferenceData?: {
    createRequest?: {
      requestId: string
      conferenceSolutionKey: { type: string }
    }
    entryPoints?: Array<{
      entryPointType: string
      uri: string
      label?: string
      pin?: string
    }>
    conferenceSolution?: {
      name: string
      iconUri?: string
    }
    conferenceId?: string
  }
  status?: 'confirmed' | 'tentative' | 'cancelled'
  visibility?: 'default' | 'public' | 'private' | 'confidential'
  htmlLink?: string
  iCalUID?: string
  sequence?: number
  recurrence?: string[]
  created?: string
  updated?: string
}

// Microsoft Graph Calendar specific
export interface MicrosoftCalendarEvent {
  id: string
  subject: string
  bodyPreview?: string
  body?: {
    contentType: 'text' | 'html'
    content: string
  }
  location?: {
    displayName?: string
    address?: any
  }
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  attendees?: Array<{
    emailAddress: {
      address: string
      name?: string
    }
    status: {
      response: 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined' | 'notResponded'
      time: string
    }
    type: 'required' | 'optional' | 'resource'
  }>
  onlineMeeting?: {
    joinUrl: string
    conferenceId?: string
    tollNumber?: string
  }
  isOnlineMeeting?: boolean
  onlineMeetingProvider?: 'teamsForBusiness' | 'skypeForBusiness' | 'skypeForConsumer'
  status?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown'
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown'
  isCancelled?: boolean
  isOrganizer?: boolean
  webLink?: string
  iCalUId?: string
  recurrence?: any
  createdDateTime?: string
  lastModifiedDateTime?: string
}

// Apple Calendar (CalDAV) specific
export interface AppleCalendarEvent {
  uid: string
  summary: string
  description?: string
  location?: string
  dtstart: string
  dtend: string
  timezone?: string
  attendees?: Array<{
    email: string
    name?: string
    partstat?: 'NEEDS-ACTION' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE'
    role?: 'REQ-PARTICIPANT' | 'OPT-PARTICIPANT' | 'CHAIR'
  }>
  organizer?: {
    email: string
    name?: string
  }
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
  class?: 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL'
  url?: string
  rrule?: string
  exdate?: string[]
  created?: string
  'last-modified'?: string
  sequence?: number
}
