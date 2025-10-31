/**
 * Job Seeker Profile API
 *
 * Manage job seeker profiles in Clerk metadata
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { withValidation } from '@/lib/validation'
import { jobSeekerOnboardSchema, jobSeekerProfileUpdateSchema } from '@/lib/schemas'

/**
 * GET /api/job-seeker/profile
 * Get job seeker profile for current user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Retrieve profile from Clerk metadata
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    const profile = user.publicMetadata?.jobSeekerProfile

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      profile
    })
  } catch (error: any) {
    console.error('Error fetching job seeker profile:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/job-seeker/profile
 * Create or update job seeker profile
 */
export const POST = withValidation(jobSeekerOnboardSchema, async (request) => {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const profileData = request.validatedBody

    // Create profile object
    const profile = {
      id: userId,
      ...profileData,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString()
    }

    // Save to Clerk metadata
    const client = await clerkClient()
    await client.users.updateUser(userId, {
      publicMetadata: {
        jobSeekerProfile: profile
      }
    })

    return NextResponse.json({
      success: true,
      profile,
      message: 'Profile created successfully'
    })
  } catch (error: any) {
    console.error('Error creating job seeker profile:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create profile' },
      { status: 500 }
    )
  }
})

/**
 * PATCH /api/job-seeker/profile
 * Update existing job seeker profile
 */
export const PATCH = withValidation(jobSeekerProfileUpdateSchema, async (request) => {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { jobSeekerId, updates } = request.validatedBody

    if (jobSeekerId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - can only update own profile' },
        { status: 403 }
      )
    }

    // Get existing profile
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const existingProfile = user.publicMetadata?.jobSeekerProfile

    if (!existingProfile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Merge updates
    const updatedProfile = {
      ...existingProfile,
      ...updates,
      updatedDate: new Date().toISOString()
    }

    // Save to Clerk metadata
    await client.users.updateUser(userId, {
      publicMetadata: {
        jobSeekerProfile: updatedProfile
      }
    })

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: 'Profile updated successfully'
    })
  } catch (error: any) {
    console.error('Error updating job seeker profile:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update profile' },
      { status: 500 }
    )
  }
})
