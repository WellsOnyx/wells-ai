import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createNotionClient } from '@/lib/notion';

/**
 * Register iOS push notification token
 *
 * Called by iOS app when user grants push notification permission.
 * Stores token in Notion database for later use.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { pushToken, platform, deviceInfo } = await req.json();

    if (!pushToken) {
      return NextResponse.json(
        { error: 'Push token is required' },
        { status: 400 }
      );
    }

    const pushTokensDbId = process.env.NOTION_PUSH_TOKENS_DATABASE_ID;

    // If Notion isn't configured, just log and return success
    if (!pushTokensDbId) {
      console.log('[PUSH] Token registered (no Notion):', {
        userId,
        pushToken: pushToken.substring(0, 20) + '...',
        platform,
      });

      return NextResponse.json({
        success: true,
        message: 'Push notifications enabled (local mode)',
      });
    }

    const notion = createNotionClient();

    // Check if this user already has a push token registered
    // @ts-ignore - Notion SDK types
    const existingTokens = await notion.databases.query({
      database_id: pushTokensDbId,
      filter: {
        and: [
          {
            property: 'User ID',
            rich_text: {
              equals: userId,
            },
          },
          {
            property: 'Platform',
            select: {
              equals: platform || 'ios',
            },
          },
        ],
      },
    });

    if (existingTokens.results.length > 0) {
      // Update existing token
      const existingToken = existingTokens.results[0];

      await notion.pages.update({
        page_id: existingToken.id,
        properties: {
          'Push Token': {
            rich_text: [{ text: { content: pushToken } }],
          },
          'Last Updated': {
            date: { start: new Date().toISOString() },
          },
          'Device Info': {
            rich_text: [{ text: { content: JSON.stringify(deviceInfo || {}) } }],
          },
          'Active': {
            checkbox: true,
          },
        },
      });

      console.log('[PUSH] Token updated for user:', userId);
    } else {
      // Create new token entry
      await notion.pages.create({
        parent: { database_id: pushTokensDbId },
        properties: {
          'User ID': {
            rich_text: [{ text: { content: userId } }],
          },
          'Push Token': {
            rich_text: [{ text: { content: pushToken } }],
          },
          'Platform': {
            select: { name: platform || 'ios' },
          },
          'Device Info': {
            rich_text: [{ text: { content: JSON.stringify(deviceInfo || {}) } }],
          },
          'Registered': {
            date: { start: new Date().toISOString() },
          },
          'Last Updated': {
            date: { start: new Date().toISOString() },
          },
          'Active': {
            checkbox: true,
          },
        } as any,
      });

      console.log('[PUSH] Token registered for user:', userId);
    }

    return NextResponse.json({
      success: true,
      message: 'Push notifications enabled',
    });

  } catch (error) {
    console.error('[PUSH] Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register push token' },
      { status: 500 }
    );
  }
}

/**
 * Get push token for a user (for internal use)
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const pushTokensDbId = process.env.NOTION_PUSH_TOKENS_DATABASE_ID;

    if (!pushTokensDbId) {
      return NextResponse.json({
        hasToken: false,
        platform: null,
      });
    }

    const notion = createNotionClient();

    // @ts-ignore - Notion SDK types
    const tokens = await notion.databases.query({
      database_id: pushTokensDbId,
      filter: {
        and: [
          {
            property: 'User ID',
            rich_text: {
              equals: userId,
            },
          },
          {
            property: 'Active',
            checkbox: {
              equals: true,
            },
          },
        ],
      },
    });

    if (tokens.results.length === 0) {
      return NextResponse.json({
        hasToken: false,
        platform: null,
      });
    }

    const token = tokens.results[0] as any;

    return NextResponse.json({
      hasToken: true,
      platform: token.properties.Platform?.select?.name || 'unknown',
      registeredAt: token.properties.Registered?.date?.start,
    });

  } catch (error) {
    console.error('[PUSH] Get token error:', error);
    return NextResponse.json(
      { error: 'Failed to get push token' },
      { status: 500 }
    );
  }
}
