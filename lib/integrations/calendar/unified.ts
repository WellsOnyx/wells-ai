/**
 * Unified Calendar Service
 *
 * Provides a single interface for all calendar operations across
 * Google Calendar, Microsoft Outlook/365, and Apple Calendar
 */

import { query } from '../../db'
import { encryptCredential, decryptCredential, getUserEncryptionKey } from '../../settings/credential-storage'
import { refreshAccessToken, needsTokenRefresh, getUserInfo } from './oauth'
import { GoogleCalendarClient, googleRateLimiter } from './google'
import { MicrosoftCalendarClient, microsoftRateLimiter } from './microsoft'
import { AppleCalendarClient, appleRateLimiter } from './apple'
import {
  CalendarProvider,
  CalendarConnection,
  CalendarEvent,
  CreateEventRequest,
  UpdateEventRequest,
  DeleteEventRequest,
  ListEventsRequest,
  CheckAvailabilityRequest,
  AvailabilityResponse,
  CalendarConnectionError,
  CalendarAuthError,
  CalendarNotFoundError,
  OAuthTokens
} from './types'

// ==========================================
// UNIFIED CALENDAR SERVICE
// ==========================================

export class UnifiedCalendarService {
  /**
   * Get user's calendar connections from database
   */
  static async getConnections(userId: string): Promise<CalendarConnection[]> {
    const result = await query<any>(
      `SELECT * FROM user_calendar_connections
       WHERE user_id = $1 AND connected = true
       ORDER BY is_primary DESC, created_at ASC`,
      [userId]
    )

    return result.rows.map(row => this.mapConnectionFromDb(row))
  }

  /**
   * Get primary calendar connection
   */
  static async getPrimaryConnection(userId: string): Promise<CalendarConnection | null> {
    const result = await query<any>(
      `SELECT * FROM user_calendar_connections
       WHERE user_id = $1 AND is_primary = true AND connected = true
       LIMIT 1`,
      [userId]
    )

    if (result.rows.length === 0) {
      // If no primary, return first connected calendar
      const connections = await this.getConnections(userId)
      return connections[0] || null
    }

    return this.mapConnectionFromDb(result.rows[0])
  }

  /**
   * Get specific calendar connection
   */
  static async getConnection(
    userId: string,
    provider: CalendarProvider
  ): Promise<CalendarConnection | null> {
    const result = await query<any>(
      `SELECT * FROM user_calendar_connections
       WHERE user_id = $1 AND provider = $2 AND connected = true
       LIMIT 1`,
      [userId, provider]
    )

    if (result.rows.length === 0) {
      return null
    }

    return this.mapConnectionFromDb(result.rows[0])
  }

  /**
   * Save new calendar connection
   */
  static async saveConnection(
    userId: string,
    provider: CalendarProvider,
    tokens: OAuthTokens,
    email: string,
    displayName: string,
    providerAccountId: string,
    isPrimary: boolean = false
  ): Promise<CalendarConnection> {
    const userKey = getUserEncryptionKey(userId)
    const encryptedAccessToken = encryptCredential(tokens.accessToken, userKey)
    const encryptedRefreshToken = encryptCredential(tokens.refreshToken, userKey)

    // If this is set as primary, unset other primaries
    if (isPrimary) {
      await query(
        `UPDATE user_calendar_connections
         SET is_primary = false
         WHERE user_id = $1`,
        [userId]
      )
    }

    const result = await query<any>(
      `INSERT INTO user_calendar_connections (
        user_id, provider, provider_account_id, email, display_name,
        access_token_encrypted, refresh_token_encrypted, token_expires_at,
        scope, connected, is_primary, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (user_id, provider, email)
      DO UPDATE SET
        access_token_encrypted = $6,
        refresh_token_encrypted = $7,
        token_expires_at = $8,
        connected = true,
        is_primary = $11,
        updated_at = NOW()
      RETURNING *`,
      [
        userId,
        provider,
        providerAccountId,
        email,
        displayName,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokens.expiresAt,
        tokens.scope,
        true,
        isPrimary
      ]
    )

    return this.mapConnectionFromDb(result.rows[0])
  }

  /**
   * Disconnect calendar
   */
  static async disconnectCalendar(userId: string, provider: CalendarProvider): Promise<void> {
    await query(
      `UPDATE user_calendar_connections
       SET connected = false, updated_at = NOW()
       WHERE user_id = $1 AND provider = $2`,
      [userId, provider]
    )
  }

  /**
   * Get authenticated client for provider
   */
  private static async getClient(
    userId: string,
    provider: CalendarProvider
  ): Promise<GoogleCalendarClient | MicrosoftCalendarClient | AppleCalendarClient> {
    const connection = await this.getConnection(userId, provider)

    if (!connection) {
      throw new CalendarConnectionError(
        `No ${provider} calendar connected. Please connect your calendar first.`,
        provider
      )
    }

    // Check rate limiting
    switch (provider) {
      case 'google':
        await googleRateLimiter.waitForSlot(userId)
        break
      case 'microsoft':
        await microsoftRateLimiter.waitForSlot(userId)
        break
      case 'apple':
        await appleRateLimiter.waitForSlot(userId)
        break
    }

    // Check if token needs refresh
    if (needsTokenRefresh(connection.tokenExpiresAt)) {
      const userKey = getUserEncryptionKey(userId)
      const refreshToken = decryptCredential(connection.refreshToken, userKey)

      try {
        const newTokens = await refreshAccessToken(provider, refreshToken)

        // Update tokens in database
        const encryptedAccessToken = encryptCredential(newTokens.accessToken, userKey)
        const encryptedRefreshToken = encryptCredential(newTokens.refreshToken, userKey)

        await query(
          `UPDATE user_calendar_connections
           SET access_token_encrypted = $1,
               refresh_token_encrypted = $2,
               token_expires_at = $3,
               updated_at = NOW()
           WHERE id = $4`,
          [encryptedAccessToken, encryptedRefreshToken, newTokens.expiresAt, connection.id]
        )

        // Use new access token
        connection.accessToken = newTokens.accessToken
      } catch (error) {
        throw new CalendarAuthError(
          `Failed to refresh ${provider} access token. Please reconnect your calendar.`,
          provider,
          error
        )
      }
    } else {
      // Decrypt access token
      const userKey = getUserEncryptionKey(userId)
      connection.accessToken = decryptCredential(connection.accessToken, userKey)
    }

    // Create provider-specific client
    switch (provider) {
      case 'google':
        return new GoogleCalendarClient(connection.accessToken)

      case 'microsoft':
        return new MicrosoftCalendarClient(connection.accessToken)

      case 'apple':
        // Apple uses username + app-specific password
        // For now, we'll store these during OAuth
        return new AppleCalendarClient(connection.email, connection.accessToken)

      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  // ==========================================
  // UNIFIED EVENT OPERATIONS
  // ==========================================

  /**
   * Create calendar event
   * Uses primary calendar if provider not specified
   */
  static async createEvent(
    userId: string,
    request: CreateEventRequest
  ): Promise<CalendarEvent> {
    const provider = request.provider || (await this.getPrimaryConnection(userId))?.provider

    if (!provider) {
      throw new CalendarConnectionError(
        'No calendar connected. Please connect a calendar first.',
        'google'
      )
    }

    const client = await this.getClient(userId, provider)
    const connection = await this.getConnection(userId, provider)!

    let providerEvent: any

    switch (provider) {
      case 'google':
        providerEvent = await (client as GoogleCalendarClient).createEvent(request)
        break

      case 'microsoft':
        providerEvent = await (client as MicrosoftCalendarClient).createEvent(request)
        break

      case 'apple':
        // Apple needs calendar URL - get from connection metadata
        const calendarUrl = connection.email // Simplified, should be stored separately
        providerEvent = await (client as AppleCalendarClient).createEvent(request, calendarUrl)
        break

      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }

    // Normalize and save to database
    const normalizedEvent = this.normalizeEvent(providerEvent, userId, connection!.id, provider)
    await this.saveEvent(normalizedEvent)

    return normalizedEvent
  }

  /**
   * Update calendar event
   */
  static async updateEvent(
    userId: string,
    request: UpdateEventRequest
  ): Promise<CalendarEvent> {
    const client = await this.getClient(userId, request.provider)
    const connection = await this.getConnection(userId, request.provider)!

    let providerEvent: any

    switch (request.provider) {
      case 'google':
        providerEvent = await (client as GoogleCalendarClient).updateEvent(request.eventId, request)
        break

      case 'microsoft':
        providerEvent = await (client as MicrosoftCalendarClient).updateEvent(request.eventId, request)
        break

      case 'apple':
        const calendarUrl = connection!.email
        providerEvent = await (client as AppleCalendarClient).updateEvent(request.eventId, request, calendarUrl)
        break

      default:
        throw new Error(`Unsupported provider: ${request.provider}`)
    }

    // Normalize and update in database
    const normalizedEvent = this.normalizeEvent(providerEvent, userId, connection!.id, request.provider)
    await this.updateEventInDb(normalizedEvent)

    return normalizedEvent
  }

  /**
   * Delete calendar event
   */
  static async deleteEvent(
    userId: string,
    request: DeleteEventRequest
  ): Promise<void> {
    const client = await this.getClient(userId, request.provider)
    const connection = await this.getConnection(userId, request.provider)

    switch (request.provider) {
      case 'google':
        await (client as GoogleCalendarClient).deleteEvent(request.eventId, request.sendNotifications)
        break

      case 'microsoft':
        if (request.cancelMessage) {
          await (client as MicrosoftCalendarClient).cancelEvent(request.eventId, request.cancelMessage)
        } else {
          await (client as MicrosoftCalendarClient).deleteEvent(request.eventId)
        }
        break

      case 'apple':
        const calendarUrl = connection!.email
        await (client as AppleCalendarClient).deleteEvent(request.eventId, calendarUrl)
        break

      default:
        throw new Error(`Unsupported provider: ${request.provider}`)
    }

    // Mark as deleted in database
    await query(
      `UPDATE calendar_events
       SET deleted_at = NOW()
       WHERE user_id = $1 AND provider_event_id = $2 AND provider = $3`,
      [userId, request.eventId, request.provider]
    )
  }

  /**
   * List calendar events
   */
  static async listEvents(
    userId: string,
    request: ListEventsRequest
  ): Promise<CalendarEvent[]> {
    const provider = request.provider || (await this.getPrimaryConnection(userId))?.provider

    if (!provider) {
      return []
    }

    const client = await this.getClient(userId, provider)
    const connection = await this.getConnection(userId, provider)!

    let providerEvents: any[]

    switch (provider) {
      case 'google':
        providerEvents = await (client as GoogleCalendarClient).listEvents(
          request.startDate,
          request.endDate,
          {
            maxResults: request.maxResults,
            showDeleted: request.showDeleted,
            search: request.search
          }
        )
        break

      case 'microsoft':
        providerEvents = await (client as MicrosoftCalendarClient).listEvents(
          request.startDate,
          request.endDate,
          {
            maxResults: request.maxResults,
            search: request.search
          }
        )
        break

      case 'apple':
        const calendarUrl = connection!.email
        providerEvents = await (client as AppleCalendarClient).listEvents(
          calendarUrl,
          request.startDate,
          request.endDate
        )
        break

      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }

    // Normalize events
    return providerEvents.map(event =>
      this.normalizeEvent(event, userId, connection!.id, provider)
    )
  }

  /**
   * Check availability across all connected calendars
   */
  static async checkAvailability(
    userId: string,
    request: CheckAvailabilityRequest
  ): Promise<AvailabilityResponse> {
    const connections = request.provider
      ? [await this.getConnection(userId, request.provider)]
      : await this.getConnections(userId)

    const allSlots: any[] = []

    for (const connection of connections.filter(c => c !== null)) {
      if (!connection) continue

      const client = await this.getClient(userId, connection.provider)

      try {
        let slots: any[]

        switch (connection.provider) {
          case 'google':
            slots = await (client as GoogleCalendarClient).checkAvailability(
              request.startDate,
              request.endDate
            )
            break

          case 'microsoft':
            slots = await (client as MicrosoftCalendarClient).checkAvailability(
              request.startDate,
              request.endDate,
              request.durationMinutes
            )
            break

          case 'apple':
            slots = await (client as AppleCalendarClient).checkAvailability(
              connection.email,
              request.startDate,
              request.endDate
            )
            break

          default:
            continue
        }

        allSlots.push(...slots)
      } catch (error) {
        console.error(`Failed to check availability for ${connection.provider}:`, error)
      }
    }

    // Process slots to find busy and free periods
    const busyPeriods = allSlots.filter(s => s.isBusy)
    const freePeriods = this.calculateFreePeriods(
      request.startDate,
      request.endDate,
      busyPeriods,
      request.durationMinutes
    )

    return {
      slots: allSlots,
      busyPeriods,
      freePeriods
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Map database row to CalendarConnection
   */
  private static mapConnectionFromDb(row: any): CalendarConnection {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      providerAccountId: row.provider_account_id,
      email: row.email,
      displayName: row.display_name,
      accessToken: row.access_token_encrypted, // Will be decrypted when needed
      refreshToken: row.refresh_token_encrypted, // Will be decrypted when needed
      tokenExpiresAt: row.token_expires_at,
      scope: row.scope,
      connected: row.connected,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastSyncAt: row.last_sync_at
    }
  }

  /**
   * Normalize provider-specific event to unified format
   */
  private static normalizeEvent(
    providerEvent: any,
    userId: string,
    connectionId: string,
    provider: CalendarProvider
  ): CalendarEvent {
    switch (provider) {
      case 'google':
        return GoogleCalendarClient.normalizeEvent(providerEvent, userId, connectionId)

      case 'microsoft':
        return MicrosoftCalendarClient.normalizeEvent(providerEvent, userId, connectionId)

      case 'apple':
        return AppleCalendarClient.normalizeEvent(providerEvent, userId, connectionId)

      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  /**
   * Save event to database
   */
  private static async saveEvent(event: CalendarEvent): Promise<void> {
    await query(
      `INSERT INTO calendar_events (
        id, user_id, connection_id, provider, provider_event_id,
        title, description, location,
        start_time, end_time, timezone, is_all_day,
        organizer, attendees, meeting_url, conference_data,
        status, visibility, html_link, ical_uid, sequence,
        is_recurring, recurrence_rule, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      ON CONFLICT (user_id, provider, provider_event_id)
      DO UPDATE SET
        title = $6, description = $7, location = $8,
        start_time = $9, end_time = $10, timezone = $11,
        organizer = $13, attendees = $14, meeting_url = $15,
        status = $17, updated_at = $25`,
      [
        event.id, event.userId, event.connectionId, event.provider, event.providerEventId,
        event.title, event.description, event.location,
        event.startTime, event.endTime, event.timezone, event.isAllDay,
        JSON.stringify(event.organizer), JSON.stringify(event.attendees),
        event.meetingUrl, JSON.stringify(event.conferenceData),
        event.status, event.visibility, event.htmlLink, event.icalUid, event.sequence,
        event.isRecurring, event.recurrenceRule, event.createdAt, event.updatedAt
      ]
    )
  }

  /**
   * Update event in database
   */
  private static async updateEventInDb(event: CalendarEvent): Promise<void> {
    await this.saveEvent(event) // Uses ON CONFLICT to update
  }

  /**
   * Calculate free periods from busy periods
   */
  private static calculateFreePeriods(
    startDate: string,
    endDate: string,
    busyPeriods: any[],
    minDurationMinutes: number = 30
  ): Array<{ startTime: string; endTime: string; durationMinutes: number }> {
    // Sort busy periods by start time
    const sorted = busyPeriods.sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )

    const freePeriods: any[] = []
    let currentTime = new Date(startDate)
    const endTime = new Date(endDate)

    for (const busy of sorted) {
      const busyStart = new Date(busy.startTime)

      if (currentTime < busyStart) {
        const durationMs = busyStart.getTime() - currentTime.getTime()
        const durationMinutes = Math.floor(durationMs / 60000)

        if (durationMinutes >= minDurationMinutes) {
          freePeriods.push({
            startTime: currentTime.toISOString(),
            endTime: busyStart.toISOString(),
            durationMinutes
          })
        }
      }

      currentTime = new Date(Math.max(currentTime.getTime(), new Date(busy.endTime).getTime()))
    }

    // Add final free period if exists
    if (currentTime < endTime) {
      const durationMs = endTime.getTime() - currentTime.getTime()
      const durationMinutes = Math.floor(durationMs / 60000)

      if (durationMinutes >= minDurationMinutes) {
        freePeriods.push({
          startTime: currentTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMinutes
        })
      }
    }

    return freePeriods
  }
}
