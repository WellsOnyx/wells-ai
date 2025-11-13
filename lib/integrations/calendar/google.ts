/**
 * Google Calendar Integration
 *
 * Implements Google Calendar API v3
 * API Reference: https://developers.google.com/calendar/api/v3/reference
 */

import {
  CalendarEvent,
  CalendarProvider,
  CreateEventRequest,
  UpdateEventRequest,
  GoogleCalendarEvent,
  CalendarError,
  CalendarRateLimitError,
  CalendarNotFoundError,
  AvailabilitySlot
} from './types'

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3'
const DEFAULT_CALENDAR_ID = 'primary'

// ==========================================
// GOOGLE CALENDAR CLIENT
// ==========================================

export class GoogleCalendarClient {
  constructor(private accessToken: string) {}

  /**
   * Make authenticated request to Google Calendar API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${GOOGLE_API_BASE}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      }
    })

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
      throw new CalendarRateLimitError(
        'Google Calendar API rate limit exceeded',
        'google',
        retryAfter
      )
    }

    // Handle not found
    if (response.status === 404) {
      throw new CalendarNotFoundError('Calendar or event not found', 'google')
    }

    // Handle other errors
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: { message: response.statusText }
      }))
      throw new CalendarError(
        `Google Calendar API error: ${error.error?.message || response.statusText}`,
        'GOOGLE_API_ERROR',
        'google',
        error
      )
    }

    return response.json()
  }

  // ==========================================
  // EVENT OPERATIONS
  // ==========================================

  /**
   * Create a calendar event
   */
  async createEvent(
    request: CreateEventRequest,
    calendarId: string = DEFAULT_CALENDAR_ID
  ): Promise<GoogleCalendarEvent> {
    const event = this.buildGoogleEvent(request)

    // Add conference if requested
    if (request.addConference) {
      event.conferenceData = {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    }

    const params = new URLSearchParams()
    if (request.addConference) {
      params.set('conferenceDataVersion', '1')
    }
    if (request.sendNotifications) {
      params.set('sendUpdates', 'all')
    }

    const queryString = params.toString()
    const endpoint = `/calendars/${calendarId}/events${queryString ? `?${queryString}` : ''}`

    return this.request<GoogleCalendarEvent>(endpoint, {
      method: 'POST',
      body: JSON.stringify(event)
    })
  }

  /**
   * Get event by ID
   */
  async getEvent(
    eventId: string,
    calendarId: string = DEFAULT_CALENDAR_ID
  ): Promise<GoogleCalendarEvent> {
    return this.request<GoogleCalendarEvent>(
      `/calendars/${calendarId}/events/${eventId}`
    )
  }

  /**
   * Update calendar event
   */
  async updateEvent(
    eventId: string,
    request: UpdateEventRequest,
    calendarId: string = DEFAULT_CALENDAR_ID
  ): Promise<GoogleCalendarEvent> {
    // Get existing event first
    const existingEvent = await this.getEvent(eventId, calendarId)

    // Merge updates
    const updatedEvent = {
      ...existingEvent,
      ...this.buildGoogleEvent(request as CreateEventRequest)
    }

    const params = new URLSearchParams()
    if (request.sendNotifications) {
      params.set('sendUpdates', 'all')
    }

    const queryString = params.toString()
    const endpoint = `/calendars/${calendarId}/events/${eventId}${queryString ? `?${queryString}` : ''}`

    return this.request<GoogleCalendarEvent>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(updatedEvent)
    })
  }

  /**
   * Delete calendar event
   */
  async deleteEvent(
    eventId: string,
    sendNotifications: boolean = false,
    calendarId: string = DEFAULT_CALENDAR_ID
  ): Promise<void> {
    const params = new URLSearchParams()
    if (sendNotifications) {
      params.set('sendUpdates', 'all')
    }

    const queryString = params.toString()
    const endpoint = `/calendars/${calendarId}/events/${eventId}${queryString ? `?${queryString}` : ''}`

    await this.request<void>(endpoint, {
      method: 'DELETE'
    })
  }

  /**
   * List calendar events
   */
  async listEvents(
    startDate: string,
    endDate: string,
    options: {
      maxResults?: number
      showDeleted?: boolean
      search?: string
      calendarId?: string
    } = {}
  ): Promise<GoogleCalendarEvent[]> {
    const calendarId = options.calendarId || DEFAULT_CALENDAR_ID
    const params = new URLSearchParams({
      timeMin: startDate,
      timeMax: endDate,
      singleEvents: 'true',
      orderBy: 'startTime'
    })

    if (options.maxResults) {
      params.set('maxResults', options.maxResults.toString())
    }
    if (options.showDeleted) {
      params.set('showDeleted', 'true')
    }
    if (options.search) {
      params.set('q', options.search)
    }

    const response = await this.request<{ items: GoogleCalendarEvent[] }>(
      `/calendars/${calendarId}/events?${params.toString()}`
    )

    return response.items || []
  }

  // ==========================================
  // AVAILABILITY
  // ==========================================

  /**
   * Check free/busy availability
   */
  async checkAvailability(
    startDate: string,
    endDate: string,
    calendarIds: string[] = [DEFAULT_CALENDAR_ID]
  ): Promise<AvailabilitySlot[]> {
    const request = {
      timeMin: startDate,
      timeMax: endDate,
      items: calendarIds.map(id => ({ id }))
    }

    const response = await this.request<{
      calendars: Record<string, {
        busy: Array<{ start: string; end: string }>
      }>
    }>('/freeBusy', {
      method: 'POST',
      body: JSON.stringify(request)
    })

    // Convert to availability slots
    const slots: AvailabilitySlot[] = []

    for (const [calendarId, data] of Object.entries(response.calendars)) {
      for (const period of data.busy) {
        slots.push({
          startTime: period.start,
          endTime: period.end,
          provider: 'google',
          isBusy: true
        })
      }
    }

    return slots
  }

  // ==========================================
  // CALENDAR OPERATIONS
  // ==========================================

  /**
   * List user's calendars
   */
  async listCalendars(): Promise<Array<{
    id: string
    summary: string
    primary?: boolean
    accessRole: string
  }>> {
    const response = await this.request<{
      items: Array<{
        id: string
        summary: string
        primary?: boolean
        accessRole: string
      }>
    }>('/users/me/calendarList')

    return response.items || []
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Build Google Calendar event object from request
   */
  private buildGoogleEvent(request: CreateEventRequest): Partial<GoogleCalendarEvent> {
    const event: Partial<GoogleCalendarEvent> = {
      summary: request.title,
      description: request.description,
      location: request.location
    }

    // Set time
    if (request.isAllDay) {
      event.start = {
        date: request.startTime.split('T')[0]
      }
      event.end = {
        date: request.endTime.split('T')[0]
      }
    } else {
      event.start = {
        dateTime: request.startTime,
        timeZone: request.timezone || 'America/Los_Angeles'
      }
      event.end = {
        dateTime: request.endTime,
        timeZone: request.timezone || 'America/Los_Angeles'
      }
    }

    // Add attendees
    if (request.attendees && request.attendees.length > 0) {
      event.attendees = request.attendees.map(a => ({
        email: a.email,
        displayName: a.displayName,
        optional: a.isOptional
      }))
    }

    // Add recurrence
    if (request.recurrence) {
      const { frequency, interval = 1, count, until, byWeekDay } = request.recurrence
      let rrule = `FREQ=${frequency.toUpperCase()}`

      if (interval > 1) rrule += `;INTERVAL=${interval}`
      if (count) rrule += `;COUNT=${count}`
      if (until) rrule += `;UNTIL=${until.replace(/[-:]/g, '')}`
      if (byWeekDay && byWeekDay.length > 0) {
        rrule += `;BYDAY=${byWeekDay.join(',').toUpperCase()}`
      }

      event.recurrence = [`RRULE:${rrule}`]
    }

    // Set visibility
    if (request.visibility) {
      event.visibility = request.visibility === 'public' ? 'public' :
                        request.visibility === 'private' ? 'private' :
                        'confidential'
    }

    return event
  }

  /**
   * Convert Google event to unified CalendarEvent format
   */
  static normalizeEvent(
    googleEvent: GoogleCalendarEvent,
    userId: string,
    connectionId: string
  ): CalendarEvent {
    const startTime = googleEvent.start.dateTime || googleEvent.start.date!
    const endTime = googleEvent.end.dateTime || googleEvent.end.date!

    return {
      id: crypto.randomUUID(),
      userId,
      connectionId,
      provider: 'google',
      providerEventId: googleEvent.id,
      title: googleEvent.summary,
      description: googleEvent.description,
      location: googleEvent.location,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      timezone: googleEvent.start.timeZone || 'UTC',
      isAllDay: !googleEvent.start.dateTime,
      organizer: {
        email: googleEvent.attendees?.find(a => a.organizer)?.email || '',
        displayName: googleEvent.attendees?.find(a => a.organizer)?.displayName,
        status: 'accepted',
        isOrganizer: true
      },
      attendees: (googleEvent.attendees || []).map(a => ({
        email: a.email,
        displayName: a.displayName,
        status: a.responseStatus as any || 'needsAction',
        isOrganizer: a.organizer,
        isOptional: a.optional
      })),
      meetingUrl: googleEvent.conferenceData?.entryPoints?.find(
        e => e.entryPointType === 'video'
      )?.uri,
      conferenceData: googleEvent.conferenceData ? {
        type: 'hangoutsMeet',
        uri: googleEvent.conferenceData.entryPoints?.[0]?.uri || '',
        label: googleEvent.conferenceData.conferenceSolution?.name,
        conferenceId: googleEvent.conferenceData.conferenceId,
        entryPoints: googleEvent.conferenceData.entryPoints?.map(e => ({
          type: e.entryPointType as any,
          uri: e.uri,
          label: e.label,
          pin: e.pin
        }))
      } : undefined,
      status: googleEvent.status === 'cancelled' ? 'cancelled' :
             googleEvent.status === 'tentative' ? 'tentative' : 'confirmed',
      visibility: googleEvent.visibility === 'public' ? 'public' :
                 googleEvent.visibility === 'private' ? 'private' : 'confidential',
      htmlLink: googleEvent.htmlLink,
      icalUid: googleEvent.iCalUID,
      sequence: googleEvent.sequence || 0,
      isRecurring: !!googleEvent.recurrence,
      recurrenceRule: googleEvent.recurrence?.[0],
      createdAt: new Date(googleEvent.created || Date.now()),
      updatedAt: new Date(googleEvent.updated || Date.now())
    }
  }
}

// ==========================================
// RATE LIMITING
// ==========================================

/**
 * Google Calendar API Rate Limits:
 * - 1,000,000 queries per day (default)
 * - 10 queries per second per user
 *
 * We implement client-side rate limiting to stay within limits
 */

class GoogleRateLimiter {
  private requests: Map<string, number[]> = new Map()
  private readonly maxRequestsPerSecond = 8 // Stay under 10/sec limit
  private readonly windowMs = 1000

  async checkLimit(userId: string): Promise<boolean> {
    const now = Date.now()
    const userRequests = this.requests.get(userId) || []

    // Filter recent requests
    const recentRequests = userRequests.filter(time => now - time < this.windowMs)

    if (recentRequests.length >= this.maxRequestsPerSecond) {
      return false
    }

    recentRequests.push(now)
    this.requests.set(userId, recentRequests)

    return true
  }

  async waitForSlot(userId: string): Promise<void> {
    while (!(await this.checkLimit(userId))) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}

export const googleRateLimiter = new GoogleRateLimiter()
