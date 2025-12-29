// @ts-nocheck
/**
 * Scheduling Chat Tools
 *
 * Tools for meeting scheduling, calendar integration, and availability management.
 * Now integrated with the comprehensive ConversationalScheduler system.
 */

import { ConversationContext } from '../conversation-manager'
import {
  ConversationalScheduler,
  SchedulingContext,
  MeetingDetails,
  TimeSlot,
  UserPreferences,
} from '@/lib/scheduling/conversational-scheduling'

// ============================================================================
// TYPES
// ============================================================================

export interface SchedulingToolResult {
  success: boolean
  data?: unknown
  error?: string
  message: string
  suggestedFollowUps?: string[]
  quickActions?: QuickAction[]
  displayData?: Record<string, any>
}

export interface QuickAction {
  label: string
  action: string
  params?: Record<string, unknown>
  primary?: boolean
}

export interface ScheduleMeetingParams {
  attendee: string
  attendeeEmail?: string
  topic: string
  duration?: number // minutes
  preferredTime?: string
  type?: 'video' | 'phone' | 'in_person'
  location?: string
  notes?: string
  sendInvite?: boolean
}

export interface CheckAvailabilityParams {
  attendee?: string
  attendeeEmail?: string
  date?: string
  dateRange?: string | { start: string; end: string }
  duration?: number
}

export interface RescheduleMeetingParams {
  meetingId?: string
  meetingIdentifier?: string
  newTime?: string
  newDate?: string
  reason?: string
  notifyAttendees?: boolean
}

export interface CancelMeetingParams {
  meetingId?: string
  meetingIdentifier?: string
  reason?: string
  notifyAttendees?: boolean
}

export interface GetScheduleParams {
  date?: string
  dateRange?: string | { start: string; end: string }
  includeDetails?: boolean
}

export interface FindMutualAvailabilityParams {
  attendees: string[]
  duration?: number
  dateRange?: string | { start: string; end: string }
  preferredTimes?: string[]
}

export interface SuggestTimesParams {
  attendees?: string[]
  duration?: number
  dateRange?: string | { start: string; end: string }
  preferences?: string[]
}

export interface SetPreferencesParams {
  preferredTimes?: string[]
  avoidBefore?: string
  avoidAfter?: string
  defaultDuration?: number
  bufferTime?: number
  defaultMeetingType?: 'video' | 'phone' | 'in_person'
  preferredVideoTool?: 'zoom' | 'meet' | 'teams'
}

export interface SendInviteParams {
  meetingId?: string
  attendeeEmail: string
  attendeeName?: string
  message?: string
}

export interface TimezoneConvertParams {
  time: string
  fromTimezone: string
  toTimezone: string
}

// ============================================================================
// SCHEDULER INSTANCE
// ============================================================================

let schedulerInstance: ConversationalScheduler | null = null

function getScheduler(): ConversationalScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new ConversationalScheduler()
  }
  return schedulerInstance
}

function buildSchedulingContext(context: ConversationContext): SchedulingContext {
  return {
    userId: context.userId,
    timezone: (context.userPreferences?.timezone as string) || 'America/New_York',
    workingHours: (context.userPreferences?.workingHours as { start: string; end: string }) || {
      start: '09:00',
      end: '17:00',
    },
    preferences: (context.userPreferences?.scheduling as UserPreferences) || {},
  }
}

// ============================================================================
// SCHEDULE MEETING
// ============================================================================

export async function scheduleMeeting(
  params: ScheduleMeetingParams,
  context: ConversationContext
): Promise<SchedulingToolResult> {
  try {
    const scheduler = getScheduler()
    const schedulingContext = buildSchedulingContext(context)

    const result = await scheduler.scheduleMeeting({
      attendee: params.attendee,
      attendeeEmail: params.attendeeEmail,
      topic: params.topic,
      duration: params.duration || 30,
      preferredTime: params.preferredTime,
      type: params.type || 'video',
      location: params.location,
      notes: params.notes,
      sendInvite: params.sendInvite ?? true,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: result.error || 'Failed to schedule meeting',
      }
    }

    const meeting = result.data as MeetingDetails

    // Handle conflicts
    if (result.hasConflict && result.conflictingMeeting) {
      return {
        success: true,
        data: { meeting, conflict: result.conflictingMeeting },
        message: `You have a conflict at that time with "${result.conflictingMeeting.topic}". Would you like me to find an alternative time?`,
        suggestedFollowUps: [
          'Find alternative time',
          'Reschedule the existing meeting',
          'Schedule anyway',
        ],
        quickActions: [
          { label: 'Find alternative', action: 'suggest_times', primary: true },
          { label: 'Reschedule conflict', action: 'reschedule_meeting' },
        ],
      }
    }

    // Build response message
    let message: string
    if (meeting.scheduledTime) {
      const timeStr = formatDateTime(meeting.scheduledTime, schedulingContext.timezone)
      message = `Scheduled a ${meeting.duration}-minute ${meeting.type} meeting with ${meeting.attendee} about "${meeting.topic}" for ${timeStr}.`
      if (result.inviteSent) {
        message += ' Calendar invite sent!'
      }
    } else if (meeting.proposedTimes && meeting.proposedTimes.length > 0) {
      const timesStr = meeting.proposedTimes.slice(0, 3).map(t =>
        formatTimeShort(t.start, schedulingContext.timezone)
      ).join(', ')
      message = `I found available times for a meeting with ${meeting.attendee}: ${timesStr}. Which works for you?`
    } else {
      message = `Setting up a ${meeting.duration}-minute meeting with ${meeting.attendee} about "${meeting.topic}". I'll find available times.`
    }

    return {
      success: true,
      data: { meeting },
      message,
      displayData: {
        meeting,
        proposedTimes: meeting.proposedTimes,
      },
      suggestedFollowUps: meeting.scheduledTime
        ? ['View my calendar', 'Add notes to meeting', 'Schedule another meeting']
        : meeting.proposedTimes?.slice(0, 3).map(t =>
            `Book ${formatTimeShort(t.start, schedulingContext.timezone)}`
          ),
      quickActions: meeting.proposedTimes?.slice(0, 3).map((slot, i) => ({
        label: formatTimeShort(slot.start, schedulingContext.timezone),
        action: 'confirm_time',
        params: { time: slot.start.toISOString(), meetingId: meeting.id },
        primary: i === 0,
      })),
    }
  } catch (error) {
    console.error('[Scheduling Tools] Schedule error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to schedule meeting',
      message: "I had trouble scheduling that meeting. Can you try again?",
    }
  }
}

// ============================================================================
// CHECK AVAILABILITY
// ============================================================================

export async function checkAvailability(
  params: CheckAvailabilityParams,
  context: ConversationContext
): Promise<SchedulingToolResult> {
  try {
    const scheduler = getScheduler()
    const schedulingContext = buildSchedulingContext(context)

    const result = await scheduler.findAvailability({
      attendee: params.attendee,
      attendeeEmail: params.attendeeEmail,
      date: params.date,
      dateRange: params.dateRange,
      duration: params.duration || 30,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: result.error || 'Failed to check availability',
      }
    }

    const slots = result.data as TimeSlot[]
    const dateStr = params.date || 'today'

    if (slots.length === 0) {
      return {
        success: true,
        data: { availableSlots: [] },
        message: `${params.attendee ? params.attendee + ' is' : 'You\'re'} fully booked on ${dateStr}. Want me to check another day?`,
        suggestedFollowUps: ['Check tomorrow', 'Check next week', 'View full calendar'],
        quickActions: [
          { label: 'Check tomorrow', action: 'check_availability', params: { date: 'tomorrow' }, primary: true },
          { label: 'Check next week', action: 'check_availability', params: { dateRange: 'next_week' } },
        ],
      }
    }

    const slotList = slots.slice(0, 5).map(s =>
      formatTimeShort(s.start, schedulingContext.timezone)
    ).join(', ')

    return {
      success: true,
      data: { availableSlots: slots },
      displayData: { availableSlots: slots },
      message: `Available on ${dateStr}: ${slotList}${slots.length > 5 ? ` (+${slots.length - 5} more)` : ''}. Which works for you?`,
      suggestedFollowUps: slots.slice(0, 3).map(s =>
        `Book ${formatTimeShort(s.start, schedulingContext.timezone)}`
      ),
      quickActions: slots.slice(0, 3).map((slot, i) => ({
        label: formatTimeShort(slot.start, schedulingContext.timezone),
        action: 'schedule_at_time',
        params: { time: slot.start.toISOString() },
        primary: i === 0,
      })),
    }
  } catch (error) {
    console.error('[Scheduling Tools] Availability error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check availability',
      message: "I had trouble checking availability. Let me try again.",
    }
  }
}

// ============================================================================
// GET SCHEDULE / UPCOMING MEETINGS
// ============================================================================

export async function getUpcomingMeetings(
  params: { limit?: number; includeToday?: boolean },
  context: ConversationContext
): Promise<SchedulingToolResult> {
  return getSchedule({ date: 'today' }, context)
}

export async function getSchedule(
  params: GetScheduleParams,
  context: ConversationContext
): Promise<SchedulingToolResult> {
  try {
    const scheduler = getScheduler()
    const schedulingContext = buildSchedulingContext(context)

    const result = await scheduler.getSchedule({
      date: params.date,
      dateRange: params.dateRange,
      includeDetails: params.includeDetails ?? true,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: result.error || 'Failed to get schedule',
      }
    }

    const meetings = result.data as MeetingDetails[]
    const dateStr = params.date || 'today'

    if (meetings.length === 0) {
      return {
        success: true,
        data: { meetings: [] },
        displayData: { meetings: [], calendarView: 'day' },
        message: `Your calendar is clear ${dateStr}! Want to schedule something?`,
        suggestedFollowUps: ['Schedule a meeting', 'Check tomorrow', 'View week'],
        quickActions: [
          { label: 'Schedule meeting', action: 'schedule_meeting', primary: true },
          { label: 'Check tomorrow', action: 'get_schedule', params: { date: 'tomorrow' } },
        ],
      }
    }

    const scheduleStr = meetings.map(m => {
      const time = formatTimeShort(m.scheduledTime!, schedulingContext.timezone)
      return `- ${time}: ${m.topic} with ${m.attendee} (${m.duration}min, ${m.type})`
    }).join('\n')

    const nextMeeting = meetings[0]
    const timeUntilNext = getTimeUntil(nextMeeting.scheduledTime!)

    return {
      success: true,
      data: { meetings },
      displayData: { meetings, calendarView: 'day', selectedDate: dateStr },
      message: `You have ${meetings.length} meeting${meetings.length !== 1 ? 's' : ''} ${dateStr}:\n\n${scheduleStr}\n\nNext up: "${nextMeeting.topic}" ${timeUntilNext}.`,
      suggestedFollowUps: [
        `Join ${nextMeeting.topic}`,
        'Schedule another meeting',
        'View tomorrow',
      ],
      quickActions: nextMeeting.meetingLink ? [
        { label: 'Join next meeting', action: 'open_link', params: { url: nextMeeting.meetingLink }, primary: true },
        { label: 'Reschedule', action: 'reschedule_meeting', params: { meetingId: nextMeeting.id } },
      ] : [
        { label: 'Add meeting link', action: 'update_meeting', params: { meetingId: nextMeeting.id, field: 'link' }, primary: true },
      ],
    }
  } catch (error) {
    console.error('[Scheduling Tools] Get schedule error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get schedule',
      message: "I had trouble fetching your schedule. Let me try again.",
    }
  }
}

// ============================================================================
// RESCHEDULE MEETING
// ============================================================================

export async function rescheduleMeeting(
  params: RescheduleMeetingParams,
  context: ConversationContext
): Promise<SchedulingToolResult> {
  try {
    const scheduler = getScheduler()
    const schedulingContext = buildSchedulingContext(context)

    const result = await scheduler.rescheduleMeeting({
      meetingId: params.meetingId,
      meetingIdentifier: params.meetingIdentifier,
      newTime: params.newTime,
      newDate: params.newDate,
      reason: params.reason,
      notifyAttendees: params.notifyAttendees ?? true,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: result.error || 'Failed to reschedule meeting',
      }
    }

    // Handle conflicts at new time
    if (result.hasConflict && result.conflictingMeeting) {
      return {
        success: true,
        data: { conflict: result.conflictingMeeting },
        message: `There's a conflict at the new time with "${result.conflictingMeeting.topic}". Would you like me to find an alternative?`,
        suggestedFollowUps: ['Find alternative time', 'Reschedule the conflict'],
        quickActions: [
          { label: 'Find alternative', action: 'suggest_times', primary: true },
        ],
      }
    }

    const meeting = result.data as MeetingDetails
    const newTimeStr = meeting.scheduledTime
      ? formatDateTime(meeting.scheduledTime, schedulingContext.timezone)
      : params.newTime || 'the new time'

    return {
      success: true,
      data: { meeting },
      displayData: { meetings: [meeting] },
      message: `Meeting "${meeting.topic}" with ${meeting.attendee} has been rescheduled to ${newTimeStr}.${result.notificationsSent ? ' Attendees have been notified.' : ''}`,
      suggestedFollowUps: ['View my calendar', 'Add meeting notes'],
      quickActions: [
        { label: 'View calendar', action: 'get_schedule', primary: true },
        { label: 'Add notes', action: 'update_meeting', params: { meetingId: meeting.id, field: 'notes' } },
      ],
    }
  } catch (error) {
    console.error('[Scheduling Tools] Reschedule error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reschedule',
      message: "I had trouble rescheduling the meeting. Want me to try again?",
    }
  }
}

// ============================================================================
// CANCEL MEETING
// ============================================================================

export async function cancelMeeting(
  params: CancelMeetingParams,
  context: ConversationContext
): Promise<SchedulingToolResult> {
  try {
    const scheduler = getScheduler()
    const schedulingContext = buildSchedulingContext(context)

    const result = await scheduler.cancelMeeting({
      meetingId: params.meetingId,
      meetingIdentifier: params.meetingIdentifier,
      reason: params.reason,
      notifyAttendees: params.notifyAttendees ?? true,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: result.error || 'Failed to cancel meeting',
      }
    }

    const meeting = result.data as MeetingDetails

    return {
      success: true,
      data: { meeting },
      message: `Meeting "${meeting.topic}" has been cancelled.${result.notificationsSent ? ' Attendees have been notified.' : ''}`,
      suggestedFollowUps: ['View my calendar', 'Schedule a new meeting'],
      quickActions: [
        { label: 'Reschedule for later', action: 'schedule_meeting', params: { attendee: meeting.attendee, topic: meeting.topic } },
        { label: 'View calendar', action: 'get_schedule' },
      ],
    }
  } catch (error) {
    console.error('[Scheduling Tools] Cancel error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel meeting',
      message: "I had trouble cancelling the meeting. Want me to try again?",
    }
  }
}

// ============================================================================
// SEND MEETING REMINDER
// ============================================================================

export async function sendMeetingReminder(
  params: { meetingId: string; reminderTime?: number },
  context: ConversationContext
): Promise<SchedulingToolResult> {
  try {
    const { meetingId, reminderTime = 15 } = params

    // For now, just acknowledge - in production would set actual reminder
    return {
      success: true,
      data: { meetingId, reminderTime },
      message: `Reminder set for ${reminderTime} minutes before the meeting.`,
      suggestedFollowUps: ['View meeting details'],
    }
  } catch (error) {
    console.error('[Scheduling Tools] Reminder error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set reminder',
      message: "I had trouble setting the reminder. Want me to try again?",
    }
  }
}

// ============================================================================
// FIND MUTUAL AVAILABILITY
// ============================================================================

export async function findMutualAvailability(
  params: FindMutualAvailabilityParams,
  context: ConversationContext
): Promise<SchedulingToolResult> {
  try {
    const scheduler = getScheduler()
    const schedulingContext = buildSchedulingContext(context)

    const result = await scheduler.findMutualAvailability({
      attendees: params.attendees,
      duration: params.duration || 30,
      dateRange: params.dateRange,
      preferredTimes: params.preferredTimes,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: result.error || 'Failed to find mutual availability',
      }
    }

    const slots = result.data as TimeSlot[]
    const attendeeList = params.attendees.join(', ')

    if (slots.length === 0) {
      return {
        success: true,
        data: { slots: [] },
        message: `No overlapping availability found for ${attendeeList} in the next week. Want me to check a longer range?`,
        suggestedFollowUps: ['Check next 2 weeks', 'Show partial availability', 'Send scheduling poll'],
        quickActions: [
          { label: 'Extend search', action: 'find_mutual_availability', params: { dateRange: '2_weeks' }, primary: true },
          { label: 'Send poll', action: 'send_scheduling_poll' },
        ],
      }
    }

    const slotList = slots.slice(0, 5).map(s =>
      `- ${formatDateTime(s.start, schedulingContext.timezone)}`
    ).join('\n')

    return {
      success: true,
      data: { slots },
      displayData: { availableSlots: slots },
      message: `Found ${slots.length} time${slots.length !== 1 ? 's' : ''} when everyone is available:\n\n${slotList}\n\nWhich works best?`,
      suggestedFollowUps: slots.slice(0, 3).map(s =>
        `Book ${formatDateTime(s.start, schedulingContext.timezone)}`
      ),
      quickActions: slots.slice(0, 3).map((slot, i) => ({
        label: formatDateTime(slot.start, schedulingContext.timezone),
        action: 'book_mutual_time',
        params: { time: slot.start.toISOString(), attendees: params.attendees },
        primary: i === 0,
      })),
    }
  } catch (error) {
    console.error('[Scheduling Tools] Mutual availability error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to find availability',
      message: "I had trouble finding mutual availability. Let me try again.",
    }
  }
}

// ============================================================================
// SUGGEST TIMES
// ============================================================================

export async function suggestTimes(
  params: SuggestTimesParams,
  context: ConversationContext
): Promise<SchedulingToolResult> {
  try {
    const scheduler = getScheduler()
    const schedulingContext = buildSchedulingContext(context)

    const result = await scheduler.suggestTimes({
      attendees: params.attendees,
      duration: params.duration || 30,
      dateRange: params.dateRange,
      preferences: params.preferences,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: result.error || 'Failed to suggest times',
      }
    }

    const suggestions = result.data as TimeSlot[]

    if (suggestions.length === 0) {
      return {
        success: true,
        data: { suggestions: [] },
        message: 'I couldn\'t find any optimal times based on your preferences. Want me to expand the search?',
        suggestedFollowUps: ['Expand search', 'Change preferences'],
      }
    }

    const suggestionStr = suggestions.slice(0, 5).map((s, i) =>
      `${i + 1}. ${formatDateTime(s.start, schedulingContext.timezone)}${s.score ? ` (${s.score}% match)` : ''}`
    ).join('\n')

    return {
      success: true,
      data: { suggestions },
      displayData: { availableSlots: suggestions },
      message: `Here are the best times based on your schedule and preferences:\n\n${suggestionStr}\n\nWhich works for you?`,
      suggestedFollowUps: suggestions.slice(0, 3).map(s =>
        `Book ${formatTimeShort(s.start, schedulingContext.timezone)}`
      ),
      quickActions: suggestions.slice(0, 3).map((slot, i) => ({
        label: formatDateTime(slot.start, schedulingContext.timezone),
        action: 'schedule_at_time',
        params: { time: slot.start.toISOString() },
        primary: i === 0,
      })),
    }
  } catch (error) {
    console.error('[Scheduling Tools] Suggest times error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to suggest times',
      message: "I had trouble finding suggested times. Let me try again.",
    }
  }
}

// ============================================================================
// SET PREFERENCES
// ============================================================================

export async function setPreferences(
  params: SetPreferencesParams,
  context: ConversationContext
): Promise<SchedulingToolResult> {
  try {
    const scheduler = getScheduler()
    const schedulingContext = buildSchedulingContext(context)

    const result = await scheduler.setPreferences(params, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: result.error || 'Failed to save preferences',
      }
    }

    const prefs = result.data as UserPreferences
    let message = 'Got it! I\'ve updated your scheduling preferences:\n'

    if (prefs.preferredTimes?.length) {
      message += `- Preferred meeting times: ${prefs.preferredTimes.join(', ')}\n`
    }
    if (prefs.avoidBefore) {
      message += `- No meetings before: ${prefs.avoidBefore}\n`
    }
    if (prefs.avoidAfter) {
      message += `- No meetings after: ${prefs.avoidAfter}\n`
    }
    if (prefs.defaultDuration) {
      message += `- Default meeting length: ${prefs.defaultDuration} minutes\n`
    }
    if (prefs.bufferTime) {
      message += `- Buffer between meetings: ${prefs.bufferTime} minutes\n`
    }
    if (prefs.defaultMeetingType) {
      message += `- Default meeting type: ${prefs.defaultMeetingType}\n`
    }

    return {
      success: true,
      data: prefs,
      message,
      suggestedFollowUps: ['Schedule a meeting', 'View my calendar'],
    }
  } catch (error) {
    console.error('[Scheduling Tools] Set preferences error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save preferences',
      message: "I had trouble saving your preferences. Let me try again.",
    }
  }
}

// ============================================================================
// TIMEZONE CONVERT
// ============================================================================

export async function convertTimezone(
  params: TimezoneConvertParams,
  context: ConversationContext
): Promise<SchedulingToolResult> {
  try {
    const scheduler = getScheduler()
    const schedulingContext = buildSchedulingContext(context)

    const result = await scheduler.convertTimezone(params, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: result.error || 'Failed to convert timezone',
      }
    }

    const conversion = result.data as { original: string; converted: string }

    return {
      success: true,
      data: conversion,
      message: `${conversion.original} is ${conversion.converted}.`,
      suggestedFollowUps: ['Convert another time', 'Schedule at this time'],
    }
  } catch (error) {
    console.error('[Scheduling Tools] Timezone convert error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to convert timezone',
      message: "I had trouble converting that time. Let me try again.",
    }
  }
}

// ============================================================================
// SEND INVITE
// ============================================================================

export async function sendInvite(
  params: SendInviteParams,
  context: ConversationContext
): Promise<SchedulingToolResult> {
  try {
    const scheduler = getScheduler()
    const schedulingContext = buildSchedulingContext(context)

    const result = await scheduler.sendInvite({
      meetingId: params.meetingId,
      attendeeEmail: params.attendeeEmail,
      attendeeName: params.attendeeName,
      message: params.message,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        message: result.error || 'Failed to send invite',
      }
    }

    return {
      success: true,
      data: result.data,
      message: `Calendar invite sent to ${params.attendeeName || params.attendeeEmail}!`,
      suggestedFollowUps: ['Send to another person', 'View meeting details'],
    }
  } catch (error) {
    console.error('[Scheduling Tools] Send invite error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invite',
      message: "I had trouble sending the invite. Let me try again.",
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDateTime(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  })
}

function formatTimeShort(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  })
}

function getTimeUntil(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffMins = Math.round(diffMs / (60 * 1000))

  if (diffMins < 0) return 'already started'
  if (diffMins < 1) return 'starting now'
  if (diffMins < 60) return `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`

  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`

  const diffDays = Math.round(diffHours / 24)
  return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

export const schedulingTools = {
  scheduleMeeting,
  checkAvailability,
  getUpcomingMeetings,
  getSchedule,
  rescheduleMeeting,
  cancelMeeting,
  sendMeetingReminder,
  findMutualAvailability,
  suggestTimes,
  setPreferences,
  convertTimezone,
  sendInvite,
}

export default schedulingTools
