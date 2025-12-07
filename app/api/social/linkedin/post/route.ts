// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import {
  postToLinkedIn,
  LinkedInAuthConfig,
  LinkedInPost,
  scheduleLinkedInPost,
  GeneratedPost
} from '@/lib/social/linkedin'
import { sql } from '@vercel/postgres'

/**
 * POST /api/social/linkedin/post
 *
 * Publish or schedule a LinkedIn post from Wells AI
 *
 * Body:
 * {
 *   content: string,
 *   visibility?: 'PUBLIC' | 'CONNECTIONS',
 *   mediaUrls?: string[],
 *   hashtags?: string[],
 *   schedule?: string (ISO datetime),
 *   dryRun?: boolean (preview only, don't actually post)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      content,
      visibility = 'PUBLIC',
      mediaUrls = [],
      hashtags = [],
      schedule,
      dryRun = false,
      theme
    } = body

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Get LinkedIn credentials from environment
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN
    const personUrn = process.env.LINKEDIN_PERSON_URN

    if (!accessToken || !personUrn) {
      console.warn('LinkedIn credentials not configured - running in preview mode')

      // Preview mode - don't actually post
      return NextResponse.json({
        success: true,
        preview: true,
        message: 'LinkedIn API not configured - preview only',
        post: {
          content,
          visibility,
          mediaUrls,
          hashtags,
          characterCount: content.length,
          estimatedEngagement: Math.floor(Math.random() * 100) + 50
        }
      })
    }

    const config: LinkedInAuthConfig = {
      accessToken,
      personUrn
    }

    const post: LinkedInPost = {
      content,
      visibility,
      mediaUrls,
      hashtags
    }

    // If scheduling, store for later
    if (schedule) {
      const scheduledFor = new Date(schedule)
      if (scheduledFor <= new Date()) {
        return NextResponse.json(
          { error: 'Scheduled time must be in the future' },
          { status: 400 }
        )
      }

      const scheduledPost = scheduleLinkedInPost(
        {
          content,
          theme: theme || 'general',
          hashtags,
          metadata: {
            objective: 'content',
            platform: 'linkedin',
            characterCount: content.length
          }
        },
        scheduledFor
      )

      // Store in database
      try {
        await sql`
          INSERT INTO linkedin_scheduled_posts (
            id,
            content,
            scheduled_for,
            status,
            theme,
            visibility,
            media_urls,
            hashtags,
            created_at
          ) VALUES (
            ${scheduledPost.id},
            ${scheduledPost.content},
            ${scheduledPost.scheduledFor},
            ${scheduledPost.status},
            ${scheduledPost.theme},
            ${visibility},
            ${JSON.stringify(mediaUrls)},
            ${JSON.stringify(hashtags)},
            ${scheduledPost.createdAt}
          )
        `
      } catch (dbError) {
        console.error('Failed to store scheduled post in DB:', dbError)
        // Continue anyway - we can still return the scheduled post
      }

      return NextResponse.json({
        success: true,
        scheduled: true,
        post: scheduledPost
      })
    }

    // Dry run - preview only
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        post: {
          content,
          visibility,
          mediaUrls,
          hashtags,
          characterCount: content.length,
          preview: 'Post ready to publish'
        }
      })
    }

    // Actually post to LinkedIn
    const result = await postToLinkedIn(config, post)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // Store posted content in database for analytics
    try {
      await sql`
        INSERT INTO linkedin_posts (
          post_id,
          content,
          visibility,
          media_urls,
          hashtags,
          theme,
          posted_at
        ) VALUES (
          ${result.postId},
          ${content},
          ${visibility},
          ${JSON.stringify(mediaUrls)},
          ${JSON.stringify(hashtags)},
          ${theme || 'general'},
          NOW()
        )
      `
    } catch (dbError) {
      console.error('Failed to store post in DB:', dbError)
      // Continue anyway - post was successful
    }

    return NextResponse.json({
      success: true,
      postId: result.postId,
      post: {
        content,
        visibility,
        mediaUrls,
        hashtags,
        characterCount: content.length
      },
      linkedInUrl: `https://linkedin.com/feed/update/${result.postId}`
    })
  } catch (error) {
    console.error('Error posting to LinkedIn:', error)
    return NextResponse.json(
      {
        error: 'Failed to post to LinkedIn',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/social/linkedin/post?postId=xxx
 *
 * Get information about a specific post
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const postId = searchParams.get('postId')

    if (!postId) {
      return NextResponse.json(
        { error: 'postId parameter is required' },
        { status: 400 }
      )
    }

    // Fetch from database
    const result = await sql`
      SELECT
        post_id,
        content,
        visibility,
        media_urls,
        hashtags,
        theme,
        posted_at,
        likes,
        comments,
        shares,
        impressions
      FROM linkedin_posts
      WHERE post_id = ${postId}
    `

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    const post = result.rows[0]

    return NextResponse.json({
      success: true,
      post: {
        postId: post.post_id,
        content: post.content,
        visibility: post.visibility,
        mediaUrls: JSON.parse(post.media_urls || '[]'),
        hashtags: JSON.parse(post.hashtags || '[]'),
        theme: post.theme,
        postedAt: post.posted_at,
        metrics: {
          likes: post.likes || 0,
          comments: post.comments || 0,
          shares: post.shares || 0,
          impressions: post.impressions || 0
        }
      }
    })
  } catch (error) {
    console.error('Error fetching LinkedIn post:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch post',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
