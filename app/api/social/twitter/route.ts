// Twitter API - Post tweets, threads, and manage Grain's Twitter presence
import { NextRequest, NextResponse } from 'next/server';
import {
  getGrainTwitterClient,
  GRAIN_TWEET_TEMPLATES,
  generateCodeVerifier,
  generateCodeChallenge,
  getAuthorizationUrl,
} from '@/lib/social/twitter-client';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');

// GET - Get Twitter account info and recent tweets
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Check if we need to start OAuth flow
    if (action === 'auth') {
      const clientId = process.env.TWITTER_CLIENT_ID;
      if (!clientId) {
        return NextResponse.json(
          { error: 'Twitter API not configured' },
          { status: 500 }
        );
      }

      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier);
      const state = crypto.randomUUID();

      // Store verifier for callback (in production, use secure storage)
      await sql`
        INSERT INTO grain_system_controls (id, control_type, value, metadata)
        VALUES (
          ${`twitter_oauth_${state}`},
          'oauth_verifier',
          ${verifier},
          ${JSON.stringify({ createdAt: Date.now() })}
        )
        ON CONFLICT (id) DO UPDATE SET value = ${verifier}
      `;

      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/twitter/callback`;
      const scopes = [
        'tweet.read',
        'tweet.write',
        'users.read',
        'follows.read',
        'follows.write',
        'like.read',
        'like.write',
      ];

      const authUrl = getAuthorizationUrl(
        clientId,
        redirectUri,
        scopes,
        state,
        challenge
      );

      return NextResponse.json({
        authUrl,
        state,
        message: 'Redirect user to authUrl to authorize the Twitter account',
      });
    }

    // Get account info
    const client = getGrainTwitterClient();
    const user = await client.getMe();
    const recentTweets = await client.getUserTweets(undefined, 5);

    return NextResponse.json({
      connected: true,
      account: user,
      recentTweets,
    });
  } catch (error) {
    console.error('Twitter API error:', error);

    // Check if it's an auth error
    if (String(error).includes('access token')) {
      return NextResponse.json({
        connected: false,
        error: 'Not authenticated',
        hint: 'Use GET ?action=auth to start OAuth flow',
      });
    }

    return NextResponse.json(
      { error: 'Failed to get Twitter info', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Post tweet or thread
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, text, tweets, template, templateData, replyTo } = body;

    const client = getGrainTwitterClient();

    if (action === 'tweet') {
      if (!text && !template) {
        return NextResponse.json(
          { error: 'text or template is required' },
          { status: 400 }
        );
      }

      let tweetText = text;

      // Use template if provided
      if (template && GRAIN_TWEET_TEMPLATES[template as keyof typeof GRAIN_TWEET_TEMPLATES]) {
        const templateFn = GRAIN_TWEET_TEMPLATES[template as keyof typeof GRAIN_TWEET_TEMPLATES];
        if (typeof templateFn === 'function') {
          if (template === 'treasuryUpdate') {
            tweetText = templateFn(
              templateData?.backing || 1000000,
              templateData?.supply || 1000000,
              templateData?.price || 1.023
            );
          } else if (template === 'priceMilestone') {
            tweetText = templateFn(
              templateData?.price || 1.05,
              templateData?.percentGain || 5
            );
          } else if (template === 'transactionMilestone') {
            tweetText = templateFn(
              templateData?.count || 10000,
              templateData?.volume || 5000000
            );
          } else if (template === 'coldStartReply') {
            tweetText = templateFn(templateData?.companyName || 'company');
          } else {
            tweetText = (templateFn as () => string)();
          }
        }
      }

      const tweet = await client.tweet({ text: tweetText, replyTo });

      // Log activity
      await sql`
        INSERT INTO grain_audit_logs (id, event_type, actor_id, entity_type, entity_id, metadata)
        VALUES (
          ${`audit_${Date.now()}`},
          'twitter_post',
          'system',
          'tweet',
          ${tweet.id},
          ${JSON.stringify({ text: tweetText, template, replyTo })}
        )
      `;

      return NextResponse.json({
        success: true,
        tweet,
        url: `https://twitter.com/i/status/${tweet.id}`,
      });
    }

    if (action === 'thread') {
      if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
        return NextResponse.json(
          { error: 'tweets array is required for thread' },
          { status: 400 }
        );
      }

      const threadTweets = await client.thread(tweets);

      return NextResponse.json({
        success: true,
        tweets: threadTweets,
        threadUrl: `https://twitter.com/i/status/${threadTweets[0].id}`,
      });
    }

    if (action === 'reply') {
      if (!text || !replyTo) {
        return NextResponse.json(
          { error: 'text and replyTo are required' },
          { status: 400 }
        );
      }

      const reply = await client.reply(replyTo, text);

      return NextResponse.json({
        success: true,
        tweet: reply,
        url: `https://twitter.com/i/status/${reply.id}`,
      });
    }

    if (action === 'like') {
      const { tweetId } = body;
      if (!tweetId) {
        return NextResponse.json(
          { error: 'tweetId is required' },
          { status: 400 }
        );
      }

      const liked = await client.like(tweetId);

      return NextResponse.json({ success: liked });
    }

    if (action === 'retweet') {
      const { tweetId } = body;
      if (!tweetId) {
        return NextResponse.json(
          { error: 'tweetId is required' },
          { status: 400 }
        );
      }

      const retweeted = await client.retweet(tweetId);

      return NextResponse.json({ success: retweeted });
    }

    return NextResponse.json(
      { error: 'Unknown action. Use: tweet, thread, reply, like, retweet' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Twitter API error:', error);
    return NextResponse.json(
      { error: 'Failed to perform Twitter action', details: String(error) },
      { status: 500 }
    );
  }
}
