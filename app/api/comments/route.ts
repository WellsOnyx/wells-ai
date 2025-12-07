// @ts-nocheck
/**
 * Comments API
 *
 * POST /api/comments - Add comment
 * GET /api/comments - Get comments for entity
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  addComment,
  getComments,
  editComment,
  deleteComment,
} from '@/lib/teams/comments'
import { logActivity } from '@/lib/teams/activity'

// ============================================================================
// POST - Add Comment
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { entityType, entityId, content, parentId, isInternal, orgId } = body

    if (!entityType || !entityId || !content) {
      return NextResponse.json(
        { error: 'entityType, entityId, and content are required' },
        { status: 400 }
      )
    }

    // Add comment
    const comment = await addComment(
      entityType,
      entityId,
      userId,
      content,
      { parentId, isInternal }
    )

    // Log activity
    if (orgId) {
      await logActivity(
        orgId,
        userId,
        'comment.added',
        entityType,
        entityId,
        { commentId: comment.id }
      )
    }

    return NextResponse.json({
      success: true,
      comment,
    })
  } catch (error) {
    console.error('Error adding comment:', error)
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get Comments
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType') as any
    const entityId = searchParams.get('entityId')
    const includeReplies = searchParams.get('includeReplies') !== 'false'

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId are required' },
        { status: 400 }
      )
    }

    // Get comments
    const comments = await getComments(entityType, entityId, { includeReplies })

    return NextResponse.json({
      comments,
    })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PATCH - Edit Comment
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { commentId, content } = body

    if (!commentId || !content) {
      return NextResponse.json(
        { error: 'commentId and content are required' },
        { status: 400 }
      )
    }

    // Edit comment
    const comment = await editComment(commentId, userId, content)

    return NextResponse.json({
      success: true,
      comment,
    })
  } catch (error) {
    console.error('Error editing comment:', error)
    return NextResponse.json(
      { error: 'Failed to edit comment' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Delete Comment
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')

    if (!commentId) {
      return NextResponse.json(
        { error: 'commentId is required' },
        { status: 400 }
      )
    }

    // Delete comment
    await deleteComment(commentId, userId)

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    )
  }
}
