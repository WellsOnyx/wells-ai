/**
 * POST /api/playbooks/run
 * Run a playbook (queue for consent, then execute if approved)
 */

import { NextRequest, NextResponse } from 'next/server'
import { runPlaybook } from '@/lib/playbooks'
import { PlaybookType } from '@/lib/playbooks/types'

export async function POST(request: NextRequest) {
  try {
    const { type, partner, oppId, params } = await request.json()

    if (!type || !partner || !oppId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, partner, oppId' },
        { status: 400 }
      )
    }

    // Validate playbook type
    if (!Object.values(PlaybookType).includes(type)) {
      return NextResponse.json(
        { error: `Invalid playbook type: ${type}` },
        { status: 400 }
      )
    }

    // Run playbook
    const action = await runPlaybook({
      type,
      partner,
      oppId,
      playbookParams: params
    })

    return NextResponse.json({
      success: true,
      action: {
        actionId: action.actionId,
        playbookType: action.playbookType,
        status: action.status,
        consentActionId: action.consentActionId
      }
    })
  } catch (error) {
    console.error('Failed to run playbook:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run playbook' },
      { status: 500 }
    )
  }
}
