/**
 * Apple Calendar Integration
 *
 * Implements CalDAV protocol for iCloud Calendar
 * Apple doesn't have a public REST API, so we use CalDAV (RFC 4791)
 *
 * Alternative: Use iCloud Calendar API (undocumented) or CloudKit
 */

import {
  CalendarEvent,
  CreateEventRequest,
  UpdateEventRequest,
  AppleCalendarEvent,
  CalendarError,
  CalendarNotFoundError,
  AvailabilitySlot
} from './types'
import ical from 'ical'

const CALDAV_BASE_URL = 'https://caldav.icloud.com'

// ==========================================
// APPLE CALENDAR CLIENT (CalDAV)
// ==========================================

export class AppleCalendarClient {
  private username: string
  private appSpecificPassword: string

  constructor(username: string, appSpecificPassword: string) {
    this.username = username
    this.appSpecificPassword = appSpecificPassword
  }

  /**
   * Make authenticated CalDAV request
   */
  private async caldavRequest(
    url: string,
    options: RequestInit & { body?: string } = {}
  ): Promise<Response> {
    const auth = Buffer.from(`${this.username}:${this.appSpecificPassword}`).toString('base64')

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/xml; charset=utf-8',
        'Depth': '1',
        ...options.headers
      }
    })

    if (response.status === 404) {
      throw new CalendarNotFoundError('Calendar or event not found', 'apple')
    }

    if (!response.ok && response.status !== 207) { // 207 is Multi-Status (valid for CalDAV)
      throw new CalendarError(
        `CalDAV error: ${response.statusText}`,
        'CALDAV_ERROR',
        'apple'
      )
    }

    return response
  }

  // ==========================================
  // CALENDAR DISCOVERY
  // ==========================================

  /**
   * Discover user's calendar home
   */
  async getCalendarHome(): Promise<string> {
    const propfind = `<?xml version="1.0" encoding="utf-8" ?>
      <d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:prop>
          <c:calendar-home-set />
        </d:prop>
      </d:propfind>`

    const response = await this.caldavRequest(
      `${CALDAV_BASE_URL}/`,
      {
        method: 'PROPFIND',
        body: propfind
      }
    )

    const xml = await response.text()
    // Parse XML to extract calendar-home-set
    // For iCloud, it's typically: /[dav-id]/calendars/

    // Simplified: return standard path
    return `${CALDAV_BASE_URL}/${this.username}/calendars/`
  }

  /**
   * List user's calendars
   */
  async listCalendars(): Promise<Array<{
    id: string
    name: string
    url: string
    color?: string
  }>> {
    const calendarHome = await this.getCalendarHome()

    const propfind = `<?xml version="1.0" encoding="utf-8" ?>
      <d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
        <d:prop>
          <d:displayname />
          <c:calendar-description />
          <cs:calendar-color />
        </d:prop>
      </d:propfind>`

    const response = await this.caldavRequest(calendarHome, {
      method: 'PROPFIND',
      body: propfind
    })

    const xml = await response.text()

    // Parse XML response to extract calendar list
    // This is a simplified implementation
    // In production, use xml2js or fast-xml-parser

    return []
  }

  // ==========================================
  // EVENT OPERATIONS (iCal format)
  // ==========================================

  /**
   * Create calendar event
   */
  async createEvent(
    request: CreateEventRequest,
    calendarUrl: string
  ): Promise<AppleCalendarEvent> {
    const uid = this.generateUID()
    const icalEvent = this.buildICalEvent(request, uid)

    const eventUrl = `${calendarUrl}${uid}.ics`

    await this.caldavRequest(eventUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8'
      },
      body: icalEvent
    })

    return this.parseICalEvent(icalEvent)
  }

  /**
   * Get event by UID
   */
  async getEvent(uid: string, calendarUrl: string): Promise<AppleCalendarEvent> {
    const eventUrl = `${calendarUrl}${uid}.ics`

    const response = await this.caldavRequest(eventUrl, {
      method: 'GET'
    })

    const icalData = await response.text()
    return this.parseICalEvent(icalData)
  }

  /**
   * Update calendar event
   */
  async updateEvent(
    uid: string,
    request: UpdateEventRequest,
    calendarUrl: string
  ): Promise<AppleCalendarEvent> {
    // Get existing event first
    const existing = await this.getEvent(uid, calendarUrl)

    // Merge updates
    const merged = { ...existing, ...request }
    const icalEvent = this.buildICalEvent(merged as any, uid, existing.sequence + 1)

    const eventUrl = `${calendarUrl}${uid}.ics`

    await this.caldavRequest(eventUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8'
      },
      body: icalEvent
    })

    return this.parseICalEvent(icalEvent)
  }

  /**
   * Delete calendar event
   */
  async deleteEvent(uid: string, calendarUrl: string): Promise<void> {
    const eventUrl = `${calendarUrl}${uid}.ics`

    await this.caldavRequest(eventUrl, {
      method: 'DELETE'
    })
  }

  /**
   * List calendar events
   */
  async listEvents(
    calendarUrl: string,
    startDate: string,
    endDate: string
  ): Promise<AppleCalendarEvent[]> {
    const report = `<?xml version="1.0" encoding="utf-8" ?>
      <c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:prop>
          <d:getetag />
          <c:calendar-data />
        </d:prop>
        <c:filter>
          <c:comp-filter name="VCALENDAR">
            <c:comp-filter name="VEVENT">
              <c:time-range start="${this.formatCalDAVDate(startDate)}" end="${this.formatCalDAVDate(endDate)}"/>
            </c:comp-filter>
          </c:comp-filter>
        </c:filter>
      </c:calendar-query>`

    const response = await this.caldavRequest(calendarUrl, {
      method: 'REPORT',
      body: report
    })

    const xml = await response.text()

    // Parse multi-status response to extract events
    // This would require XML parsing
    // Simplified for now

    return []
  }

  // ==========================================
  // AVAILABILITY
  // ==========================================

  /**
   * Check free/busy availability
   */
  async checkAvailability(
    calendarUrl: string,
    startDate: string,
    endDate: string
  ): Promise<AvailabilitySlot[]> {
    const report = `<?xml version="1.0" encoding="utf-8" ?>
      <c:free-busy-query xmlns:c="urn:ietf:params:xml:ns:caldav">
        <c:time-range start="${this.formatCalDAVDate(startDate)}" end="${this.formatCalDAVDate(endDate)}"/>
      </c:free-busy-query>`

    const response = await this.caldavRequest(calendarUrl, {
      method: 'REPORT',
      body: report
    })

    const icalData = await response.text()

    // Parse VFREEBUSY component
    // Extract busy periods

    return []
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Generate unique UID for event
   */
  private generateUID(): string {
    return `${Date.now()}-${crypto.randomUUID()}@wellsai.com`
  }

  /**
   * Format date for CalDAV (ISO 8601 basic format)
   */
  private formatCalDAVDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  /**
   * Build iCal (RFC 5545) event string
   */
  private buildICalEvent(
    request: CreateEventRequest,
    uid: string,
    sequence: number = 0
  ): string {
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const dtstart = this.formatCalDAVDate(request.startTime)
    const dtend = this.formatCalDAVDate(request.endTime)

    let ical = 'BEGIN:VCALENDAR\r\n'
    ical += 'VERSION:2.0\r\n'
    ical += 'PRODID:-//Wells AI//Calendar Integration//EN\r\n'
    ical += 'BEGIN:VEVENT\r\n'
    ical += `UID:${uid}\r\n`
    ical += `DTSTAMP:${now}\r\n`
    ical += `DTSTART:${dtstart}\r\n`
    ical += `DTEND:${dtend}\r\n`
    ical += `SUMMARY:${this.escapeICalText(request.title)}\r\n`

    if (request.description) {
      ical += `DESCRIPTION:${this.escapeICalText(request.description)}\r\n`
    }

    if (request.location) {
      ical += `LOCATION:${this.escapeICalText(request.location)}\r\n`
    }

    // Add organizer (current user)
    ical += `ORGANIZER:mailto:${this.username}\r\n`

    // Add attendees
    if (request.attendees && request.attendees.length > 0) {
      for (const attendee of request.attendees) {
        const status = attendee.isOptional ? 'REQ-PARTICIPANT' : 'OPT-PARTICIPANT'
        ical += `ATTENDEE;ROLE=${status};PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendee.email}\r\n`
      }
    }

    ical += `STATUS:CONFIRMED\r\n`
    ical += `SEQUENCE:${sequence}\r\n`

    // Add recurrence if specified
    if (request.recurrence) {
      const { frequency, interval = 1, count, until } = request.recurrence
      let rrule = `FREQ=${frequency.toUpperCase()}`

      if (interval > 1) rrule += `;INTERVAL=${interval}`
      if (count) rrule += `;COUNT=${count}`
      if (until) rrule += `;UNTIL=${this.formatCalDAVDate(until)}`

      ical += `RRULE:${rrule}\r\n`
    }

    ical += 'END:VEVENT\r\n'
    ical += 'END:VCALENDAR\r\n'

    return ical
  }

  /**
   * Escape text for iCal format
   */
  private escapeICalText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
  }

  /**
   * Parse iCal event string to AppleCalendarEvent
   */
  private parseICalEvent(icalData: string): AppleCalendarEvent {
    // Parse iCal format
    // This is a simplified implementation
    // In production, use ical.js or node-ical library

    const lines = icalData.split('\r\n')
    const event: Partial<AppleCalendarEvent> = {}

    for (const line of lines) {
      if (line.startsWith('UID:')) {
        event.uid = line.substring(4)
      } else if (line.startsWith('SUMMARY:')) {
        event.summary = line.substring(8)
      } else if (line.startsWith('DESCRIPTION:')) {
        event.description = line.substring(12)
      } else if (line.startsWith('LOCATION:')) {
        event.location = line.substring(9)
      } else if (line.startsWith('DTSTART:')) {
        event.dtstart = line.substring(8)
      } else if (line.startsWith('DTEND:')) {
        event.dtend = line.substring(6)
      } else if (line.startsWith('STATUS:')) {
        event.status = line.substring(7) as any
      } else if (line.startsWith('SEQUENCE:')) {
        event.sequence = parseInt(line.substring(9))
      }
    }

    return event as AppleCalendarEvent
  }

  /**
   * Convert Apple event to unified CalendarEvent format
   */
  static normalizeEvent(
    appleEvent: AppleCalendarEvent,
    userId: string,
    connectionId: string
  ): CalendarEvent {
    return {
      id: crypto.randomUUID(),
      userId,
      connectionId,
      provider: 'apple',
      providerEventId: appleEvent.uid,
      title: appleEvent.summary,
      description: appleEvent.description,
      location: appleEvent.location,
      startTime: this.parseCalDAVDate(appleEvent.dtstart),
      endTime: this.parseCalDAVDate(appleEvent.dtend),
      timezone: appleEvent.timezone || 'UTC',
      isAllDay: !appleEvent.dtstart.includes('T'),
      organizer: {
        email: appleEvent.organizer?.email || '',
        displayName: appleEvent.organizer?.name,
        status: 'accepted',
        isOrganizer: true
      },
      attendees: (appleEvent.attendees || []).map(a => ({
        email: a.email,
        displayName: a.name,
        status: this.mapAttendeeStatus(a.partstat || 'NEEDS-ACTION'),
        isOrganizer: false,
        isOptional: a.role === 'OPT-PARTICIPANT'
      })),
      meetingUrl: appleEvent.url,
      status: appleEvent.status === 'CANCELLED' ? 'cancelled' :
             appleEvent.status === 'TENTATIVE' ? 'tentative' : 'confirmed',
      visibility: appleEvent.class === 'PUBLIC' ? 'public' :
                 appleEvent.class === 'CONFIDENTIAL' ? 'confidential' : 'private',
      icalUid: appleEvent.uid,
      sequence: appleEvent.sequence || 0,
      isRecurring: !!appleEvent.rrule,
      recurrenceRule: appleEvent.rrule,
      recurrenceExceptions: appleEvent.exdate,
      createdAt: appleEvent.created ? this.parseCalDAVDate(appleEvent.created) : new Date(),
      updatedAt: appleEvent['last-modified'] ? this.parseCalDAVDate(appleEvent['last-modified']) : new Date()
    }
  }

  /**
   * Parse CalDAV date format to Date object
   */
  private static parseCalDAVDate(dateString: string): Date {
    // CalDAV format: 20250120T140000Z
    const year = parseInt(dateString.substring(0, 4))
    const month = parseInt(dateString.substring(4, 6)) - 1
    const day = parseInt(dateString.substring(6, 8))
    const hour = parseInt(dateString.substring(9, 11) || '0')
    const minute = parseInt(dateString.substring(11, 13) || '0')
    const second = parseInt(dateString.substring(13, 15) || '0')

    return new Date(Date.UTC(year, month, day, hour, minute, second))
  }

  /**
   * Map CalDAV attendee status to unified format
   */
  private static mapAttendeeStatus(
    status: string
  ): 'needsAction' | 'accepted' | 'declined' | 'tentative' {
    switch (status.toUpperCase()) {
      case 'ACCEPTED':
        return 'accepted'
      case 'DECLINED':
        return 'declined'
      case 'TENTATIVE':
        return 'tentative'
      case 'NEEDS-ACTION':
      default:
        return 'needsAction'
    }
  }
}

// ==========================================
// APPLE-SPECIFIC NOTES
// ==========================================

/**
 * Apple Calendar Integration Notes:
 *
 * 1. Authentication:
 *    - Requires Apple ID and app-specific password
 *    - Get app-specific password from: appleid.apple.com
 *    - Cannot use regular Apple ID password
 *
 * 2. CalDAV Protocol:
 *    - Apple uses standard CalDAV (RFC 4791)
 *    - Base URL: https://caldav.icloud.com
 *    - Supports all standard CalDAV operations
 *
 * 3. Limitations:
 *    - No official REST API
 *    - Must use CalDAV (XML-based protocol)
 *    - More complex than Google/Microsoft APIs
 *    - Requires XML parsing
 *
 * 4. Alternative: Sign in with Apple
 *    - Use Sign in with Apple for OAuth
 *    - Then use CalDAV with app-specific password
 *    - Better user experience
 *
 * 5. Production Considerations:
 *    - Use xml2js or fast-xml-parser for XML parsing
 *    - Use ical.js for iCal parsing/generation
 *    - Implement proper error handling for CalDAV
 *    - Cache calendar URLs to avoid discovery overhead
 *
 * 6. Rate Limiting:
 *    - Apple doesn't publish official rate limits
 *    - Be conservative: ~10 requests per second
 *    - Implement exponential backoff for errors
 */

// ==========================================
// RATE LIMITING
// ==========================================

class AppleRateLimiter {
  private requests: Map<string, number[]> = new Map()
  private readonly maxRequestsPerSecond = 10
  private readonly windowMs = 1000

  async checkLimit(userId: string): Promise<boolean> {
    const now = Date.now()
    const userRequests = this.requests.get(userId) || []

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

export const appleRateLimiter = new AppleRateLimiter()
