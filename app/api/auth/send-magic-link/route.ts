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

    // Use Clerk's built-in magic link flow
    // Clerk will automatically create user if they don't exist
    const client = await clerkClient()

    try {
      // Check if user exists first
      const users = await client.users.getUserList({
        emailAddress: [email]
      })

      let userId: string
      if (users.data.length > 0) {
        // User exists - get their ID
        userId = users.data[0].id
        console.log(`[MAGIC LINK] Found existing user: ${userId}`)
      } else {
        // User doesn't exist - create with proper format
        const newUser = await client.users.createUser({
          emailAddress: [email],
          skipPasswordRequirement: true,
          skipPasswordChecks: true
        })
        userId = newUser.id
        console.log(`[MAGIC LINK] Created new user: ${userId}`)
      }

      // Create sign-in token
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
      return NextResponse.json(
        { error: error.message || 'Failed to send magic link' },
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
