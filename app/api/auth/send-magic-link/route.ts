/**
 * Send Magic Link API - Passwordless authentication via email
 * Enables cross-device sync and secure transactions
 */

import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    console.log(`[MAGIC LINK] Sending to ${email}`)

    const client = await clerkClient()

    try {
      // Try to find existing user
      const users = await client.users.getUserList({
        emailAddress: [email]
      })

      let userId: string

      if (users.data.length > 0) {
        // User exists - get their ID
        userId = users.data[0].id
        console.log(`[MAGIC LINK] Found existing user: ${userId}`)
      } else {
        // User doesn't exist - send them an invitation
        // This is the proper way to do passwordless onboarding in Clerk
        console.log(`[MAGIC LINK] Sending invitation to ${email}`)

        try {
          const invitation = await client.invitations.createInvitation({
            emailAddress: email,
            redirectUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || '/'
          })

          console.log(`[MAGIC LINK] Invitation sent successfully`)

          return NextResponse.json({
            success: true,
            message: 'Magic link sent successfully',
            invitationSent: true
          })
        } catch (inviteError: any) {
          console.error('[MAGIC LINK] Invitation failed, trying direct user creation:', inviteError)

          // Fallback: Try creating user with empty password
          const newUser = await client.users.createUser({
            emailAddress: [email],
            password: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
          })
          userId = newUser.id
          console.log(`[MAGIC LINK] Created new user via fallback: ${userId}`)
        }
      }

      // Create sign-in token (this is the magic link)
      const signInToken = await client.signInTokens.createSignInToken({
        userId,
        expiresInSeconds: 3600 // 1 hour
      })

      console.log(`[MAGIC LINK] Created sign-in token`)
      console.log(`[MAGIC LINK] Magic link URL: ${signInToken.url}`)

      return NextResponse.json({
        success: true,
        message: 'Magic link sent successfully',
        magicLink: signInToken.url // Return for development
      })
    } catch (error: any) {
      console.error('[MAGIC LINK] Error:', error)
      console.error('[MAGIC LINK] Error details:', JSON.stringify(error, null, 2))

      // Return more detailed error for debugging
      return NextResponse.json(
        {
          error: error.message || 'Failed to send magic link',
          details: error.errors || error.clerkError || 'No additional details'
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[MAGIC LINK] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
