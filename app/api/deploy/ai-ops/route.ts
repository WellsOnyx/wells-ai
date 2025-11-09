import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'

/**
 * POST /api/deploy/ai-ops
 * Deploy AI Ops operations via chat interface
 * ULTRA SECURE - Requires Wells Onyx email + deployment secret
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for Wells Onyx email
    const user = await currentUser()
    const email = user?.primaryEmailAddress?.emailAddress || ''

    if (!email.endsWith('@wellsonyx.com')) {
      return NextResponse.json({
        error: 'Access denied. Deployment API is exclusively for Wells Onyx team members.'
      }, { status: 403 })
    }

    // Check deployment secret
    const { deploymentSecret, operation } = await req.json()

    const DEPLOYMENT_SECRET = process.env.WELLS_ONYX_DEPLOYMENT_SECRET || 'wells-onyx-deploy-2025'

    if (deploymentSecret !== DEPLOYMENT_SECRET) {
      return NextResponse.json({
        error: 'Invalid deployment secret'
      }, { status: 403 })
    }

    // Validate operation payload
    if (!operation || !operation.name || !operation.category) {
      return NextResponse.json({
        error: 'Invalid operation payload. Required: name, category, description'
      }, { status: 400 })
    }

    // Create the operation
    const newOperation = {
      id: `op_${operation.category}_${Date.now()}`,
      userId,
      deployedBy: email,
      deployedAt: new Date(),
      ...operation,
      status: 'active',
      metrics: {
        totalRuns: 0,
        successRate: 0,
        timeSavedHours: 0,
        costSavedUSD: 0,
        ...operation.metrics
      }
    }

    // TODO: Save to database when Prisma model is added
    // await prisma.aiOperation.create({ data: newOperation })

    return NextResponse.json({
      success: true,
      operation: newOperation,
      message: `✅ Operation "${operation.name}" deployed successfully!`,
      deployedBy: email,
      deployedAt: newOperation.deployedAt
    })

  } catch (error: any) {
    console.error('[DEPLOY AI OPS] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to deploy operation' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/deploy/ai-ops
 * Get deployment secret instructions
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    const email = user?.primaryEmailAddress?.emailAddress || ''

    if (!email.endsWith('@wellsonyx.com')) {
      return NextResponse.json({
        error: 'Access denied'
      }, { status: 403 })
    }

    return NextResponse.json({
      message: 'Wells Onyx Deployment API',
      instructions: {
        endpoint: '/api/deploy/ai-ops',
        method: 'POST',
        requiredHeaders: {
          'Content-Type': 'application/json'
        },
        requiredBody: {
          deploymentSecret: 'Your secret key from env',
          operation: {
            name: 'Operation name',
            category: 'sales | procurement | hiring | finance | customer_service',
            description: 'What this operation does',
            frequency: 'daily | weekly | continuous | as_needed',
            schedule: '09:00 (optional)',
            config: {
              // Custom config for this operation
            },
            metrics: {
              // Optional initial metrics
            }
          }
        },
        exampleCurl: `curl -X POST https://wellsai.vercel.app/api/deploy/ai-ops \\
  -H "Content-Type: application/json" \\
  -d '{
    "deploymentSecret": "YOUR_SECRET",
    "operation": {
      "name": "Daily Lead Generation",
      "category": "sales",
      "description": "Find 50 leads and send outreach",
      "frequency": "daily",
      "schedule": "09:00"
    }
  }'`
      },
      secret: {
        location: 'Set WELLS_ONYX_DEPLOYMENT_SECRET in .env.local',
        current: process.env.WELLS_ONYX_DEPLOYMENT_SECRET ? '✅ Set' : '❌ Not set'
      }
    })

  } catch (error: any) {
    console.error('[DEPLOY AI OPS INFO] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
