/**
 * POST /api/onboarding/extract
 *
 * Extract structured data from a natural language message.
 * This is the core of the progressive profile building system.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { extractFromMessage, mergeExtractionIntoProfile } from '@/lib/onboarding/extractor'
import { getOrCreateProfile, upsertProfile } from '@/lib/onboarding/db'
import { getNextQuestion, getExtractionAcknowledgment } from '@/lib/onboarding/questions'
import { calculateCompleteness } from '@/lib/onboarding/profile-schema'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { message, conversationContext } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get current profile
    const profile = await getOrCreateProfile(userId)

    // Extract data from message
    const extractionResult = await extractFromMessage(
      message,
      profile,
      conversationContext
    )

    // Merge extraction into profile
    let updatedProfile = profile
    if (extractionResult.success && extractionResult.events.length > 0) {
      updatedProfile = mergeExtractionIntoProfile(
        profile,
        extractionResult.extractedData,
        extractionResult.events
      )

      // Save to database
      await upsertProfile(updatedProfile)
    }

    // Calculate new completeness
    const completeness = calculateCompleteness(updatedProfile)

    // Get acknowledgment for what was extracted
    const extractedFields = extractionResult.events.map(e => e.field)
    const acknowledgment = getExtractionAcknowledgment(extractedFields, completeness)

    // Get next question to ask
    const nextQuestion = getNextQuestion(updatedProfile)

    return NextResponse.json({
      success: true,
      extracted: {
        data: extractionResult.extractedData,
        fields: extractedFields,
        confidence: extractionResult.confidence,
        journeyDetected: extractionResult.journeyDetected,
      },
      profile: {
        id: updatedProfile.id,
        journey: updatedProfile.journey,
        journeys: updatedProfile.journeys,
        completeness,
        name: updatedProfile.name,
        email: updatedProfile.email,
      },
      feedback: {
        acknowledgment,
        nextQuestion: nextQuestion?.text,
        nextField: nextQuestion?.field,
      },
    })
  } catch (error) {
    console.error('[API] Error in /api/onboarding/extract:', error)
    return NextResponse.json(
      { error: 'Failed to extract profile data' },
      { status: 500 }
    )
  }
}
