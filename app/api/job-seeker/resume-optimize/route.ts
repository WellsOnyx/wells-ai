/**
 * Resume Optimization API
 *
 * AI-powered ATS optimization
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { withValidation } from '@/lib/validation'
import { resumeParseSchema } from '@/lib/schemas'
import { optimizeResumeForATS } from '@/lib/job-seeker/resume-parser'

/**
 * POST /api/job-seeker/resume-optimize
 * Optimize resume for ATS systems
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

    // Optimize resume with Claude
    const optimized = await optimizeResumeForATS(resumeText)

    return NextResponse.json({
      success: true,
      ...optimized,
      message: 'Resume optimized successfully'
    })
  } catch (error: any) {
    console.error('Resume optimization error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to optimize resume' },
      { status: 500 }
    )
  }
})
