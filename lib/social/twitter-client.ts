// Twitter/X API Client for Grain & Vault
// Handles OAuth 2.0 and all Twitter API operations

import crypto from 'crypto';

// Twitter API configuration
const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_OAUTH_BASE = 'https://twitter.com/i/oauth2';

// Types
export interface TwitterCredentials {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface Tweet {
  id: string;
  text: string;
  createdAt?: string;
  authorId?: string;
  publicMetrics?: {
    retweetCount: number;
    replyCount: number;
    likeCount: number;
    quoteCount: number;
    impressionCount?: number;
  };
}

export interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profileImageUrl?: string;
  description?: string;
  publicMetrics?: {
    followersCount: number;
    followingCount: number;
    tweetCount: number;
  };
}

export interface TweetOptions {
  text: string;
  replyTo?: string;
  quoteTweetId?: string;
  poll?: {
    options: string[];
    durationMinutes: number;
  };
  mediaIds?: string[];
}

// OAuth 2.0 with PKCE
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function getAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  scopes: string[],
  state: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${TWITTER_OAUTH_BASE}/authorize?${params.toString()}`;
}

// Twitter API Client
export class TwitterClient {
  private credentials: TwitterCredentials;

  constructor(credentials: TwitterCredentials) {
    this.credentials = credentials;
  }

  // Get headers for API requests
  private getHeaders(): Record<string, string> {
    if (!this.credentials.accessToken) {
      throw new Error('No access token available. Please authenticate first.');
    }

    return {
      'Authorization': `Bearer ${this.credentials.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    scope: string;
  }> {
    const params = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const basicAuth = Buffer.from(
      `${this.credentials.clientId}:${this.credentials.clientSecret}`
    ).toString('base64');

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    // Update credentials
    this.credentials.accessToken = data.access_token;
    this.credentials.refreshToken = data.refresh_token;
    this.credentials.expiresAt = Date.now() + (data.expires_in * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
    };
  }

  // Refresh access token
  async refreshAccessToken(): Promise<void> {
    if (!this.credentials.refreshToken) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.credentials.refreshToken,
    });

    const basicAuth = Buffer.from(
      `${this.credentials.clientId}:${this.credentials.clientSecret}`
    ).toString('base64');

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();

    this.credentials.accessToken = data.access_token;
    this.credentials.refreshToken = data.refresh_token;
    this.credentials.expiresAt = Date.now() + (data.expires_in * 1000);
  }

  // Check if token needs refresh
  async ensureValidToken(): Promise<void> {
    if (
      this.credentials.expiresAt &&
      Date.now() > this.credentials.expiresAt - 60000 // Refresh 1 minute before expiry
    ) {
      await this.refreshAccessToken();
    }
  }

  // Get authenticated user info
  async getMe(): Promise<TwitterUser> {
    await this.ensureValidToken();

    const response = await fetch(
      `${TWITTER_API_BASE}/users/me?user.fields=profile_image_url,description,public_metrics`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get user: ${error}`);
    }

    const data = await response.json();
    return {
      id: data.data.id,
      name: data.data.name,
      username: data.data.username,
      profileImageUrl: data.data.profile_image_url,
      description: data.data.description,
      publicMetrics: data.data.public_metrics ? {
        followersCount: data.data.public_metrics.followers_count,
        followingCount: data.data.public_metrics.following_count,
        tweetCount: data.data.public_metrics.tweet_count,
      } : undefined,
    };
  }

  // Post a tweet
  async tweet(options: TweetOptions): Promise<Tweet> {
    await this.ensureValidToken();

    const body: any = { text: options.text };

    if (options.replyTo) {
      body.reply = { in_reply_to_tweet_id: options.replyTo };
    }

    if (options.quoteTweetId) {
      body.quote_tweet_id = options.quoteTweetId;
    }

    if (options.poll) {
      body.poll = {
        options: options.poll.options,
        duration_minutes: options.poll.durationMinutes,
      };
    }

    if (options.mediaIds && options.mediaIds.length > 0) {
      body.media = { media_ids: options.mediaIds };
    }

    const response = await fetch(`${TWITTER_API_BASE}/tweets`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to post tweet: ${error}`);
    }

    const data = await response.json();
    return {
      id: data.data.id,
      text: data.data.text,
    };
  }

  // Post a thread
  async thread(tweets: string[]): Promise<Tweet[]> {
    const results: Tweet[] = [];
    let previousTweetId: string | undefined;

    for (const text of tweets) {
      const tweet = await this.tweet({
        text,
        replyTo: previousTweetId,
      });
      results.push(tweet);
      previousTweetId = tweet.id;
    }

    return results;
  }

  // Delete a tweet
  async deleteTweet(tweetId: string): Promise<boolean> {
    await this.ensureValidToken();

    const response = await fetch(`${TWITTER_API_BASE}/tweets/${tweetId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return response.ok;
  }

  // Get user's recent tweets
  async getUserTweets(
    userId?: string,
    maxResults: number = 10
  ): Promise<Tweet[]> {
    await this.ensureValidToken();

    const user = userId || (await this.getMe()).id;

    const response = await fetch(
      `${TWITTER_API_BASE}/users/${user}/tweets?max_results=${maxResults}&tweet.fields=created_at,public_metrics`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get tweets: ${error}`);
    }

    const data = await response.json();

    return (data.data || []).map((tweet: any) => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      publicMetrics: tweet.public_metrics ? {
        retweetCount: tweet.public_metrics.retweet_count,
        replyCount: tweet.public_metrics.reply_count,
        likeCount: tweet.public_metrics.like_count,
        quoteCount: tweet.public_metrics.quote_count,
        impressionCount: tweet.public_metrics.impression_count,
      } : undefined,
    }));
  }

  // Get mentions
  async getMentions(maxResults: number = 10): Promise<Tweet[]> {
    await this.ensureValidToken();

    const user = await this.getMe();

    const response = await fetch(
      `${TWITTER_API_BASE}/users/${user.id}/mentions?max_results=${maxResults}&tweet.fields=created_at,author_id`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get mentions: ${error}`);
    }

    const data = await response.json();

    return (data.data || []).map((tweet: any) => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      authorId: tweet.author_id,
    }));
  }

  // Reply to a tweet
  async reply(tweetId: string, text: string): Promise<Tweet> {
    return this.tweet({ text, replyTo: tweetId });
  }

  // Like a tweet
  async like(tweetId: string): Promise<boolean> {
    await this.ensureValidToken();

    const user = await this.getMe();

    const response = await fetch(
      `${TWITTER_API_BASE}/users/${user.id}/likes`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ tweet_id: tweetId }),
      }
    );

    return response.ok;
  }

  // Retweet
  async retweet(tweetId: string): Promise<boolean> {
    await this.ensureValidToken();

    const user = await this.getMe();

    const response = await fetch(
      `${TWITTER_API_BASE}/users/${user.id}/retweets`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ tweet_id: tweetId }),
      }
    );

    return response.ok;
  }

  // Follow a user
  async follow(targetUserId: string): Promise<boolean> {
    await this.ensureValidToken();

    const user = await this.getMe();

    const response = await fetch(
      `${TWITTER_API_BASE}/users/${user.id}/following`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ target_user_id: targetUserId }),
      }
    );

    return response.ok;
  }

  // Get user by username
  async getUserByUsername(username: string): Promise<TwitterUser | null> {
    await this.ensureValidToken();

    const response = await fetch(
      `${TWITTER_API_BASE}/users/by/username/${username}?user.fields=profile_image_url,description,public_metrics`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data ? {
      id: data.data.id,
      name: data.data.name,
      username: data.data.username,
      profileImageUrl: data.data.profile_image_url,
      description: data.data.description,
      publicMetrics: data.data.public_metrics ? {
        followersCount: data.data.public_metrics.followers_count,
        followingCount: data.data.public_metrics.following_count,
        tweetCount: data.data.public_metrics.tweet_count,
      } : undefined,
    } : null;
  }
}

// Singleton for Grain Twitter account
let grainTwitterClient: TwitterClient | null = null;

export function getGrainTwitterClient(): TwitterClient {
  if (!grainTwitterClient) {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const refreshToken = process.env.TWITTER_REFRESH_TOKEN;

    if (!clientId || !clientSecret) {
      throw new Error('Twitter API credentials not configured');
    }

    grainTwitterClient = new TwitterClient({
      clientId,
      clientSecret,
      accessToken,
      refreshToken,
    });
  }

  return grainTwitterClient;
}

// Pre-built tweet templates for Grain
export const GRAIN_TWEET_TEMPLATES = {
  // Treasury updates
  treasuryUpdate: (backing: number, supply: number, price: number) =>
    `$GRAIN Treasury Update\n\nBacking: $${backing.toLocaleString()}\nSupply: ${supply.toLocaleString()}\nPrice: $${price.toFixed(4)}\n\nYour stablecoin that grows. grainandvault.com`,

  // Price milestone
  priceMilestone: (price: number, percentGain: number) =>
    `$GRAIN just hit $${price.toFixed(4)} - up ${percentGain.toFixed(1)}% since launch.\n\nNo speculation. Pure math.\nBacking + Assets = Price\n\nThis is treasury-backed stability.`,

  // Transaction milestone
  transactionMilestone: (count: number, volume: number) =>
    `$GRAIN crossed ${count.toLocaleString()} transactions.\n\nTotal volume: $${volume.toLocaleString()}\nAvg appreciation: +2.3%\n\nB2B payments that make you money.`,

  // Educational
  explainGrain: () =>
    `What is $GRAIN?\n\n1. Treasury-backed stablecoin (USDC reserves)\n2. Price = (Backing + Assets) / Supply\n3. $1 floor, unlimited upside\n4. Fees stay in treasury\n\nYour idle cash should work for you.`,

  // Cold start outreach reply
  coldStartReply: (companyName: string) =>
    `@${companyName} Every dollar you hold loses value.\n\nWith $GRAIN:\n- Same liquidity as USDC\n- Pays you to hold it\n- Treasury-backed ($1 minimum)\n\nDM for early access.`,
};

export default TwitterClient;
