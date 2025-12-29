/**
 * Wells AI Scheduling Chat API
 *
 * Dedicated endpoint for conversational scheduling operations.
 * Handles all meeting and calendar operations through natural language.
 *
 * Features:
 * - Natural language meeting scheduling
 * - Availability checking
 * - Meeting rescheduling and cancellation
 * - Calendar synchronization
 * - Smart time suggestions
 * - Automatic timezone handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { SchedulingHandler, getSchedulingHandler } from '@/lib/chat/handlers/scheduling-handler'
import { ConversationalScheduler, SchedulingContext, UserPreferences } from '@/lib/scheduling/conversational-scheduling'
import { classifyIntent, IntentClassification } from '@/lib/chat/intent-router'
import { getConversationContext, addMessage, saveConversationContext } from '@/lib/chat/conversation-manager'
import { sqlQuery as sql } from '@/lib/db'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// SCHEDULING TOOLS FOR CLAUDE
// ============================================================================

const SCHEDULING_TOOLS: Anthropic.Tool[] = [
  {
    name: 'schedule_meeting',
    description: 'Schedule a new meeting with someone. Use when the user wants to set up, book, or arrange a meeting, call, or sync.',
    input_schema: {
      type: 'object' as const,
      properties: {
        attendee: { type: 'string', description: 'Name of the person to meet with' },
        attendeeEmail: { type: 'string', description: 'Email address of the attendee' },
        topic: { type: 'string', description: 'Meeting topic or purpose' },
        duration: { type: 'number', description: 'Meeting duration in minutes (default: 30)' },
        preferredTime: { type: 'string', description: 'Preferred time (e.g., "tomorrow at 2pm", "next Monday morning")' },
        type: { type: 'string', enum: ['video', 'phone', 'in_person'], description: 'Meeting type' },
        location: { type: 'string', description: 'Meeting location (for in-person)' },
        sendInvite: { type: 'boolean', description: 'Whether to send calendar invite (default: true)' },
      },
      required: ['attendee', 'topic'],
    },
  },
  {
    name: 'find_availability',
    description: 'Check when someone is available or find open time slots. Use when user asks "when is X free?" or "what times are available?"',
    input_schema: {
      type: 'object' as const,
      properties: {
        attendee: { type: 'string', description: 'Person to check availability for' },
        attendeeEmail: { type: 'string', description: 'Email of person to check' },
        date: { type: 'string', description: 'Specific date to check (e.g., "tomorrow", "next Monday")' },
        dateRange: { type: 'string', description: 'Date range (e.g., "this week", "next 2 weeks")' },
        duration: { type: 'number', description: 'Required meeting duration in minutes' },
      },
      required: [],
    },
  },
  {
    name: 'find_mutual_availability',
    description: 'Find times when multiple people are all available. Use for group meetings or when coordinating with a team.',
    input_schema: {
      type: 'object' as const,
      properties: {
        attendees: { type: 'array', items: { type: 'string' }, description: 'List of people to find mutual time for' },
        duration: { type: 'number', description: 'Required meeting duration in minutes' },
        dateRange: { type: 'string', description: 'Date range to search (e.g., "this week", "next 2 weeks")' },
      },
      required: ['attendees'],
    },
  },
  {
    name: 'reschedule_meeting',
    description: 'Move or reschedule an existing meeting to a new time. Use when user says "move", "reschedule", or "change time".',
    input_schema: {
      type: 'object' as const,
      properties: {
        meetingIdentifier: { type: 'string', description: 'Meeting topic, attendee name, or time to identify the meeting' },
        newTime: { type: 'string', description: 'New time for the meeting (e.g., "tomorrow at 3pm")' },
        newDate: { type: 'string', description: 'New date for the meeting' },
        reason: { type: 'string', description: 'Reason for rescheduling (optional)' },
        notifyAttendees: { type: 'boolean', description: 'Whether to notify attendees (default: true)' },
      },
      required: ['meetingIdentifier'],
    },
  },
  {
    name: 'cancel_meeting',
    description: 'Cancel an existing meeting. Use when user says "cancel", "delete", or "remove" a meeting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        meetingIdentifier: { type: 'string', description: 'Meeting topic, attendee name, or time to identify the meeting' },
        reason: { type: 'string', description: 'Reason for cancellation (optional)' },
        notifyAttendees: { type: 'boolean', description: 'Whether to notify attendees (default: true)' },
      },
      required: ['meetingIdentifier'],
    },
  },
  {
    name: 'get_schedule',
    description: 'Get the user\'s calendar/schedule for a specific time period. Use when user asks "what\'s on my calendar?" or "show my schedule".',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Specific date (e.g., "today", "tomorrow", "Monday")' },
        dateRange: { type: 'string', description: 'Date range (e.g., "this week", "next 3 days")' },
      },
      required: [],
    },
  },
  {
    name: 'set_preferences',
    description: 'Set scheduling preferences like preferred meeting times, default duration, buffer time, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        preferredTimes: { type: 'array', items: { type: 'string' }, description: 'Preferred times of day (e.g., ["morning", "afternoon"])' },
        avoidBefore: { type: 'string', description: 'No meetings before this time (e.g., "9:00")' },
        avoidAfter: { type: 'string', description: 'No meetings after this time (e.g., "17:00")' },
        defaultDuration: { type: 'number', description: 'Default meeting length in minutes' },
        bufferTime: { type: 'number', description: 'Buffer time between meetings in minutes' },
        defaultMeetingType: { type: 'string', enum: ['video', 'phone', 'in_person'], description: 'Default meeting type' },
      },
      required: [],
    },
  },
  {
    name: 'suggest_times',
    description: 'Suggest optimal meeting times based on availability and preferences.',
    input_schema: {
      type: 'object' as const,
      properties: {
        attendees: { type: 'array', items: { type: 'string' }, description: 'People who need to attend' },
        duration: { type: 'number', description: 'Required meeting duration in minutes' },
        dateRange: { type: 'string', description: 'Date range to search' },
        preferences: { type: 'array', items: { type: 'string' }, description: 'Time preferences (e.g., ["morning", "early afternoon"])' },
      },
      required: [],
    },
  },
  {
    name: 'check_conflicts',
    description: 'Check if a specific time has any conflicts with existing meetings.',
    input_schema: {
      type: 'object' as const,
      properties: {
        time: { type: 'string', description: 'Time to check (e.g., "tomorrow at 2pm")' },
        duration: { type: 'number', description: 'Meeting duration in minutes' },
      },
      required: ['time'],
    },
  },
  {
    name: 'convert_timezone',
    description: 'Convert a time between timezones.',
    input_schema: {
      type: 'object' as const,
      properties: {
        time: { type: 'string', description: 'Time to convert (e.g., "3pm")' },
        fromTimezone: { type: 'string', description: 'Source timezone (e.g., "EST", "America/New_York")' },
        toTimezone: { type: 'string', description: 'Target timezone (e.g., "PST", "Europe/London")' },
      },
      required: ['time', 'fromTimezone', 'toTimezone'],
    },
  },
  {
    name: 'send_calendar_invite',
    description: 'Send a calendar invite to an attendee for an existing meeting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        meetingIdentifier: { type: 'string', description: 'Meeting to send invite for' },
        attendeeEmail: { type: 'string', description: 'Email to send invite to' },
        message: { type: 'string', description: 'Optional message to include with invite' },
      },
      required: ['meetingIdentifier', 'attendeeEmail'],
    },
  },
]

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SCHEDULING_SYSTEM_PROMPT = `You are Wells, an AI scheduling assistant that makes calendar management effortless through natural conversation.

YOUR CAPABILITIES:
- Schedule meetings with anyone
- Find available times
- Coordinate group meeting times
- Reschedule and cancel meetings
- Show daily/weekly schedules
- Set and remember meeting preferences
- Convert between timezones
- Send calendar invites

CONVERSATIONAL STYLE:
- Be efficient and helpful
- Confirm details before taking action
- Suggest alternatives when there are conflicts
- Remember user preferences
- Handle timezone differences gracefully

IMPORTANT RULES:
1. Always use tools to take action - don't just describe what you could do
2. Confirm before scheduling, rescheduling, or canceling
3. Suggest alternatives when preferred time isn't available
4. Be proactive about timezone differences
5. Keep responses concise but informative

EXAMPLES:

User: "Set up a call with John next week"
You: [Use schedule_meeting] I'll set up a call with John. What's the meeting about, and any preferred time next week?

User: "When is Sarah free?"
You: [Use find_availability] Let me check Sarah's availability...

User: "Move my 3pm to tomorrow"
You: [Use reschedule_meeting] I'll move your 3pm meeting to tomorrow. What time works best?

User: "What's on my calendar today?"
You: [Use get_schedule] Here's your schedule for today...

User: "I prefer morning meetings"
You: [Use set_preferences] Got it! I've noted that you prefer morning meetings. I'll prioritize morning slots when suggesting meeting times.

Always be helpful and efficient. Users should feel like scheduling is effortless.`

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    // Authenticate user
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { message, sessionId, conversationId, timezone } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Get or create session
    const effectiveSessionId = sessionId || conversationId || `sched_${Date.now()}`

    // Load conversation context
    const context = await getConversationContext(effectiveSessionId, clerkUserId)

    // Add user message to context
    addMessage(context, 'user', message)

    // Get user's scheduling preferences and calendar connections
    const userPreferences = await getUserSchedulingPreferences(clerkUserId)
    const userTimezone = timezone || userPreferences.timezone || 'America/New_York'

    // Build scheduling context
    const schedulingContext: SchedulingContext = {
      userId: clerkUserId,
      timezone: userTimezone,
      workingHours: userPreferences.workingHours || { start: '09:00', end: '17:00' },
      preferences: userPreferences,
    }

    // Build conversation history for Claude
    const conversationHistory = context.messages.slice(-10).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    // Ensure we have the current message at the end
    if (conversationHistory.length === 0 || conversationHistory[conversationHistory.length - 1].content !== message) {
      conversationHistory.push({ role: 'user', content: message })
    }

    // Call Claude with scheduling tools
    const claudeResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SCHEDULING_SYSTEM_PROMPT + `\n\nUSER CONTEXT:\n- Timezone: ${userTimezone}\n- Working hours: ${schedulingContext.workingHours.start} - ${schedulingContext.workingHours.end}\n${userPreferences.preferredTimes ? `- Prefers: ${userPreferences.preferredTimes.join(', ')} meetings` : ''}`,
      messages: conversationHistory,
      tools: SCHEDULING_TOOLS,
    })

    // Process response
    let responseText = ''
    const toolResults: any[] = []
    const suggestedFollowUps: string[] = []
    const quickActions: any[] = []
    let displayData: any = null

    const scheduler = new ConversationalScheduler()
    const handler = getSchedulingHandler()

    for (const block of claudeResponse.content) {
      if (block.type === 'text') {
        responseText = block.text
      } else if (block.type === 'tool_use') {
        const toolName = block.name
        const toolInput = block.input as Record<string, any>

        // Execute the tool
        const result = await executeSchedulingTool(
          toolName,
          toolInput,
          schedulingContext,
          scheduler
        )

        toolResults.push({
          tool: toolName,
          input: toolInput,
          result,
        })

        // Merge suggestions and quick actions
        if (result.suggestedFollowUps) {
          suggestedFollowUps.push(...result.suggestedFollowUps)
        }
        if (result.quickActions) {
          quickActions.push(...result.quickActions)
        }
        if (result.displayData) {
          displayData = { ...displayData, ...result.displayData }
        }

        // If we got a message from the tool, use it
        if (result.message && !responseText) {
          responseText = result.message
        }
      }
    }

    // If Claude used tools but didn't provide a final response, use the tool message
    if (!responseText && toolResults.length > 0) {
      responseText = toolResults[toolResults.length - 1].result.message || 'Done!'
    }

    // Add assistant response to context
    addMessage(context, 'assistant', responseText)

    // Save context
    await saveConversationContext(context)

    return NextResponse.json({
      success: true,
      message: responseText,
      toolResults: toolResults.length > 0 ? toolResults : undefined,
      suggestions: [...new Set(suggestedFollowUps)].slice(0, 4),
      quickActions: quickActions.slice(0, 4),
      displayData,
      metadata: {
        sessionId: effectiveSessionId,
        processingTimeMs: Date.now() - startTime,
        timezone: userTimezone,
      },
    })
  } catch (error) {
    console.error('[Scheduling Chat API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        message: 'I ran into an issue with that scheduling request. Could you try again?',
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get schedule for a user
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || 'today'
    const timezone = searchParams.get('timezone') || 'America/New_York'

    const userPreferences = await getUserSchedulingPreferences(clerkUserId)

    const schedulingContext: SchedulingContext = {
      userId: clerkUserId,
      timezone,
      workingHours: userPreferences.workingHours || { start: '09:00', end: '17:00' },
      preferences: userPreferences,
    }

    const scheduler = new ConversationalScheduler()
    const result = await scheduler.getSchedule({ date }, schedulingContext)

    return NextResponse.json({
      success: result.success,
      schedule: result.data,
      date,
      timezone,
    })
  } catch (error) {
    console.error('[Scheduling GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get schedule' },
      { status: 500 }
    )
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getUserSchedulingPreferences(userId: string): Promise<UserPreferences & { timezone?: string; workingHours?: { start: string; end: string } }> {
  try {
    const result = await sql`
      SELECT preferences FROM user_scheduling_preferences
      WHERE user_id = ${userId}
    `

    if (result.rows.length > 0) {
      return result.rows[0].preferences
    }

    // Return defaults
    return {
      defaultDuration: 30,
      defaultMeetingType: 'video',
      bufferTime: 5,
    }
  } catch (error) {
    console.error('[getUserSchedulingPreferences] Error:', error)
    return {
      defaultDuration: 30,
      defaultMeetingType: 'video',
    }
  }
}

async function executeSchedulingTool(
  toolName: string,
  input: Record<string, any>,
  context: SchedulingContext,
  scheduler: ConversationalScheduler
): Promise<any> {
  switch (toolName) {
    case 'schedule_meeting':
      return scheduler.scheduleMeeting(input, context)

    case 'find_availability':
      return scheduler.findAvailability(input, context)

    case 'find_mutual_availability':
      return scheduler.findMutualAvailability(input, context)

    case 'reschedule_meeting':
      return scheduler.rescheduleMeeting({
        meetingIdentifier: input.meetingIdentifier,
        newTime: input.newTime,
        newDate: input.newDate,
        reason: input.reason,
        notifyAttendees: input.notifyAttendees,
      }, context)

    case 'cancel_meeting':
      return scheduler.cancelMeeting({
        meetingIdentifier: input.meetingIdentifier,
        reason: input.reason,
        notifyAttendees: input.notifyAttendees,
      }, context)

    case 'get_schedule':
      return scheduler.getSchedule(input, context)

    case 'set_preferences':
      return scheduler.setPreferences(input, context)

    case 'suggest_times':
      return scheduler.suggestTimes(input, context)

    case 'check_conflicts':
      return scheduler.checkConflicts(input, context)

    case 'convert_timezone':
      return scheduler.convertTimezone(input, context)

    case 'send_calendar_invite':
      return scheduler.sendInvite({
        meetingIdentifier: input.meetingIdentifier,
        attendeeEmail: input.attendeeEmail,
        message: input.message,
      }, context)

    default:
      return {
        success: false,
        message: `Unknown scheduling action: ${toolName}`,
      }
  }
}
