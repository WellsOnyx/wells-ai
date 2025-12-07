// @ts-nocheck
/**
 * GET /api/setup/guide
 * POST /api/setup/guide
 *
 * Returns integration setup guides for Wells AI to deliver in conversation
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  INTEGRATION_GUIDES,
  getGuideById,
  getGuidesByCategory,
  getGuidesByPriority,
  formatGuideForChat,
  formatAllGuidesChecklist,
  getMondayExecutionPlan,
  MONDAY_PRIORITIES,
} from '@/lib/knowledge/integration-setup-guide'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const category = searchParams.get('category')
  const format = searchParams.get('format') || 'json'
  const priority = searchParams.get('priority')

  try {
    // Get specific guide by ID
    if (id) {
      const guide = getGuideById(id)
      if (!guide) {
        return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
      }

      if (format === 'markdown' || format === 'chat') {
        return NextResponse.json({
          id: guide.id,
          name: guide.name,
          markdown: formatGuideForChat(guide),
        })
      }

      return NextResponse.json({ guide })
    }

    // Get guides by category
    if (category) {
      const guides = getGuidesByCategory(category as any)
      return NextResponse.json({ guides, count: guides.length })
    }

    // Get guides by priority
    if (priority) {
      const guides = getGuidesByPriority(parseInt(priority))
      return NextResponse.json({ guides, count: guides.length })
    }

    // Return all guides with summary
    return NextResponse.json({
      guides: INTEGRATION_GUIDES,
      count: INTEGRATION_GUIDES.length,
      categories: {
        inbox: getGuidesByCategory('inbox').length,
        infrastructure: getGuidesByCategory('infrastructure').length,
        payments: getGuidesByCategory('payments').length,
        social: getGuidesByCategory('social').length,
      },
      mondayPriorities: MONDAY_PRIORITIES,
    })
  } catch (error) {
    console.error('Error getting setup guide:', error)
    return NextResponse.json(
      { error: 'Failed to get setup guide' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, guideId } = body

    switch (action) {
      case 'checklist':
        return NextResponse.json({
          markdown: formatAllGuidesChecklist(),
        })

      case 'monday-plan':
        return NextResponse.json({
          markdown: getMondayExecutionPlan(),
        })

      case 'guide':
        if (!guideId) {
          return NextResponse.json({ error: 'guideId required' }, { status: 400 })
        }
        const guide = getGuideById(guideId)
        if (!guide) {
          return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
        }
        return NextResponse.json({
          markdown: formatGuideForChat(guide),
        })

      case 'step':
        const { stepNumber } = body
        if (!guideId || !stepNumber) {
          return NextResponse.json({ error: 'guideId and stepNumber required' }, { status: 400 })
        }
        const stepGuide = getGuideById(guideId)
        if (!stepGuide) {
          return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
        }
        const step = stepGuide.steps.find(s => s.step === stepNumber)
        if (!step) {
          return NextResponse.json({ error: 'Step not found' }, { status: 404 })
        }
        return NextResponse.json({
          guide: stepGuide.name,
          totalSteps: stepGuide.steps.length,
          step,
          nextStep: stepGuide.steps.find(s => s.step === stepNumber + 1),
          prevStep: stepGuide.steps.find(s => s.step === stepNumber - 1),
        })

      case 'env-vars':
        // Get all required env vars across all guides
        const allEnvVars = new Set<string>()
        INTEGRATION_GUIDES.forEach(g => g.envVars.forEach(e => allEnvVars.add(e)))
        return NextResponse.json({
          envVars: Array.from(allEnvVars).sort(),
          byGuide: INTEGRATION_GUIDES.reduce((acc, g) => {
            acc[g.id] = g.envVars
            return acc
          }, {} as Record<string, string[]>),
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error processing setup guide request:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
