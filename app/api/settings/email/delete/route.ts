/**
 * DELETE /api/settings/email/delete
 * Remove user's email configuration
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { deleteUserEmailConfig } from '@/lib/email-config'

export async function DELETE(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Delete email configuration
    const result = await deleteUserEmailConfig(userId)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to delete email configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email configuration deleted successfully'
    })
  } catch (error) {
    console.error('[API] Failed to delete email config:', error)
    return NextResponse.json(
      { error: 'Failed to delete email configuration' },
      { status: 500 }
    )
  }
}
