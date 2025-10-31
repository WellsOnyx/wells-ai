/**
 * Resume Parser API
 *
 * AI-powered resume parsing and optimization
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { withValidation } from '@/lib/validation'
import { resumeParseSchema } from '@/lib/schemas'
import { parseResume, optimizeResumeForATS } from '@/lib/job-seeker/resume-parser'

/**
 * POST /api/job-seeker/resume-parse
 * Parse resume text and extract structured data
 */
export const POST = withValidation(resumeParseSchema, async (request) => {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { resumeText } = request.validatedBody

    // Parse resume with Claude
    const parsed = await parseResume(resumeText)

    return NextResponse.json({
      success: true,
      parsed,
      message: 'Resume parsed successfully'
    })
  } catch (error: any) {
    console.error('Resume parsing error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to parse resume' },
      { status: 500 }
    )
  }
})
