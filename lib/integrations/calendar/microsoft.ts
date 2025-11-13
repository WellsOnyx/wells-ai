/**
 * Microsoft Outlook/365 Calendar Integration
 *
 * Implements Microsoft Graph API for Calendar
 * API Reference: https://learn.microsoft.com/en-us/graph/api/resources/calendar
 */

import {
  CalendarEvent,
  CreateEventRequest,
  UpdateEventRequest,
  MicrosoftCalendarEvent,
  CalendarError,
  CalendarRateLimitError,
  CalendarNotFoundError,
  AvailabilitySlot
} from './types'

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'

// ==========================================
// MICROSOFT CALENDAR CLIENT
// ==========================================

export class MicrosoftCalendarClient {
  constructor(private accessToken: string) {}

  /**
   * Make authenticated request to Microsoft Graph API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${GRAPH_API_BASE}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Prefer': 'outlook.timezone="America/Los_Angeles"', // Default timezone
        ...options.headers
      }
    })

    // Handle throttling (rate limiting)
    if (response.status === 429 || response.status === 503) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
      throw new CalendarRateLimitError(
        'Microsoft Graph API rate limit exceeded',
        'microsoft',
        retryAfter
      )
    }

    // Handle not found
    if (response.status === 404) {
      throw new CalendarNotFoundError('Calendar or event not found', 'microsoft')
    }

    // Handle other errors
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: { message: response.statusText }
      }))
      throw new CalendarError(
        `Microsoft Graph API error: ${error.error?.message || response.statusText}`,
        'MICROSOFT_API_ERROR',
        'microsoft',
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
  async createEvent(request: CreateEventRequest): Promise<MicrosoftCalendarEvent> {
    const event = this.buildMicrosoftEvent(request)

    return this.request<MicrosoftCalendarEvent>('/me/events', {
      method: 'POST',
      body: JSON.stringify(event)
    })
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId: string): Promise<MicrosoftCalendarEvent> {
    return this.request<MicrosoftCalendarEvent>(`/me/events/${eventId}`)
  }

  /**
   * Update calendar event
   */
  async updateEvent(
    eventId: string,
    request: UpdateEventRequest
  ): Promise<MicrosoftCalendarEvent> {
    const updates = this.buildMicrosoftEvent(request as CreateEventRequest)

    return this.request<MicrosoftCalendarEvent>(`/me/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    })
  }

  /**
   * Delete calendar event
   */
  async deleteEvent(eventId: string): Promise<void> {
    await this.request<void>(`/me/events/${eventId}`, {
      method: 'DELETE'
    })
  }

  /**
   * Cancel event with message
   */
  async cancelEvent(eventId: string, message?: string): Promise<void> {
    const body = message ? {
      comment: message
    } : undefined

    await this.request<void>(`/me/events/${eventId}/cancel`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
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
      search?: string
    } = {}
  ): Promise<MicrosoftCalendarEvent[]> {
    const params = new URLSearchParams()

    // Filter by date range
    const filter = `start/dateTime ge '${startDate}' and end/dateTime le '${endDate}'`
    params.set('$filter', filter)

    // Order by start time
    params.set('$orderby', 'start/dateTime')

    // Limit results
    if (options.maxResults) {
      params.set('$top', options.maxResults.toString())
    }

    // Search
    if (options.search) {
      params.set('$search', `"${options.search}"`)
    }

    const response = await this.request<{ value: MicrosoftCalendarEvent[] }>(
      `/me/events?${params.toString()}`
    )

    return response.value || []
  }

  // ==========================================
  // AVAILABILITY
  // ==========================================

  /**
   * Check free/busy availability using findMeetingTimes
   */
  async checkAvailability(
    startDate: string,
    endDate: string,
    durationMinutes: number = 30
  ): Promise<AvailabilitySlot[]> {
    const request = {
      attendees: [
        {
          type: 'required',
          emailAddress: {
            address: 'me'
          }
        }
      ],
      timeConstraint: {
        timeslots: [
          {
            start: {
              dateTime: startDate,
              timeZone: 'UTC'
            },
            end: {
              dateTime: endDate,
              timeZone: 'UTC'
            }
          }
        ]
      },
      meetingDuration: `PT${durationMinutes}M`,
      returnSuggestionReasons: true,
      minimumAttendeePercentage: 100
    }

    const response = await this.request<{
      meetingTimeSuggestions: Array<{
        meetingTimeSlot: {
          start: { dateTime: string; timeZone: string }
          end: { dateTime: string; timeZone: string }
        }
        confidence: number
      }>
    }>('/me/findMeetingTimes', {
      method: 'POST',
      body: JSON.stringify(request)
    })

    // Convert suggestions to availability slots
    return (response.meetingTimeSuggestions || []).map(suggestion => ({
      startTime: suggestion.meetingTimeSlot.start.dateTime,
      endTime: suggestion.meetingTimeSlot.end.dateTime,
      provider: 'microsoft' as const,
      isBusy: false // These are available slots
    }))
  }

  /**
   * Get schedule (free/busy info)
   */
  async getSchedule(
    startDate: string,
    endDate: string,
    emailAddresses: string[] = ['me']
  ): Promise<AvailabilitySlot[]> {
    const request = {
      schedules: emailAddresses,
      startTime: {
        dateTime: startDate,
        timeZone: 'UTC'
      },
      endTime: {
        dateTime: endDate,
        timeZone: 'UTC'
      },
      availabilityViewInterval: 30
    }

    const response = await this.request<{
      value: Array<{
        scheduleId: string
        scheduleItems: Array<{
          start: { dateTime: string; timeZone: string }
          end: { dateTime: string; timeZone: string }
          status: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere'
        }>
      }>
    }>('/me/calendar/getSchedule', {
      method: 'POST',
      body: JSON.stringify(request)
    })

    // Convert to availability slots
    const slots: AvailabilitySlot[] = []

    for (const schedule of response.value || []) {
      for (const item of schedule.scheduleItems) {
        if (item.status !== 'free') {
          slots.push({
            startTime: item.start.dateTime,
            endTime: item.end.dateTime,
            provider: 'microsoft',
            isBusy: true
          })
        }
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
    name: string
    isDefaultCalendar?: boolean
    canEdit: boolean
    owner: { name?: string; address: string }
  }>> {
    const response = await this.request<{
      value: Array<{
        id: string
        name: string
        isDefaultCalendar?: boolean
        canEdit: boolean
        owner: { name?: string; address: string }
      }>
    }>('/me/calendars')

    return response.value || []
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Build Microsoft Graph event object from request
   */
  private buildMicrosoftEvent(request: CreateEventRequest): Partial<MicrosoftCalendarEvent> {
    const event: Partial<MicrosoftCalendarEvent> = {
      subject: request.title,
      body: request.description ? {
        contentType: 'html',
        content: request.description
      } : undefined,
      location: request.location ? {
        displayName: request.location
      } : undefined
    }

    // Set time
    const timezone = request.timezone || 'America/Los_Angeles'
    event.start = {
      dateTime: request.startTime,
      timeZone: timezone
    }
    event.end = {
      dateTime: request.endTime,
      timeZone: timezone
    }

    // Add attendees
    if (request.attendees && request.attendees.length > 0) {
      event.attendees = request.attendees.map(a => ({
        emailAddress: {
          address: a.email,
          name: a.displayName
        },
        type: a.isOptional ? 'optional' : 'required',
        status: {
          response: 'none',
          time: new Date().toISOString()
        }
      }))
    }

    // Add online meeting if requested
    if (request.addConference) {
      event.isOnlineMeeting = true
      event.onlineMeetingProvider = 'teamsForBusiness'
    }

    // Set visibility (showAs in Microsoft)
    if (request.visibility) {
      event.showAs = request.visibility === 'private' ? 'free' : 'busy'
    }

    return event
  }

  /**
   * Convert Microsoft event to unified CalendarEvent format
   */
  static normalizeEvent(
    msEvent: MicrosoftCalendarEvent,
    userId: string,
    connectionId: string
  ): CalendarEvent {
    const organizer = msEvent.attendees?.find(a => a.status.response === 'organizer')

    return {
      id: crypto.randomUUID(),
      userId,
      connectionId,
      provider: 'microsoft',
      providerEventId: msEvent.id,
      title: msEvent.subject,
      description: msEvent.body?.content,
      location: msEvent.location?.displayName,
      startTime: new Date(msEvent.start.dateTime),
      endTime: new Date(msEvent.end.dateTime),
      timezone: msEvent.start.timeZone,
      isAllDay: false, // Microsoft doesn't have explicit all-day in this format
      organizer: {
        email: organizer?.emailAddress.address || '',
        displayName: organizer?.emailAddress.name,
        status: 'accepted',
        isOrganizer: true
      },
      attendees: (msEvent.attendees || []).map(a => ({
        email: a.emailAddress.address,
        displayName: a.emailAddress.name,
        status: this.mapAttendeeStatus(a.status.response),
        isOrganizer: a.status.response === 'organizer',
        isOptional: a.type === 'optional'
      })),
      meetingUrl: msEvent.onlineMeeting?.joinUrl,
      conferenceData: msEvent.onlineMeeting ? {
        type: 'teamsForBusiness',
        uri: msEvent.onlineMeeting.joinUrl,
        conferenceId: msEvent.onlineMeeting.conferenceId,
        entryPoints: [{
          type: 'video',
          uri: msEvent.onlineMeeting.joinUrl,
          label: 'Microsoft Teams Meeting'
        }]
      } : undefined,
      status: msEvent.isCancelled ? 'cancelled' :
             msEvent.showAs === 'tentative' ? 'tentative' : 'confirmed',
      visibility: msEvent.showAs === 'free' ? 'private' : 'public',
      htmlLink: msEvent.webLink,
      icalUid: msEvent.iCalUId,
      sequence: 0,
      isRecurring: !!msEvent.recurrence,
      recurrenceRule: msEvent.recurrence ? JSON.stringify(msEvent.recurrence) : undefined,
      createdAt: new Date(msEvent.createdDateTime || Date.now()),
      updatedAt: new Date(msEvent.lastModifiedDateTime || Date.now())
    }
  }

  /**
   * Map Microsoft attendee status to unified format
   */
  private static mapAttendeeStatus(
    status: 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined' | 'notResponded'
  ): 'needsAction' | 'accepted' | 'declined' | 'tentative' {
    switch (status) {
      case 'accepted':
        return 'accepted'
      case 'declined':
        return 'declined'
      case 'tentativelyAccepted':
        return 'tentative'
      case 'none':
      case 'notResponded':
      case 'organizer':
      default:
        return 'needsAction'
    }
  }
}

// ==========================================
// RATE LIMITING
// ==========================================

/**
 * Microsoft Graph API Rate Limits:
 * - Throttling is per-app per-user
 * - Varies by endpoint, typically 2000-10000 requests per 10 minutes
 * - Uses 429 status code with Retry-After header
 *
 * We implement client-side rate limiting
 */

class MicrosoftRateLimiter {
  private requests: Map<string, number[]> = new Map()
  private readonly maxRequestsPerMinute = 100 // Conservative limit
  private readonly windowMs = 60000 // 1 minute

  async checkLimit(userId: string): Promise<boolean> {
    const now = Date.now()
    const userRequests = this.requests.get(userId) || []

    // Filter recent requests
    const recentRequests = userRequests.filter(time => now - time < this.windowMs)

    if (recentRequests.length >= this.maxRequestsPerMinute) {
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

export const microsoftRateLimiter = new MicrosoftRateLimiter()
