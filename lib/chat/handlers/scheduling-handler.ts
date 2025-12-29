// @ts-nocheck
/**
 * Scheduling Intent Handler
 *
 * Handles all scheduling-related intents from natural conversation:
 * - Schedule meetings ("Set up a call with John next week")
 * - Find availability ("When is John free?")
 * - Find mutual availability ("Find time that works for me and the Acme team")
 * - Reschedule meetings ("Move my 3pm to tomorrow")
 * - Cancel meetings ("Cancel my meeting with Sarah")
 * - Get daily schedule ("What's on my calendar today?")
 * - Set meeting preferences ("I prefer morning meetings")
 * - Timezone conversions ("What time is 3pm EST in PST?")
 * - Send calendar invites ("Send Sarah a meeting invite")
 */

import { ConversationContext } from '../conversation-manager'
import { IntentClassification, ExtractedEntities } from '../intent-router'
import {
  ConversationalScheduler,
  SchedulingContext,
  SchedulingResult,
  MeetingDetails,
  TimeSlot,
  UserPreferences,
} from '@/lib/scheduling/conversational-scheduling'

// ============================================================================
// TYPES
// ============================================================================

export interface SchedulingHandlerResult {
  success: boolean
  message: string
  data?: any
  suggestedFollowUps?: string[]
  quickActions?: QuickAction[]
  displayData?: SchedulingDisplayData
  requiresConfirmation?: boolean
  confirmationMessage?: string
}

export interface QuickAction {
  label: string
  action: string
  params?: Record<string, unknown>
  primary?: boolean
}

export interface SchedulingDisplayData {
  meetings?: MeetingDetails[]
  availableSlots?: TimeSlot[]
  conflict?: {
    existingMeeting: MeetingDetails
    requestedTime: Date
  }
  calendarView?: 'day' | 'week' | 'month'
  selectedDate?: string
}

export type SchedulingIntent =
  | 'schedule_meeting'
  | 'find_availability'
  | 'find_mutual_availability'
  | 'reschedule_meeting'
  | 'cancel_meeting'
  | 'get_schedule'
  | 'set_preferences'
  | 'timezone_convert'
  | 'send_invite'
  | 'check_conflicts'
  | 'suggest_times'
  | 'add_attendee'
  | 'remove_attendee'
  | 'update_meeting'

// ============================================================================
// INTENT PATTERNS
// ============================================================================

export const SCHEDULING_PATTERNS: Record<SchedulingIntent, string[]> = {
  schedule_meeting: [
    'schedule', 'set up', 'book', 'arrange', 'plan a meeting',
    'call with', 'meet with', 'meeting with', 'sync with',
    'put time on', 'block time', 'calendar invite'
  ],
  find_availability: [
    'when is', 'when are', 'available', 'free', 'open slots',
    'what times', 'check availability', 'see availability'
  ],
  find_mutual_availability: [
    'works for everyone', 'mutual availability', 'find time for all',
    'works for both', 'all available', 'everyone free',
    'time that works for', 'coordinate', 'group availability'
  ],
  reschedule_meeting: [
    'reschedule', 'move', 'change time', 'push back', 'push forward',
    'postpone', 'delay', 'earlier', 'later', 'different time'
  ],
  cancel_meeting: [
    'cancel', 'delete', 'remove', 'decline', 'skip', 'won\'t make it',
    'can\'t attend', 'drop the meeting'
  ],
  get_schedule: [
    'what\'s on', 'calendar', 'schedule for', 'meetings today',
    'what do i have', 'upcoming meetings', 'agenda', 'my day',
    'busy', 'show my'
  ],
  set_preferences: [
    'prefer', 'preference', 'i like', 'default', 'always',
    'morning meetings', 'afternoon meetings', 'no meetings before',
    'no meetings after', 'buffer time'
  ],
  timezone_convert: [
    'timezone', 'time zone', 'what time is', 'convert time',
    'in est', 'in pst', 'in utc', 'local time'
  ],
  send_invite: [
    'send invite', 'invite to', 'add to calendar', 'calendar invite',
    'send calendar', 'share meeting'
  ],
  check_conflicts: [
    'conflict', 'double booked', 'overlap', 'clash', 'busy at'
  ],
  suggest_times: [
    'suggest times', 'when should', 'best time', 'recommend time',
    'good time to', 'optimal time'
  ],
  add_attendee: [
    'add to meeting', 'include', 'invite also', 'add attendee'
  ],
  remove_attendee: [
    'remove from meeting', 'uninvite', 'take off meeting'
  ],
  update_meeting: [
    'update meeting', 'change description', 'add notes', 'update notes',
    'change location', 'change link'
  ],
}

// ============================================================================
// SCHEDULING HANDLER CLASS
// ============================================================================

export class SchedulingHandler {
  private scheduler: ConversationalScheduler

  constructor() {
    this.scheduler = new ConversationalScheduler()
  }

  /**
   * Main entry point - handle a scheduling-related intent
   */
  async handleIntent(
    intent: IntentClassification,
    message: string,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    const schedulingIntent = this.detectSchedulingIntent(message, intent)
    const entities = this.extractSchedulingEntities(message, intent.entities)

    const schedulingContext: SchedulingContext = {
      userId: context.userId,
      timezone: context.userPreferences?.timezone as string || 'America/New_York',
      workingHours: context.userPreferences?.workingHours as { start: string; end: string } || {
        start: '09:00',
        end: '17:00'
      },
      preferences: context.userPreferences?.scheduling as UserPreferences || {},
    }

    switch (schedulingIntent) {
      case 'schedule_meeting':
        return this.handleScheduleMeeting(entities, schedulingContext, context)

      case 'find_availability':
        return this.handleFindAvailability(entities, schedulingContext, context)

      case 'find_mutual_availability':
        return this.handleFindMutualAvailability(entities, schedulingContext, context)

      case 'reschedule_meeting':
        return this.handleRescheduleMeeting(entities, schedulingContext, context)

      case 'cancel_meeting':
        return this.handleCancelMeeting(entities, schedulingContext, context)

      case 'get_schedule':
        return this.handleGetSchedule(entities, schedulingContext, context)

      case 'set_preferences':
        return this.handleSetPreferences(message, schedulingContext, context)

      case 'timezone_convert':
        return this.handleTimezoneConvert(entities, schedulingContext, context)

      case 'send_invite':
        return this.handleSendInvite(entities, schedulingContext, context)

      case 'check_conflicts':
        return this.handleCheckConflicts(entities, schedulingContext, context)

      case 'suggest_times':
        return this.handleSuggestTimes(entities, schedulingContext, context)

      case 'add_attendee':
        return this.handleAddAttendee(entities, schedulingContext, context)

      case 'remove_attendee':
        return this.handleRemoveAttendee(entities, schedulingContext, context)

      case 'update_meeting':
        return this.handleUpdateMeeting(entities, schedulingContext, context)

      default:
        return this.handleUnknownSchedulingRequest(message, schedulingContext, context)
    }
  }

  // ============================================================================
  // INTENT HANDLERS
  // ============================================================================

  private async handleScheduleMeeting(
    entities: SchedulingEntities,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    // Validate required information
    if (!entities.attendee && !entities.attendeeEmail) {
      return {
        success: true,
        message: 'Who would you like to meet with?',
        suggestedFollowUps: ['Search contacts', 'Enter email address'],
      }
    }

    if (!entities.topic) {
      return {
        success: true,
        message: `Got it, a meeting with ${entities.attendee || entities.attendeeEmail}. What's this meeting about?`,
        suggestedFollowUps: ['Quick sync', 'Project review', 'Introductory call'],
      }
    }

    const result = await this.scheduler.scheduleMeeting({
      attendee: entities.attendee || '',
      attendeeEmail: entities.attendeeEmail,
      topic: entities.topic,
      duration: entities.duration || 30,
      preferredTime: entities.preferredTime,
      type: entities.meetingType || 'video',
      location: entities.location,
      notes: entities.notes,
      sendInvite: entities.sendInvite ?? true,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble scheduling that meeting.',
        suggestedFollowUps: ['Try a different time', 'Check my availability'],
      }
    }

    const meeting = result.data as MeetingDetails

    // Check for conflicts
    if (result.hasConflict) {
      return {
        success: true,
        message: `You have a conflict at that time. You already have "${result.conflictingMeeting?.topic}" scheduled. Would you like me to find an alternative time or reschedule the existing meeting?`,
        requiresConfirmation: true,
        confirmationMessage: 'Schedule anyway and create an overlap?',
        displayData: {
          conflict: {
            existingMeeting: result.conflictingMeeting!,
            requestedTime: new Date(entities.preferredTime || ''),
          },
        },
        quickActions: [
          { label: 'Find alternative time', action: 'suggest_times', primary: true },
          { label: 'Reschedule existing meeting', action: 'reschedule_meeting' },
          { label: 'Schedule anyway', action: 'force_schedule' },
        ],
      }
    }

    // Build response message
    let message = ''
    if (meeting.scheduledTime) {
      const timeStr = this.formatDateTime(meeting.scheduledTime, schedulingContext.timezone)
      message = `Scheduled a ${meeting.duration}-minute ${meeting.type} meeting with ${meeting.attendee} about "${meeting.topic}" for ${timeStr}.`
      if (meeting.inviteSent) {
        message += ' Calendar invite sent!'
      }
    } else if (meeting.proposedTimes && meeting.proposedTimes.length > 0) {
      message = `I found ${meeting.proposedTimes.length} available times for a meeting with ${meeting.attendee}. Which works best for you?`
    } else {
      message = `Setting up a ${meeting.duration}-minute meeting with ${meeting.attendee} about "${meeting.topic}". I'll find available times.`
    }

    return {
      success: true,
      message,
      data: meeting,
      displayData: {
        meetings: [meeting],
        availableSlots: meeting.proposedTimes,
      },
      suggestedFollowUps: meeting.scheduledTime
        ? ['Add notes', 'View my calendar', 'Schedule another meeting']
        : meeting.proposedTimes?.slice(0, 3).map(slot =>
            `Book ${this.formatDateTime(slot.start, schedulingContext.timezone)}`
          ),
      quickActions: meeting.proposedTimes?.slice(0, 3).map((slot, i) => ({
        label: this.formatTimeShort(slot.start, schedulingContext.timezone),
        action: 'confirm_time',
        params: { slotIndex: i, meetingId: meeting.id },
        primary: i === 0,
      })),
    }
  }

  private async handleFindAvailability(
    entities: SchedulingEntities,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    const result = await this.scheduler.findAvailability({
      attendee: entities.attendee,
      attendeeEmail: entities.attendeeEmail,
      date: entities.date,
      dateRange: entities.dateRange,
      duration: entities.duration || 30,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble checking availability.',
        suggestedFollowUps: ['Check a different date', 'View my calendar'],
      }
    }

    const slots = result.data as TimeSlot[]
    const dateStr = entities.date
      ? this.formatDate(new Date(entities.date), schedulingContext.timezone)
      : 'the requested time'

    if (slots.length === 0) {
      return {
        success: true,
        message: `${entities.attendee ? entities.attendee + ' is' : 'You\'re'} fully booked on ${dateStr}. Want me to check another day?`,
        displayData: { availableSlots: [] },
        suggestedFollowUps: ['Check tomorrow', 'Check next week', 'View full calendar'],
        quickActions: [
          { label: 'Check tomorrow', action: 'find_availability', params: { date: 'tomorrow' }, primary: true },
          { label: 'Check next week', action: 'find_availability', params: { date: 'next_week' } },
        ],
      }
    }

    const slotListStr = slots.slice(0, 5).map(s =>
      this.formatTimeShort(s.start, schedulingContext.timezone)
    ).join(', ')

    return {
      success: true,
      message: `Available on ${dateStr}: ${slotListStr}. ${slots.length > 5 ? `(+${slots.length - 5} more slots)` : ''} Which works for you?`,
      data: slots,
      displayData: { availableSlots: slots },
      suggestedFollowUps: slots.slice(0, 3).map(s =>
        `Book ${this.formatTimeShort(s.start, schedulingContext.timezone)}`
      ),
      quickActions: slots.slice(0, 3).map((slot, i) => ({
        label: this.formatTimeShort(slot.start, schedulingContext.timezone),
        action: 'schedule_at_time',
        params: { time: slot.start },
        primary: i === 0,
      })),
    }
  }

  private async handleFindMutualAvailability(
    entities: SchedulingEntities,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    if (!entities.attendees || entities.attendees.length === 0) {
      return {
        success: true,
        message: 'Who all needs to be in this meeting?',
        suggestedFollowUps: ['Search team members', 'Enter email addresses'],
      }
    }

    const result = await this.scheduler.findMutualAvailability({
      attendees: entities.attendees,
      duration: entities.duration || 30,
      dateRange: entities.dateRange,
      preferredTimes: entities.preferredTimes,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble finding mutual availability.',
        suggestedFollowUps: ['Try a different date range', 'Reduce attendees'],
      }
    }

    const slots = result.data as TimeSlot[]
    const attendeeList = entities.attendees.join(', ')

    if (slots.length === 0) {
      return {
        success: true,
        message: `No overlapping availability found for ${attendeeList} in the next week. Want me to check a longer range or suggest times when most people are free?`,
        displayData: { availableSlots: [] },
        suggestedFollowUps: [
          'Check next 2 weeks',
          'Show partial availability',
          'Send scheduling poll'
        ],
        quickActions: [
          { label: 'Extend search', action: 'find_mutual_availability', params: { dateRange: '2_weeks' }, primary: true },
          { label: 'Send poll', action: 'send_scheduling_poll' },
        ],
      }
    }

    return {
      success: true,
      message: `Found ${slots.length} time${slots.length !== 1 ? 's' : ''} when everyone is available:\n\n${slots.slice(0, 5).map(s => `- ${this.formatDateTime(s.start, schedulingContext.timezone)}`).join('\n')}\n\nWhich works best?`,
      data: slots,
      displayData: { availableSlots: slots },
      suggestedFollowUps: slots.slice(0, 3).map(s =>
        `Book ${this.formatDateTime(s.start, schedulingContext.timezone)}`
      ),
      quickActions: slots.slice(0, 3).map((slot, i) => ({
        label: this.formatDateTime(slot.start, schedulingContext.timezone),
        action: 'book_mutual_time',
        params: { time: slot.start, attendees: entities.attendees },
        primary: i === 0,
      })),
    }
  }

  private async handleRescheduleMeeting(
    entities: SchedulingEntities,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    // If no meeting identified, try to find it
    if (!entities.meetingId && !entities.meetingIdentifier) {
      // Check context for recently discussed meeting
      const recentMeeting = this.findRecentMeetingInContext(context)
      if (recentMeeting) {
        entities.meetingId = recentMeeting.id
      } else {
        return {
          success: true,
          message: 'Which meeting would you like to reschedule?',
          suggestedFollowUps: ['Show my upcoming meetings', 'My next meeting'],
        }
      }
    }

    const result = await this.scheduler.rescheduleMeeting({
      meetingId: entities.meetingId,
      meetingIdentifier: entities.meetingIdentifier,
      newTime: entities.newTime,
      newDate: entities.newDate,
      reason: entities.reason,
      notifyAttendees: entities.notifyAttendees ?? true,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble rescheduling that meeting.',
        suggestedFollowUps: ['Try a different time', 'View meeting details'],
      }
    }

    const meeting = result.data as MeetingDetails
    const newTimeStr = meeting.scheduledTime
      ? this.formatDateTime(meeting.scheduledTime, schedulingContext.timezone)
      : entities.newTime || 'the new time'

    return {
      success: true,
      message: `Meeting "${meeting.topic}" with ${meeting.attendee} has been rescheduled to ${newTimeStr}.${result.notificationsSent ? ' Attendees have been notified.' : ''}`,
      data: meeting,
      displayData: { meetings: [meeting] },
      suggestedFollowUps: ['View my calendar', 'Add meeting notes'],
      quickActions: [
        { label: 'View calendar', action: 'get_schedule', primary: true },
        { label: 'Add notes', action: 'update_meeting', params: { meetingId: meeting.id, field: 'notes' } },
      ],
    }
  }

  private async handleCancelMeeting(
    entities: SchedulingEntities,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    // If no meeting identified, try to find it
    if (!entities.meetingId && !entities.meetingIdentifier) {
      const recentMeeting = this.findRecentMeetingInContext(context)
      if (recentMeeting) {
        entities.meetingId = recentMeeting.id
      } else {
        return {
          success: true,
          message: 'Which meeting would you like to cancel?',
          suggestedFollowUps: ['Show my upcoming meetings', 'My next meeting'],
        }
      }
    }

    // Always require confirmation for cancellations
    if (!entities.confirmed) {
      const meetingInfo = entities.meetingIdentifier || 'this meeting'
      return {
        success: true,
        message: `Are you sure you want to cancel ${meetingInfo}? Attendees will be notified.`,
        requiresConfirmation: true,
        confirmationMessage: 'Yes, cancel the meeting',
        quickActions: [
          { label: 'Yes, cancel it', action: 'confirm_cancel', params: { meetingId: entities.meetingId }, primary: true },
          { label: 'No, keep it', action: 'abort_cancel' },
          { label: 'Reschedule instead', action: 'reschedule_meeting', params: { meetingId: entities.meetingId } },
        ],
      }
    }

    const result = await this.scheduler.cancelMeeting({
      meetingId: entities.meetingId,
      meetingIdentifier: entities.meetingIdentifier,
      reason: entities.reason,
      notifyAttendees: entities.notifyAttendees ?? true,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble cancelling that meeting.',
        suggestedFollowUps: ['View meeting details', 'Try again'],
      }
    }

    const meeting = result.data as MeetingDetails

    return {
      success: true,
      message: `Meeting "${meeting.topic}" has been cancelled.${result.notificationsSent ? ' Attendees have been notified.' : ''}`,
      data: meeting,
      suggestedFollowUps: ['View my calendar', 'Schedule a new meeting'],
      quickActions: [
        { label: 'Reschedule for later', action: 'schedule_meeting', params: { attendee: meeting.attendee, topic: meeting.topic } },
        { label: 'View calendar', action: 'get_schedule' },
      ],
    }
  }

  private async handleGetSchedule(
    entities: SchedulingEntities,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    const result = await this.scheduler.getSchedule({
      date: entities.date,
      dateRange: entities.dateRange,
      includeDetails: true,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble fetching your schedule.',
        suggestedFollowUps: ['Try again', 'Check a specific day'],
      }
    }

    const meetings = result.data as MeetingDetails[]
    const dateStr = entities.date
      ? this.formatDate(new Date(entities.date), schedulingContext.timezone)
      : 'today'

    if (meetings.length === 0) {
      return {
        success: true,
        message: `Your calendar is clear ${dateStr}! Want to schedule something?`,
        displayData: { meetings: [], calendarView: 'day' },
        suggestedFollowUps: ['Schedule a meeting', 'Check tomorrow', 'View week'],
        quickActions: [
          { label: 'Schedule meeting', action: 'schedule_meeting', primary: true },
          { label: 'Check tomorrow', action: 'get_schedule', params: { date: 'tomorrow' } },
        ],
      }
    }

    // Format schedule message
    const scheduleStr = meetings.map(m => {
      const time = this.formatTimeShort(m.scheduledTime!, schedulingContext.timezone)
      return `- ${time}: ${m.topic} with ${m.attendee} (${m.duration}min, ${m.type})`
    }).join('\n')

    const nextMeeting = meetings[0]
    const timeUntilNext = this.getTimeUntil(nextMeeting.scheduledTime!)

    return {
      success: true,
      message: `You have ${meetings.length} meeting${meetings.length !== 1 ? 's' : ''} ${dateStr}:\n\n${scheduleStr}\n\nNext up: "${nextMeeting.topic}" ${timeUntilNext}.`,
      data: meetings,
      displayData: { meetings, calendarView: 'day', selectedDate: dateStr },
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
  }

  private async handleSetPreferences(
    message: string,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    const preferences = this.parsePreferencesFromMessage(message)

    const result = await this.scheduler.setPreferences(preferences, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble saving your preferences.',
        suggestedFollowUps: ['Try again', 'View current preferences'],
      }
    }

    const updatedPrefs = result.data as UserPreferences
    let message_response = 'Got it! I\'ve updated your scheduling preferences:\n'

    if (updatedPrefs.preferredTimes) {
      message_response += `- Preferred meeting times: ${updatedPrefs.preferredTimes.join(', ')}\n`
    }
    if (updatedPrefs.avoidTimes) {
      message_response += `- Times to avoid: ${updatedPrefs.avoidTimes.join(', ')}\n`
    }
    if (updatedPrefs.defaultDuration) {
      message_response += `- Default meeting length: ${updatedPrefs.defaultDuration} minutes\n`
    }
    if (updatedPrefs.bufferTime) {
      message_response += `- Buffer between meetings: ${updatedPrefs.bufferTime} minutes\n`
    }
    if (updatedPrefs.defaultMeetingType) {
      message_response += `- Default meeting type: ${updatedPrefs.defaultMeetingType}\n`
    }

    return {
      success: true,
      message: message_response,
      data: updatedPrefs,
      suggestedFollowUps: ['Schedule a meeting', 'View my calendar'],
    }
  }

  private async handleTimezoneConvert(
    entities: SchedulingEntities,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    if (!entities.time || !entities.fromTimezone || !entities.toTimezone) {
      return {
        success: true,
        message: 'What time would you like me to convert, and to which timezone?',
        suggestedFollowUps: ['3pm EST to PST', '10am Tokyo to London'],
      }
    }

    const result = await this.scheduler.convertTimezone({
      time: entities.time,
      fromTimezone: entities.fromTimezone,
      toTimezone: entities.toTimezone,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble converting that time.',
        suggestedFollowUps: ['Try again', 'Check timezone names'],
      }
    }

    const conversion = result.data as { original: string; converted: string }

    return {
      success: true,
      message: `${conversion.original} is ${conversion.converted}.`,
      data: conversion,
      suggestedFollowUps: ['Convert another time', 'Schedule at this time'],
    }
  }

  private async handleSendInvite(
    entities: SchedulingEntities,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    if (!entities.meetingId && !entities.attendeeEmail) {
      return {
        success: true,
        message: 'Who should I send the calendar invite to?',
        suggestedFollowUps: ['Search contacts', 'Enter email address'],
      }
    }

    const result = await this.scheduler.sendInvite({
      meetingId: entities.meetingId,
      attendeeEmail: entities.attendeeEmail,
      attendeeName: entities.attendee,
      message: entities.inviteMessage,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble sending the invite.',
        suggestedFollowUps: ['Try again', 'Check email address'],
      }
    }

    return {
      success: true,
      message: `Calendar invite sent to ${entities.attendee || entities.attendeeEmail}!`,
      data: result.data,
      suggestedFollowUps: ['Send to another person', 'View meeting details'],
    }
  }

  private async handleCheckConflicts(
    entities: SchedulingEntities,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    const result = await this.scheduler.checkConflicts({
      time: entities.time,
      date: entities.date,
      duration: entities.duration || 30,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble checking for conflicts.',
        suggestedFollowUps: ['Try again', 'View my calendar'],
      }
    }

    const conflicts = result.data as MeetingDetails[]

    if (conflicts.length === 0) {
      const timeStr = entities.time || 'that time'
      return {
        success: true,
        message: `No conflicts at ${timeStr}. You're free to schedule!`,
        suggestedFollowUps: ['Schedule a meeting', 'Check another time'],
        quickActions: [
          { label: 'Schedule here', action: 'schedule_meeting', params: { time: entities.time }, primary: true },
        ],
      }
    }

    const conflictStr = conflicts.map(c =>
      `- ${this.formatTimeShort(c.scheduledTime!, schedulingContext.timezone)}: ${c.topic} with ${c.attendee}`
    ).join('\n')

    return {
      success: true,
      message: `You have ${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''} at that time:\n\n${conflictStr}\n\nWant me to find an alternative time?`,
      data: conflicts,
      displayData: { meetings: conflicts },
      suggestedFollowUps: ['Find alternative time', 'Reschedule conflict'],
      quickActions: [
        { label: 'Find alternative', action: 'suggest_times', primary: true },
        { label: 'Reschedule', action: 'reschedule_meeting', params: { meetingId: conflicts[0].id } },
      ],
    }
  }

  private async handleSuggestTimes(
    entities: SchedulingEntities,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    const result = await this.scheduler.suggestTimes({
      attendees: entities.attendees || [entities.attendee].filter(Boolean) as string[],
      duration: entities.duration || 30,
      dateRange: entities.dateRange,
      preferences: entities.timePreferences,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble finding suggested times.',
        suggestedFollowUps: ['Try a different date range', 'View my calendar'],
      }
    }

    const suggestions = result.data as TimeSlot[]

    if (suggestions.length === 0) {
      return {
        success: true,
        message: 'I couldn\'t find any optimal times based on your preferences. Want me to expand the search?',
        suggestedFollowUps: ['Expand search', 'Change preferences'],
      }
    }

    const suggestionStr = suggestions.slice(0, 5).map((s, i) =>
      `${i + 1}. ${this.formatDateTime(s.start, schedulingContext.timezone)}`
    ).join('\n')

    return {
      success: true,
      message: `Here are the best times based on your schedule and preferences:\n\n${suggestionStr}\n\nWhich works for you?`,
      data: suggestions,
      displayData: { availableSlots: suggestions },
      suggestedFollowUps: suggestions.slice(0, 3).map(s =>
        `Book ${this.formatTimeShort(s.start, schedulingContext.timezone)}`
      ),
      quickActions: suggestions.slice(0, 3).map((slot, i) => ({
        label: this.formatDateTime(slot.start, schedulingContext.timezone),
        action: 'schedule_at_time',
        params: { time: slot.start },
        primary: i === 0,
      })),
    }
  }

  private async handleAddAttendee(
    entities: SchedulingEntities,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    if (!entities.meetingId && !entities.meetingIdentifier) {
      return {
        success: true,
        message: 'Which meeting should I add them to?',
        suggestedFollowUps: ['Show my upcoming meetings'],
      }
    }

    if (!entities.attendee && !entities.attendeeEmail) {
      return {
        success: true,
        message: 'Who would you like to add?',
        suggestedFollowUps: ['Search contacts', 'Enter email'],
      }
    }

    const result = await this.scheduler.addAttendee({
      meetingId: entities.meetingId,
      meetingIdentifier: entities.meetingIdentifier,
      attendee: entities.attendee,
      attendeeEmail: entities.attendeeEmail,
      sendInvite: entities.sendInvite ?? true,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble adding the attendee.',
        suggestedFollowUps: ['Try again', 'View meeting details'],
      }
    }

    return {
      success: true,
      message: `Added ${entities.attendee || entities.attendeeEmail} to the meeting.${result.inviteSent ? ' Invite sent!' : ''}`,
      data: result.data,
      suggestedFollowUps: ['Add another attendee', 'View meeting details'],
    }
  }

  private async handleRemoveAttendee(
    entities: SchedulingEntities,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    if (!entities.meetingId || !entities.attendee) {
      return {
        success: true,
        message: 'Which meeting and attendee?',
        suggestedFollowUps: ['Show my upcoming meetings'],
      }
    }

    const result = await this.scheduler.removeAttendee({
      meetingId: entities.meetingId,
      attendee: entities.attendee,
      notifyAttendee: entities.notifyAttendees ?? true,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble removing the attendee.',
        suggestedFollowUps: ['Try again', 'View meeting details'],
      }
    }

    return {
      success: true,
      message: `Removed ${entities.attendee} from the meeting.${result.notificationSent ? ' They\'ve been notified.' : ''}`,
      data: result.data,
      suggestedFollowUps: ['View meeting details', 'Add another attendee'],
    }
  }

  private async handleUpdateMeeting(
    entities: SchedulingEntities,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    if (!entities.meetingId && !entities.meetingIdentifier) {
      return {
        success: true,
        message: 'Which meeting would you like to update?',
        suggestedFollowUps: ['Show my upcoming meetings'],
      }
    }

    const result = await this.scheduler.updateMeeting({
      meetingId: entities.meetingId,
      meetingIdentifier: entities.meetingIdentifier,
      updates: {
        topic: entities.newTopic,
        notes: entities.notes,
        location: entities.location,
        meetingLink: entities.meetingLink,
        duration: entities.duration,
      },
      notifyAttendees: entities.notifyAttendees,
    }, schedulingContext)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'I had trouble updating the meeting.',
        suggestedFollowUps: ['Try again', 'View meeting details'],
      }
    }

    return {
      success: true,
      message: 'Meeting updated successfully!',
      data: result.data,
      displayData: { meetings: [result.data as MeetingDetails] },
      suggestedFollowUps: ['View meeting details', 'Send update to attendees'],
    }
  }

  private async handleUnknownSchedulingRequest(
    message: string,
    schedulingContext: SchedulingContext,
    context: ConversationContext
  ): Promise<SchedulingHandlerResult> {
    return {
      success: true,
      message: 'I can help you with scheduling! Here\'s what I can do:\n\n' +
        '- Schedule meetings ("Set up a call with John tomorrow at 2pm")\n' +
        '- Find availability ("When is Sarah free this week?")\n' +
        '- Reschedule ("Move my 3pm to tomorrow")\n' +
        '- Cancel meetings ("Cancel my meeting with Mike")\n' +
        '- View your schedule ("What\'s on my calendar today?")\n' +
        '- Set preferences ("I prefer morning meetings")\n\n' +
        'What would you like to do?',
      suggestedFollowUps: [
        'Schedule a meeting',
        'Check my calendar',
        'Find available times',
      ],
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private detectSchedulingIntent(message: string, intent: IntentClassification): SchedulingIntent {
    const lowerMessage = message.toLowerCase()

    for (const [schedulingIntent, patterns] of Object.entries(SCHEDULING_PATTERNS)) {
      for (const pattern of patterns) {
        if (lowerMessage.includes(pattern)) {
          return schedulingIntent as SchedulingIntent
        }
      }
    }

    // Default based on general intent
    if (intent.intent === 'schedule_meeting') return 'schedule_meeting'

    return 'schedule_meeting' // Default fallback
  }

  private extractSchedulingEntities(message: string, baseEntities: ExtractedEntities): SchedulingEntities {
    const entities: SchedulingEntities = {}

    // Extract attendee
    if (baseEntities.personName) {
      entities.attendee = baseEntities.personName
    }
    if (baseEntities.email) {
      entities.attendeeEmail = baseEntities.email
    }

    // Extract time expressions
    const timePatterns = [
      { pattern: /at (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i, field: 'time' },
      { pattern: /(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i, field: 'time' },
      { pattern: /tomorrow/i, field: 'date', value: 'tomorrow' },
      { pattern: /next week/i, field: 'date', value: 'next_week' },
      { pattern: /today/i, field: 'date', value: 'today' },
      { pattern: /this week/i, field: 'dateRange', value: 'this_week' },
      { pattern: /(\d{1,2})\s*(?:min|minute)/i, field: 'duration' },
      { pattern: /(\d{1,2})\s*hour/i, field: 'durationHours' },
      { pattern: /half (?:an )?hour/i, field: 'duration', value: 30 },
    ]

    for (const { pattern, field, value } of timePatterns) {
      const match = message.match(pattern)
      if (match) {
        if (value !== undefined) {
          (entities as any)[field] = value
        } else if (field === 'duration') {
          entities.duration = parseInt(match[1])
        } else if (field === 'durationHours') {
          entities.duration = parseInt(match[1]) * 60
        } else {
          (entities as any)[field] = match[1]
        }
      }
    }

    // Extract meeting type
    if (/video|zoom|teams|meet|virtual/i.test(message)) {
      entities.meetingType = 'video'
    } else if (/phone|call/i.test(message)) {
      entities.meetingType = 'phone'
    } else if (/in.?person|office|onsite/i.test(message)) {
      entities.meetingType = 'in_person'
    }

    // Extract topic (rough heuristic - look for "about" or "regarding")
    const topicMatch = message.match(/(?:about|regarding|for|discuss(?:ing)?)\s+(.+?)(?:\s+(?:at|on|with|tomorrow|today|next)|$)/i)
    if (topicMatch) {
      entities.topic = topicMatch[1].trim()
    }

    // Extract multiple attendees
    const attendeesMatch = message.match(/(?:with|include|and)\s+(.+?)(?:\s+(?:at|on|tomorrow|today|next)|$)/i)
    if (attendeesMatch) {
      const attendeeStr = attendeesMatch[1]
      // Split by "and" or commas
      entities.attendees = attendeeStr.split(/(?:,|\s+and\s+)/).map(a => a.trim()).filter(Boolean)
    }

    return entities
  }

  private parsePreferencesFromMessage(message: string): Partial<UserPreferences> {
    const preferences: Partial<UserPreferences> = {}
    const lowerMessage = message.toLowerCase()

    // Preferred times
    if (/morning/i.test(message)) {
      preferences.preferredTimes = ['morning']
    } else if (/afternoon/i.test(message)) {
      preferences.preferredTimes = ['afternoon']
    } else if (/evening/i.test(message)) {
      preferences.preferredTimes = ['evening']
    }

    // Times to avoid
    if (/no meetings before (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i.test(message)) {
      const match = message.match(/no meetings before (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i)
      if (match) preferences.avoidBefore = match[1]
    }
    if (/no meetings after (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i.test(message)) {
      const match = message.match(/no meetings after (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i)
      if (match) preferences.avoidAfter = match[1]
    }

    // Buffer time
    if (/(\d+)\s*(?:min|minute).*buffer/i.test(message)) {
      const match = message.match(/(\d+)\s*(?:min|minute).*buffer/i)
      if (match) preferences.bufferTime = parseInt(match[1])
    }

    // Default duration
    if (/default.*(\d+)\s*(?:min|minute)/i.test(message)) {
      const match = message.match(/default.*(\d+)\s*(?:min|minute)/i)
      if (match) preferences.defaultDuration = parseInt(match[1])
    }

    // Meeting type preference
    if (/prefer video/i.test(message)) {
      preferences.defaultMeetingType = 'video'
    } else if (/prefer phone/i.test(message)) {
      preferences.defaultMeetingType = 'phone'
    } else if (/prefer in.?person/i.test(message)) {
      preferences.defaultMeetingType = 'in_person'
    }

    return preferences
  }

  private findRecentMeetingInContext(context: ConversationContext): MeetingDetails | null {
    // Look through recent messages for meeting references
    const recentMessages = context.messages.slice(-10)
    for (const msg of recentMessages.reverse()) {
      if (msg.action?.type === 'schedule_meeting' && msg.action.result) {
        return msg.action.result as MeetingDetails
      }
    }
    return null
  }

  private formatDateTime(date: Date | string, timezone: string): string {
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

  private formatDate(date: Date, timezone: string): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: timezone,
    })
  }

  private formatTimeShort(date: Date | string, timezone: string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    })
  }

  private getTimeUntil(date: Date | string): string {
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
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

interface SchedulingEntities {
  attendee?: string
  attendeeEmail?: string
  attendees?: string[]
  topic?: string
  duration?: number
  time?: string
  date?: string
  dateRange?: { start: string; end: string } | string
  preferredTime?: string
  preferredTimes?: string[]
  newTime?: string
  newDate?: string
  meetingId?: string
  meetingIdentifier?: string
  meetingType?: 'video' | 'phone' | 'in_person'
  location?: string
  notes?: string
  reason?: string
  notifyAttendees?: boolean
  sendInvite?: boolean
  confirmed?: boolean
  fromTimezone?: string
  toTimezone?: string
  inviteMessage?: string
  timePreferences?: string[]
  newTopic?: string
  meetingLink?: string
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let handlerInstance: SchedulingHandler | null = null

export function getSchedulingHandler(): SchedulingHandler {
  if (!handlerInstance) {
    handlerInstance = new SchedulingHandler()
  }
  return handlerInstance
}

export default SchedulingHandler
