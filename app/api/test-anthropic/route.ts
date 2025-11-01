import { NextResponse } from 'next/server'

export async function GET() {
  const hasKey = !!process.env.ANTHROPIC_API_KEY
  const keyPrefix = process.env.ANTHROPIC_API_KEY?.substring(0, 15) + '...'

  if (!hasKey) {
    return NextResponse.json({
      error: 'ANTHROPIC_API_KEY not set',
      hasKey: false
    })
  }

  // Test actual API call
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Say hello' }]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json({
        hasKey: true,
        keyPrefix,
        apiWorks: false,
        status: response.status,
        error
      })
    }

    const data = await response.json()

    return NextResponse.json({
      hasKey: true,
      keyPrefix,
      apiWorks: true,
      response: data.content?.[0]?.text || 'Got response from Claude!'
    })
  } catch (error: any) {
    return NextResponse.json({
      hasKey: true,
      keyPrefix,
      apiWorks: false,
      error: error.message
    })
  }
}
