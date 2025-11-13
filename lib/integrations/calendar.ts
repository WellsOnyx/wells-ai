/**
 * Calendar Integration for Wells AI
 *
 * Supports Cal.com API for meeting scheduling with video conferencing
 * Includes OAuth flow, event creation, and secure token storage
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Encryption helpers for secure token storage
const ENCRYPTION_KEY = process.env.CALENDAR_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
const ALGORITHM = 'aes-256-gcm'

function encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(16)
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex')
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex')
  }
}

function decrypt(encrypted: string, iv: string, authTag: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

// Types
export interface CalendarEvent {
  title: string
  description?: string
  startTime: string // ISO 8601
  endTime?: string
  durationMinutes?: number
  attendees: Array<{
    email: string
    name?: string
  }>
  location?: string
  timezone?: string
}

export interface CalendarBooking {
  id: string
  uid: string
  title: string
  startTime: string
  endTime: string
  attendees: Array<{
    email: string
    name?: string
  }>
  status: 'pending' | 'accepted' | 'cancelled'
  meetingUrl?: string
  location?: string
}

export interface CalendarConnection {
  id: string
  userId: string
  provider: 'calcom' // Future: 'google', 'outlook'
  connected: boolean
  calendarEmail?: string
  lastSyncAt?: Date
}

// Cal.com API Client
export class CalcomClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
    this.baseUrl = process.env.CALCOM_API_URL || 'https://api.cal.com/v1'
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(`Cal.com API error: ${error.message || response.statusText}`)
    }

    return response.json()
  }

  /**
   * Create a booking on Cal.com
   */
  async createBooking(event: CalendarEvent): Promise<CalendarBooking> {
    const durationMinutes = event.durationMinutes || 30
    const startTime = new Date(event.startTime)
    const endTime = event.endTime
      ? new Date(event.endTime)
      : new Date(startTime.getTime() + durationMinutes * 60000)

    const booking = await this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        eventTypeId: process.env.CALCOM_EVENT_TYPE_ID, // Default event type
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        responses: {
          name: event.attendees[0]?.name || event.attendees[0]?.email,
          email: event.attendees[0]?.email,
          location: event.location || 'Web conferencing',
          notes: event.description || '',
          guests: event.attendees.slice(1).map(a => a.email),
        },
        timeZone: event.timezone || 'America/Los_Angeles',
        language: 'en',
        title: event.title,
        metadata: {
          source: 'wells-ai',
        },
      }),
    })

    return {
      id: booking.id,
      uid: booking.uid,
      title: event.title,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      attendees: event.attendees,
      status: 'pending',
      meetingUrl: booking.metadata?.videoCallUrl || undefined,
      location: event.location,
    }
  }

  /**
   * Get booking details
   */
  async getBooking(bookingId: string): Promise<CalendarBooking> {
    const booking = await this.request(`/bookings/${bookingId}`)

    return {
      id: booking.id,
      uid: booking.uid,
      title: booking.title,
      startTime: booking.startTime,
      endTime: booking.endTime,
      attendees: booking.attendees || [],
      status: booking.status,
      meetingUrl: booking.metadata?.videoCallUrl,
      location: booking.location,
    }
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string, reason?: string): Promise<void> {
    await this.request(`/bookings/${bookingId}/cancel`, {
      method: 'DELETE',
      body: JSON.stringify({
        cancellationReason: reason || 'Cancelled by user',
      }),
    })
  }

  /**
   * Reschedule a booking
   */
  async rescheduleBooking(
    bookingId: string,
    newStartTime: string,
    newEndTime?: string
  ): Promise<CalendarBooking> {
    const booking = await this.request(`/bookings/${bookingId}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({
        start: newStartTime,
        end: newEndTime,
      }),
    })

    return {
      id: booking.id,
      uid: booking.uid,
      title: booking.title,
      startTime: booking.startTime,
      endTime: booking.endTime,
      attendees: booking.attendees || [],
      status: booking.status,
      meetingUrl: booking.metadata?.videoCallUrl,
      location: booking.location,
    }
  }

  /**
   * Get available time slots
   */
  async getAvailability(
    startDate: string,
    endDate: string,
    eventTypeId?: string
  ): Promise<Array<{ start: string; end: string }>> {
    const params = new URLSearchParams({
      dateFrom: startDate,
      dateTo: endDate,
      ...(eventTypeId && { eventTypeId }),
    })

    const availability = await this.request(`/availability?${params}`)

    return availability.slots || []
  }
}

// Calendar Service - Main API
export class CalendarService {
  /**
   * Connect user calendar (Cal.com API key)
   */
  static async connectCalendar(
    userId: string,
    apiKey: string,
    provider: 'calcom' = 'calcom'
  ): Promise<CalendarConnection> {
    // Encrypt the API key before storing
    const { encrypted, iv, authTag } = encrypt(apiKey)

    // Verify the API key works by making a test request
    const client = new CalcomClient(apiKey)
    let calendarEmail: string | undefined

    try {
      const me = await client.request('/me')
      calendarEmail = me.email
    } catch (error) {
      throw new Error('Invalid Cal.com API key')
    }

    // Store encrypted credentials in database
    const connection = await prisma.$executeRaw`
      INSERT INTO calendar_connections (user_id, provider, api_key_encrypted, api_key_iv, api_key_auth_tag, calendar_email, connected, last_sync_at)
      VALUES (${userId}, ${provider}, ${encrypted}, ${iv}, ${authTag}, ${calendarEmail}, true, NOW())
      ON CONFLICT (user_id, provider)
      DO UPDATE SET
        api_key_encrypted = ${encrypted},
        api_key_iv = ${iv},
        api_key_auth_tag = ${authTag},
        calendar_email = ${calendarEmail},
        connected = true,
        last_sync_at = NOW()
      RETURNING *
    `

    return {
      id: userId + '-' + provider,
      userId,
      provider,
      connected: true,
      calendarEmail,
      lastSyncAt: new Date(),
    }
  }

  /**
   * Get user's calendar connection
   */
  static async getConnection(
    userId: string,
    provider: 'calcom' = 'calcom'
  ): Promise<CalendarConnection | null> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT * FROM calendar_connections
      WHERE user_id = ${userId} AND provider = ${provider}
      LIMIT 1
    `

    if (!result || result.length === 0) {
      return null
    }

    const conn = result[0]
    return {
      id: conn.id,
      userId: conn.user_id,
      provider: conn.provider,
      connected: conn.connected,
      calendarEmail: conn.calendar_email,
      lastSyncAt: conn.last_sync_at,
    }
  }

  /**
   * Disconnect calendar
   */
  static async disconnectCalendar(
    userId: string,
    provider: 'calcom' = 'calcom'
  ): Promise<void> {
    await prisma.$executeRaw`
      UPDATE calendar_connections
      SET connected = false, api_key_encrypted = NULL, api_key_iv = NULL, api_key_auth_tag = NULL
      WHERE user_id = ${userId} AND provider = ${provider}
    `
  }

  /**
   * Get decrypted API client for user
   */
  private static async getClient(userId: string): Promise<CalcomClient> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT api_key_encrypted, api_key_iv, api_key_auth_tag
      FROM calendar_connections
      WHERE user_id = ${userId} AND provider = 'calcom' AND connected = true
      LIMIT 1
    `

    if (!result || result.length === 0) {
      throw new Error('Calendar not connected')
    }

    const { api_key_encrypted, api_key_iv, api_key_auth_tag } = result[0]
    const apiKey = decrypt(api_key_encrypted, api_key_iv, api_key_auth_tag)

    return new CalcomClient(apiKey)
  }

  /**
   * Schedule a meeting
   */
  static async scheduleMeeting(
    userId: string,
    event: CalendarEvent
  ): Promise<CalendarBooking> {
    const client = await this.getClient(userId)
    const booking = await client.createBooking(event)

    // Store booking in database for tracking
    await prisma.$executeRaw`
      INSERT INTO calendar_bookings (
        id, user_id, booking_uid, title, start_time, end_time,
        attendees, status, meeting_url, location, created_at
      )
      VALUES (
        ${booking.id}, ${userId}, ${booking.uid}, ${booking.title},
        ${booking.startTime}, ${booking.endTime}, ${JSON.stringify(booking.attendees)}::jsonb,
        ${booking.status}, ${booking.meetingUrl}, ${booking.location}, NOW()
      )
    `

    return booking
  }

  /**
   * Get booking details
   */
  static async getBooking(
    userId: string,
    bookingId: string
  ): Promise<CalendarBooking> {
    const client = await this.getClient(userId)
    return client.getBooking(bookingId)
  }

  /**
   * Cancel meeting
   */
  static async cancelMeeting(
    userId: string,
    bookingId: string,
    reason?: string
  ): Promise<void> {
    const client = await this.getClient(userId)
    await client.cancelBooking(bookingId, reason)

    // Update in database
    await prisma.$executeRaw`
      UPDATE calendar_bookings
      SET status = 'cancelled', cancelled_at = NOW()
      WHERE user_id = ${userId} AND id = ${bookingId}
    `
  }

  /**
   * Reschedule meeting
   */
  static async rescheduleMeeting(
    userId: string,
    bookingId: string,
    newStartTime: string,
    newEndTime?: string
  ): Promise<CalendarBooking> {
    const client = await this.getClient(userId)
    const booking = await client.rescheduleBooking(bookingId, newStartTime, newEndTime)

    // Update in database
    await prisma.$executeRaw`
      UPDATE calendar_bookings
      SET start_time = ${booking.startTime}, end_time = ${booking.endTime}, updated_at = NOW()
      WHERE user_id = ${userId} AND id = ${bookingId}
    `

    return booking
  }

  /**
   * Get available time slots
   */
  static async getAvailability(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{ start: string; end: string }>> {
    const client = await this.getClient(userId)
    return client.getAvailability(startDate, endDate)
  }

  /**
   * Get user's upcoming bookings
   */
  static async getUpcomingBookings(userId: string): Promise<CalendarBooking[]> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT * FROM calendar_bookings
      WHERE user_id = ${userId}
        AND status != 'cancelled'
        AND start_time > NOW()
      ORDER BY start_time ASC
      LIMIT 50
    `

    return result.map(b => ({
      id: b.id,
      uid: b.booking_uid,
      title: b.title,
      startTime: b.start_time,
      endTime: b.end_time,
      attendees: b.attendees,
      status: b.status,
      meetingUrl: b.meeting_url,
      location: b.location,
    }))
  }
}

// Rate limiting helper
export class RateLimiter {
  private requests: Map<string, number[]> = new Map()

  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000 // 1 minute
  ) {}

  async checkLimit(userId: string): Promise<boolean> {
    const now = Date.now()
    const userRequests = this.requests.get(userId) || []

    // Filter out old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < this.windowMs)

    if (recentRequests.length >= this.maxRequests) {
      return false // Rate limit exceeded
    }

    recentRequests.push(now)
    this.requests.set(userId, recentRequests)

    return true
  }
}

export const rateLimiter = new RateLimiter()
