/**
 * Calendar Integration - Main Export
 *
 * Unified calendar system supporting Google Calendar, Microsoft Outlook/365, and Apple Calendar
 */

// Export unified service (main entry point)
export { UnifiedCalendarService } from './unified'

// Export types
export * from './types'

// Export OAuth utilities (for setup/debugging)
export {
  generateAuthorizationUrl,
  validateOAuthConfig,
  needsTokenRefresh
} from './oauth'

// Export provider clients (for advanced usage)
export { GoogleCalendarClient } from './google'
export { MicrosoftCalendarClient } from './microsoft'
export { AppleCalendarClient } from './apple'

/**
 * Usage Example:
 *
 * ```typescript
 * import { UnifiedCalendarService } from '@/lib/integrations/calendar'
 *
 * // Create event
 * const event = await UnifiedCalendarService.createEvent(userId, {
 *   title: 'Team Meeting',
 *   startTime: '2025-01-20T14:00:00Z',
 *   endTime: '2025-01-20T15:00:00Z',
 *   attendees: [{ email: 'john@example.com' }],
 *   addConference: true
 * })
 *
 * // Check availability
 * const availability = await UnifiedCalendarService.checkAvailability(userId, {
 *   startDate: '2025-01-20T00:00:00Z',
 *   endDate: '2025-01-27T00:00:00Z',
 *   durationMinutes: 30
 * })
 *
 * // List events
 * const events = await UnifiedCalendarService.listEvents(userId, {
 *   startDate: '2025-01-01T00:00:00Z',
 *   endDate: '2025-02-01T00:00:00Z'
 * })
 * ```
 */
