import { NextResponse } from 'next/server'

// Generate 3 sample personalized messages for preview
async function generateSampleMessage(target: any, campaign: any) {
  const prompt = `You are writing a highly personalized outreach message for Wells Onyx.

CONTEXT:
- Target: ${target.name}, ${target.title} at ${target.company}
- Industry: ${target.industry}
- Service offering: ${campaign.serviceOffering}
- Their pain point: ${campaign.painPoint}
- Our value prop: ${campaign.value_prop}
- The hook: ${campaign.hook}

YOUR TASK:
Write a highly personalized message (email or SMS style, 100-150 words) that:
1. References something specific about their company or role
2. Identifies their likely pain point
3. Presents our solution as 10x better, not incrementally better
4. Includes the conversational commerce hook (Wells AI platform)
5. Ends with a clear, low-friction call to action

TONE: Direct, confident, not salesy. Like a peer reaching out with something genuinely valuable.

DO NOT use generic templates. Make it feel like you did real research.

Message:`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    return data.content?.[0]?.text || 'Error generating message'
  } catch (error) {
    console.error('Message generation error:', error)
    return `Hi ${target.name},

Saw you're ${target.title} at ${target.company}. ${campaign.value_prop}

${campaign.hook}

Worth a quick conversation?`
  }
}

export async function POST(request: Request) {
  try {
    const campaign = await request.json()

    // Generate 3 sample targets
    const sampleTargets = [
      {
        name: 'Sarah Chen',
        title: campaign.targetRole || 'CEO',
        company: 'Acme Corp',
        industry: campaign.targetIndustry || 'Technology'
      },
      {
        name: 'Michael Rodriguez',
        title: campaign.targetRole || 'CTO',
        company: 'TechStart Inc',
        industry: campaign.targetIndustry || 'SaaS'
      },
      {
        name: 'Emily Watson',
        title: campaign.targetRole || 'CFO',
        company: 'Global Innovations',
        industry: campaign.targetIndustry || 'Fintech'
      }
    ]

    // Generate personalized messages for each
    const samples = await Promise.all(
      sampleTargets.map(async (target) => ({
        target,
        message: await generateSampleMessage(target, campaign)
      }))
    )

    return NextResponse.json({ samples })

  } catch (error: any) {
    console.error('Preview generation error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
