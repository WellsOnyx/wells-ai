/**
 * Migration endpoint to add approved column to user_wallets
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function GET(req: NextRequest) {
  try {
    // Add approved column if it doesn't exist
    await sql`
      ALTER TABLE user_wallets
      ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT TRUE
    `

    await sql`
      ALTER TABLE user_wallets
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP
    `

    await sql`
      ALTER TABLE user_wallets
      ADD COLUMN IF NOT EXISTS approval_notes TEXT
    `

    // Set all existing wallets to approved
    await sql`
      UPDATE user_wallets
      SET approved = TRUE, approved_at = NOW()
      WHERE approved IS NULL OR approved = FALSE
    `

    return NextResponse.json({
      success: true,
      message: 'Migration complete - approved column added and existing wallets approved'
    })
  } catch (error: any) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
