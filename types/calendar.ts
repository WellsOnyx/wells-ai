/**
 * Calendar Integration Types
 */

export type CalendarProvider = 'calcom' | 'google' | 'outlook'

export type BookingStatus = 'pending' | 'accepted' | 'cancelled'

export interface CalendarAttendee {
  email: string
  name?: string
  responseStatus?: 'needsAction' | 'accepted' | 'declined' | 'tentative'
}

export interface CalendarEvent {
  title: string
  description?: string
  startTime: string // ISO 8601
  endTime?: string
  durationMinutes?: number
  attendees: CalendarAttendee[]
  location?: string
  timezone?: string
}

export interface CalendarBooking {
  id: string
  uid: string
  title: string
  description?: string
  startTime: string
  endTime: string
  attendees: CalendarAttendee[]
  status: BookingStatus
  meetingUrl?: string
  location?: string
  timezone?: string
  createdAt?: string
  updatedAt?: string
  cancelledAt?: string
}

export interface CalendarConnection {
  id: string
  userId: string
  provider: CalendarProvider
  connected: boolean
  calendarEmail?: string
  calendarName?: string
  lastSyncAt?: Date
  syncEnabled?: boolean
}

export interface CalendarAvailabilitySlot {
  start: string // ISO 8601
  end: string // ISO 8601
  available: boolean
}

export interface WorkingHours {
  monday: DaySchedule
  tuesday: DaySchedule
  wednesday: DaySchedule
  thursday: DaySchedule
  friday: DaySchedule
  saturday: DaySchedule
  sunday: DaySchedule
}

export interface DaySchedule {
  enabled: boolean
  start: string // HH:mm format (e.g., "09:00")
  end: string // HH:mm format (e.g., "17:00")
}

export interface CalendarAvailabilitySettings {
  id: string
  userId: string
  workingHours: WorkingHours
  timezone: string
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  minimumNoticeHours: number
  maxBookingsPerDay: number
}

export interface CalendarAPIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ScheduleMeetingRequest {
  title: string
  description?: string
  startTime: string
  endTime?: string
  durationMinutes?: number
  attendees: Array<{
    email: string
    name?: string
  }>
  location?: string
  timezone?: string
}

export interface ScheduleMeetingResponse {
  success: boolean
  booking?: CalendarBooking
  error?: string
}

export interface ConnectCalendarRequest {
  apiKey: string
  provider?: CalendarProvider
}

export interface ConnectCalendarResponse {
  success: boolean
  connection?: {
    provider: CalendarProvider
    connected: boolean
    calendarEmail?: string
    lastSyncAt?: Date
  }
  error?: string
}

export interface CalendarStatusResponse {
  connected: boolean
  provider: CalendarProvider | null
  calendarEmail: string | null
  lastSyncAt?: Date
}

export interface RescheduleMeetingRequest {
  bookingId: string
  newStartTime: string
  newEndTime?: string
}

export interface CancelMeetingRequest {
  bookingId: string
  reason?: string
}

// Cal.com specific types
export interface CalcomEventType {
  id: number
  title: string
  slug: string
  length: number
  description?: string
}

export interface CalcomBookingResponse {
  id: string
  uid: string
  title: string
  description?: string
  startTime: string
  endTime: string
  attendees: Array<{
    email: string
    name: string
    timeZone: string
  }>
  status: string
  location?: string
  metadata?: {
    videoCallUrl?: string
    conferenceId?: string
  }
}

export interface CalcomAvailabilityResponse {
  slots: Array<{
    time: string
    date: string
    users?: string[]
  }>
  busy?: Array<{
    start: string
    end: string
  }>
}

export interface CalcomMeResponse {
  id: number
  username: string
  email: string
  name?: string
  bio?: string
  avatar?: string
  timeZone: string
  weekStart: string
  brandColor?: string
}

// Error types
export class CalendarError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'CalendarError'
  }
}

export class CalendarConnectionError extends CalendarError {
  constructor(message: string) {
    super(message, 'CALENDAR_NOT_CONNECTED', 401)
    this.name = 'CalendarConnectionError'
  }
}

export class CalendarRateLimitError extends CalendarError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429)
    this.name = 'CalendarRateLimitError'
  }
}

export class CalendarAPIError extends CalendarError {
  constructor(message: string, statusCode?: number) {
    super(message, 'API_ERROR', statusCode)
    this.name = 'CalendarAPIError'
  }
}
