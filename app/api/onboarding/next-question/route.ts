/**
 * GET /api/onboarding/next-question
 *
 * Get the next smart question to ask based on what's missing from the profile.
 * Questions are contextual and conversational, never interrogative.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getOrCreateProfile } from '@/lib/onboarding/db'
import {
  getNextQuestion,
  getQuestionsForSession,
  generateConversationalQuestion,
  getProgressFeedback,
} from '@/lib/onboarding/questions'
import { calculateCompleteness, getMissingFields } from '@/lib/onboarding/profile-schema'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const count = parseInt(searchParams.get('count') || '1')
    const targetField = searchParams.get('field') || undefined
    const contextParam = searchParams.get('context') || undefined

    // Get user's profile
    const profile = await getOrCreateProfile(userId)
    const completeness = calculateCompleteness(profile)
    const missingFields = getMissingFields(profile)

    // If profile is complete, return success message
    if (completeness >= 95 || missingFields.length === 0) {
      return NextResponse.json({
        success: true,
        complete: true,
        completeness,
        message: getProgressFeedback(completeness),
        question: null,
        questions: [],
      })
    }

    // Get questions
    if (count > 1) {
      const questions = getQuestionsForSession(profile, count)
      return NextResponse.json({
        success: true,
        complete: false,
        completeness,
        questions: questions.map(q => ({
          id: q.id,
          text: q.text,
          field: q.field,
          priority: q.priority,
          alternatives: q.alternatives,
        })),
        progressFeedback: getProgressFeedback(completeness),
      })
    }

    // Get single next question
    let question = getNextQuestion(profile)

    // If context provided and we want AI-generated question
    if (contextParam && process.env.ANTHROPIC_API_KEY) {
      try {
        const recentMessages = contextParam.split('|||').filter(Boolean)
        const aiQuestion = await generateConversationalQuestion(
          profile,
          recentMessages,
          targetField
        )
        if (aiQuestion) {
          question = aiQuestion
        }
      } catch (error) {
        console.error('[NextQuestion] Error generating AI question:', error)
        // Fall back to template question
      }
    }

    return NextResponse.json({
      success: true,
      complete: false,
      completeness,
      question: question ? {
        id: question.id,
        text: question.text,
        field: question.field,
        priority: question.priority,
        alternatives: question.alternatives,
      } : null,
      progressFeedback: getProgressFeedback(completeness),
      meta: {
        journey: profile.journey,
        fieldsRemaining: missingFields.length,
        nextPriority: missingFields[0]?.priority,
      },
    })
  } catch (error) {
    console.error('[API] Error in /api/onboarding/next-question:', error)
    return NextResponse.json(
      { error: 'Failed to get next question' },
      { status: 500 }
    )
  }
}

/**
 * POST - Get a question for a specific field
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { field, recentMessages } = body

    const profile = await getOrCreateProfile(userId)
    const completeness = calculateCompleteness(profile)

    // Generate AI-powered conversational question
    const question = await generateConversationalQuestion(
      profile,
      recentMessages || [],
      field
    )

    return NextResponse.json({
      success: true,
      completeness,
      question: {
        id: question.id,
        text: question.text,
        field: question.field,
        priority: question.priority,
      },
      progressFeedback: getProgressFeedback(completeness),
    })
  } catch (error) {
    console.error('[API] Error in POST /api/onboarding/next-question:', error)
    return NextResponse.json(
      { error: 'Failed to generate question' },
      { status: 500 }
    )
  }
}
