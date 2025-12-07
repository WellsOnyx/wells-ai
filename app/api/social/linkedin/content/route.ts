// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import {
  generateLinkedInPost,
  generateLinkedInResponse,
  generateLinkedInOutreach,
  LINKEDIN_CONTENT_THEMES,
  LINKEDIN_PROFILE
} from '@/lib/social/linkedin'

/**
 * POST /api/social/linkedin/content
 *
 * Generate LinkedIn content using Wells AI
 *
 * Body:
 * {
 *   type: 'post' | 'response' | 'outreach' | 'profile',
 *   theme?: string (for posts),
 *   customPrompt?: string (for posts),
 *   incomingMessage?: string (for responses),
 *   prospect?: { name, company, title, industry } (for responses/outreach),
 *   context?: string (for responses),
 *   trigger?: string (for outreach),
 *   connectionNote?: boolean (for outreach)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, theme, customPrompt, incomingMessage, prospect, context, trigger, connectionNote } = body

    if (!type) {
      return NextResponse.json(
        { error: 'Type is required (post, response, outreach, or profile)' },
        { status: 400 }
      )
    }

    switch (type) {
      case 'post': {
        const post = await generateLinkedInPost(theme, customPrompt)
        return NextResponse.json({
          success: true,
          type: 'post',
          content: post.content,
          theme: post.theme,
          hashtags: post.hashtags,
          metadata: post.metadata
        })
      }

      case 'response': {
        if (!incomingMessage) {
          return NextResponse.json(
            { error: 'incomingMessage is required for response type' },
            { status: 400 }
          )
        }

        const response = await generateLinkedInResponse(
          incomingMessage,
          prospect,
          context
        )

        return NextResponse.json({
          success: true,
          type: 'response',
          content: response,
          replyingTo: incomingMessage,
          prospect
        })
      }

      case 'outreach': {
        if (!prospect || !prospect.name || !prospect.company || !prospect.title) {
          return NextResponse.json(
            { error: 'prospect object with name, company, and title is required for outreach' },
            { status: 400 }
          )
        }

        if (!trigger) {
          return NextResponse.json(
            { error: 'trigger (reason for outreach) is required' },
            { status: 400 }
          )
        }

        const outreach = await generateLinkedInOutreach({
          ...prospect,
          trigger,
          connectionNote
        })

        return NextResponse.json({
          success: true,
          type: 'outreach',
          content: outreach,
          prospect,
          trigger,
          connectionNote,
          characterCount: outreach.length
        })
      }

      case 'profile': {
        // Return Wells' profile information
        return NextResponse.json({
          success: true,
          type: 'profile',
          profile: LINKEDIN_PROFILE
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be: post, response, outreach, or profile' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error generating LinkedIn content:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/social/linkedin/content?type=themes
 *
 * Get available content themes or profile info
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const type = searchParams.get('type')

    switch (type) {
      case 'themes':
        return NextResponse.json({
          success: true,
          themes: LINKEDIN_CONTENT_THEMES
        })

      case 'profile':
        return NextResponse.json({
          success: true,
          profile: LINKEDIN_PROFILE
        })

      default:
        return NextResponse.json({
          success: true,
          availableTypes: ['themes', 'profile'],
          message: 'Use ?type=themes or ?type=profile'
        })
    }
  } catch (error) {
    console.error('Error fetching LinkedIn content info:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch content info',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
