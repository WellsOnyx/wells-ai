// @ts-nocheck
/**
 * Comments Service
 *
 * Handles team comments and internal discussions on entities
 * Supports @mentions for notifications
 */

import { sql } from '@vercel/postgres'

// ============================================================================
// TYPES
// ============================================================================

export interface Comment {
  id: string
  entityType: string
  entityId: string
  content: string
  userId: string
  parentId?: string
  isInternal: boolean
  isEdited: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Mention {
  id: string
  commentId: string
  userId: string
  notifiedAt?: Date
  readAt?: Date
  createdAt: Date
}

export type EntityType = 'deal' | 'lead' | 'supplier' | 'payment' | 'task'

// ============================================================================
// COMMENT OPERATIONS
// ============================================================================

/**
 * Add a comment to an entity
 */
export async function addComment(
  entityType: EntityType,
  entityId: string,
  userId: string,
  content: string,
  options?: {
    parentId?: string
    isInternal?: boolean
  }
): Promise<Comment> {
  try {
    const result = await sql`
      INSERT INTO comments (
        entity_type,
        entity_id,
        user_id,
        content,
        parent_id,
        is_internal
      ) VALUES (
        ${entityType},
        ${entityId},
        ${userId},
        ${content},
        ${options?.parentId || null},
        ${options?.isInternal !== undefined ? options.isInternal : true}
      )
      RETURNING *
    `

    const comment = mapCommentFromDb(result.rows[0])

    // Parse and handle mentions
    const mentions = parseMentions(content)
    if (mentions.length > 0) {
      await notifyMentionedUsers(comment.id, mentions)
    }

    return comment
  } catch (error) {
    console.error('Error adding comment:', error)
    throw new Error('Failed to add comment')
  }
}

/**
 * Get comments for an entity
 */
export async function getComments(
  entityType: EntityType,
  entityId: string,
  options?: {
    includeReplies?: boolean
  }
): Promise<Comment[]> {
  try {
    const includeReplies = options?.includeReplies !== undefined ? options.includeReplies : true

    let result
    if (includeReplies) {
      result = await sql`
        SELECT * FROM comments
        WHERE entity_type = ${entityType}
        AND entity_id = ${entityId}
        ORDER BY created_at ASC
      `
    } else {
      result = await sql`
        SELECT * FROM comments
        WHERE entity_type = ${entityType}
        AND entity_id = ${entityId}
        AND parent_id IS NULL
        ORDER BY created_at ASC
      `
    }

    return result.rows.map(mapCommentFromDb)
  } catch (error) {
    console.error('Error fetching comments:', error)
    throw new Error('Failed to fetch comments')
  }
}

/**
 * Get a specific comment
 */
export async function getComment(commentId: string): Promise<Comment | null> {
  try {
    const result = await sql`
      SELECT * FROM comments WHERE id = ${commentId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapCommentFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching comment:', error)
    throw new Error('Failed to fetch comment')
  }
}

/**
 * Edit a comment
 */
export async function editComment(
  commentId: string,
  userId: string,
  newContent: string
): Promise<Comment> {
  try {
    // Verify the user owns the comment
    const existing = await getComment(commentId)
    if (!existing) {
      throw new Error('Comment not found')
    }

    if (existing.userId !== userId) {
      throw new Error('Not authorized to edit this comment')
    }

    const result = await sql`
      UPDATE comments
      SET content = ${newContent}, is_edited = TRUE, updated_at = NOW()
      WHERE id = ${commentId}
      RETURNING *
    `

    const comment = mapCommentFromDb(result.rows[0])

    // Handle new mentions
    const mentions = parseMentions(newContent)
    if (mentions.length > 0) {
      await notifyMentionedUsers(comment.id, mentions)
    }

    return comment
  } catch (error) {
    console.error('Error editing comment:', error)
    throw new Error('Failed to edit comment')
  }
}

/**
 * Delete a comment
 */
export async function deleteComment(
  commentId: string,
  userId: string
): Promise<void> {
  try {
    // Verify the user owns the comment
    const existing = await getComment(commentId)
    if (!existing) {
      throw new Error('Comment not found')
    }

    if (existing.userId !== userId) {
      throw new Error('Not authorized to delete this comment')
    }

    await sql`
      DELETE FROM comments
      WHERE id = ${commentId}
    `
  } catch (error) {
    console.error('Error deleting comment:', error)
    throw new Error('Failed to delete comment')
  }
}

/**
 * Get replies to a comment
 */
export async function getCommentReplies(parentId: string): Promise<Comment[]> {
  try {
    const result = await sql`
      SELECT * FROM comments
      WHERE parent_id = ${parentId}
      ORDER BY created_at ASC
    `

    return result.rows.map(mapCommentFromDb)
  } catch (error) {
    console.error('Error fetching comment replies:', error)
    throw new Error('Failed to fetch comment replies')
  }
}

/**
 * Get comment count for an entity
 */
export async function getCommentCount(
  entityType: EntityType,
  entityId: string
): Promise<number> {
  try {
    const result = await sql`
      SELECT COUNT(*) as count
      FROM comments
      WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}
    `

    return parseInt(result.rows[0].count)
  } catch (error) {
    console.error('Error fetching comment count:', error)
    return 0
  }
}

// ============================================================================
// MENTION OPERATIONS
// ============================================================================

/**
 * Parse @mentions from comment content
 * Returns array of user IDs mentioned
 */
export function parseMentions(content: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
  const mentions: string[] = []
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[2]) // User ID is in the parentheses
  }

  return mentions
}

/**
 * Notify mentioned users
 */
export async function notifyMentionedUsers(
  commentId: string,
  userIds: string[]
): Promise<void> {
  try {
    for (const userId of userIds) {
      // Check if mention already exists
      const existing = await sql`
        SELECT * FROM mentions
        WHERE comment_id = ${commentId}
        AND user_id = ${userId}
      `

      if (existing.rows.length === 0) {
        await sql`
          INSERT INTO mentions (comment_id, user_id, notified_at)
          VALUES (${commentId}, ${userId}, NOW())
        `
      }
    }
  } catch (error) {
    console.error('Error notifying mentioned users:', error)
    // Don't throw - mentions are non-critical
  }
}

/**
 * Get mentions for a user
 */
export async function getUserMentions(
  userId: string,
  options?: {
    unreadOnly?: boolean
    limit?: number
  }
): Promise<Mention[]> {
  try {
    const conditions: string[] = ['user_id = $1']
    const params: any[] = [userId]

    if (options?.unreadOnly) {
      conditions.push('read_at IS NULL')
    }

    const limit = options?.limit || 50

    const query = `
      SELECT * FROM mentions
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
    `

    const result = await sql.query(query, [...params, limit])

    return result.rows.map(mapMentionFromDb)
  } catch (error) {
    console.error('Error fetching user mentions:', error)
    throw new Error('Failed to fetch user mentions')
  }
}

/**
 * Mark mention as read
 */
export async function markMentionAsRead(mentionId: string): Promise<void> {
  try {
    await sql`
      UPDATE mentions
      SET read_at = NOW()
      WHERE id = ${mentionId}
    `
  } catch (error) {
    console.error('Error marking mention as read:', error)
    throw new Error('Failed to mark mention as read')
  }
}

/**
 * Get unread mention count for a user
 */
export async function getUnreadMentionCount(userId: string): Promise<number> {
  try {
    const result = await sql`
      SELECT COUNT(*) as count
      FROM mentions
      WHERE user_id = ${userId}
      AND read_at IS NULL
    `

    return parseInt(result.rows[0].count)
  } catch (error) {
    console.error('Error fetching unread mention count:', error)
    return 0
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function mapCommentFromDb(row: any): Comment {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    content: row.content,
    userId: row.user_id,
    parentId: row.parent_id,
    isInternal: row.is_internal,
    isEdited: row.is_edited,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMentionFromDb(row: any): Mention {
  return {
    id: row.id,
    commentId: row.comment_id,
    userId: row.user_id,
    notifiedAt: row.notified_at,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}
