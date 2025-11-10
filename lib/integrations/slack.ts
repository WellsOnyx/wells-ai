/**
 * Wells Onyx AI Ops - Slack Integration
 */

import { IntegrationService, Integration } from './index';
import { cache } from '@/lib/cache';

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  memberCount: number;
  topic: string;
  purpose: string;
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
  email: string;
  isBot: boolean;
  isAdmin: boolean;
  avatar: string;
}

export interface SlackMessage {
  id: string;
  channel: string;
  user: string;
  text: string;
  timestamp: string;
  threadTs?: string;
  attachments?: any[];
  reactions?: Array<{ emoji: string; count: number; users: string[] }>;
}

export class SlackIntegration extends IntegrationService {
  private baseUrl = 'https://slack.com/api';

  constructor(integration: Integration) {
    super(integration);
  }

  async connect(clientId: string, credentials: any): Promise<void> {
    const { accessToken, teamId, teamName } = credentials;

    this.integration.credentials = {
      accessToken,
      teamId,
      teamName,
    };

    this.integration.status = 'connected';
    this.integration.lastSync = new Date().toISOString();

    await this.logAction('connect', { teamId, teamName }, 'success');
  }

  async disconnect(clientId: string): Promise<void> {
    this.integration.status = 'disconnected';
    this.integration.credentials = {};

    await this.logAction('disconnect', {}, 'success');
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.apiCall('auth.test', {});
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async syncData(): Promise<any> {
    const [channels, users] = await Promise.all([
      this.getChannelList(),
      this.getUserList(),
    ]);

    const syncData = {
      channels,
      users,
      syncedAt: new Date().toISOString(),
    };

    // Cache the sync data
    const key = `slack_sync:${this.integration.clientId}`;
    await cache.set(key, JSON.stringify(syncData), { ttl: 3600 }); // 1 hour

    this.integration.lastSync = new Date().toISOString();

    await this.logAction('sync', { channelCount: channels.length, userCount: users.length }, 'success');

    return syncData;
  }

  async sendAction(action: string, data: any): Promise<any> {
    const actionMap: Record<string, () => Promise<any>> = {
      'send-message': () => this.sendMessage(data.channel, data.text, data.options),
      'create-channel': () => this.createChannel(data.name, data.isPrivate),
      'invite-user': () => this.inviteUser(data.channel, data.user),
      'post-file': () => this.postFile(data.channel, data.file, data.title),
      'update-message': () => this.updateMessage(data.channel, data.timestamp, data.text),
      'add-reaction': () => this.addReaction(data.channel, data.timestamp, data.emoji),
      'get-messages': () => this.getMessages(data.channel, data.limit),
      'search-messages': () => this.searchMessages(data.query),
    };

    const handler = actionMap[action];
    if (!handler) {
      throw new Error(`Unknown action: ${action}`);
    }

    try {
      const result = await handler();
      await this.logAction(action, data, 'success');
      return result;
    } catch (error: any) {
      await this.logAction(action, data, 'failure', error.message);
      throw error;
    }
  }

  async getOAuthUrl(clientId: string, redirectUri: string): Promise<string> {
    const scopes = [
      'channels:read',
      'channels:write',
      'chat:write',
      'users:read',
      'files:write',
      'reactions:write',
    ];

    const state = Buffer.from(JSON.stringify({ clientId, timestamp: Date.now() })).toString('base64');

    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID || 'mock_client_id',
      scope: scopes.join(','),
      redirect_uri: redirectUri,
      state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(code: string, state: string): Promise<void> {
    // Mock OAuth callback handling
    const mockTokenResponse = {
      ok: true,
      access_token: `xoxb-mock-${Date.now()}`,
      team: {
        id: 'T12345678',
        name: 'Mock Workspace',
      },
      authed_user: {
        id: 'U12345678',
      },
    };

    await this.connect(this.integration.clientId, {
      accessToken: mockTokenResponse.access_token,
      teamId: mockTokenResponse.team.id,
      teamName: mockTokenResponse.team.name,
    });
  }

  // Slack-specific methods

  async sendMessage(
    channel: string,
    text: string,
    options?: {
      threadTs?: string;
      blocks?: any[];
      attachments?: any[];
      username?: string;
      iconEmoji?: string;
    }
  ): Promise<SlackMessage> {
    const response = await this.apiCall('chat.postMessage', {
      channel,
      text,
      ...options,
    });

    return {
      id: response.ts,
      channel,
      user: 'BOT',
      text,
      timestamp: new Date().toISOString(),
      threadTs: options?.threadTs,
      attachments: options?.attachments,
    };
  }

  async createChannel(name: string, isPrivate: boolean = false): Promise<SlackChannel> {
    const method = isPrivate ? 'conversations.create' : 'conversations.create';
    const response = await this.apiCall(method, {
      name,
      is_private: isPrivate,
    });

    return {
      id: response.channel.id,
      name: response.channel.name,
      isPrivate,
      memberCount: 1,
      topic: '',
      purpose: '',
    };
  }

  async inviteUser(channel: string, user: string): Promise<void> {
    await this.apiCall('conversations.invite', {
      channel,
      users: user,
    });
  }

  async postFile(channel: string, file: any, title?: string): Promise<any> {
    const response = await this.apiCall('files.upload', {
      channels: channel,
      file,
      title,
    });

    return response.file;
  }

  async updateMessage(channel: string, timestamp: string, text: string): Promise<SlackMessage> {
    const response = await this.apiCall('chat.update', {
      channel,
      ts: timestamp,
      text,
    });

    return {
      id: response.ts,
      channel,
      user: 'BOT',
      text,
      timestamp: new Date().toISOString(),
    };
  }

  async addReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    await this.apiCall('reactions.add', {
      channel,
      timestamp,
      name: emoji.replace(/:/g, ''),
    });
  }

  async getUserList(): Promise<SlackUser[]> {
    const response = await this.apiCall('users.list', {});

    // Mock users
    return [
      {
        id: 'U001',
        name: 'john.doe',
        realName: 'John Doe',
        email: 'john@company.com',
        isBot: false,
        isAdmin: true,
        avatar: 'https://ui-avatars.com/api/?name=John+Doe',
      },
      {
        id: 'U002',
        name: 'jane.smith',
        realName: 'Jane Smith',
        email: 'jane@company.com',
        isBot: false,
        isAdmin: false,
        avatar: 'https://ui-avatars.com/api/?name=Jane+Smith',
      },
      {
        id: 'U003',
        name: 'wellsai',
        realName: 'Wells AI Bot',
        email: 'bot@wellsonyx.com',
        isBot: true,
        isAdmin: false,
        avatar: 'https://ui-avatars.com/api/?name=Wells+AI',
      },
    ];
  }

  async getChannelList(): Promise<SlackChannel[]> {
    const response = await this.apiCall('conversations.list', {
      types: 'public_channel,private_channel',
    });

    // Mock channels
    return [
      {
        id: 'C001',
        name: 'general',
        isPrivate: false,
        memberCount: 50,
        topic: 'Company-wide announcements',
        purpose: 'General discussion',
      },
      {
        id: 'C002',
        name: 'sales',
        isPrivate: false,
        memberCount: 12,
        topic: 'Sales team discussions',
        purpose: 'Track deals and leads',
      },
      {
        id: 'C003',
        name: 'engineering',
        isPrivate: false,
        memberCount: 25,
        topic: 'Engineering discussions',
        purpose: 'Code, bugs, and deployments',
      },
      {
        id: 'C004',
        name: 'executives',
        isPrivate: true,
        memberCount: 5,
        topic: 'Executive team only',
        purpose: 'Strategic discussions',
      },
    ];
  }

  async getMessages(channel: string, limit: number = 100): Promise<SlackMessage[]> {
    const response = await this.apiCall('conversations.history', {
      channel,
      limit,
    });

    // Mock messages
    return [
      {
        id: 'msg001',
        channel,
        user: 'U001',
        text: 'New lead came in from the website!',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        reactions: [
          { emoji: 'eyes', count: 3, users: ['U002', 'U003', 'U004'] },
          { emoji: 'rocket', count: 1, users: ['U002'] },
        ],
      },
      {
        id: 'msg002',
        channel,
        user: 'U002',
        text: "I'll follow up with them",
        timestamp: new Date(Date.now() - 3000000).toISOString(),
        threadTs: 'msg001',
      },
      {
        id: 'msg003',
        channel,
        user: 'U003',
        text: 'Daily standup in 10 minutes!',
        timestamp: new Date(Date.now() - 600000).toISOString(),
      },
    ];
  }

  async searchMessages(query: string): Promise<SlackMessage[]> {
    const response = await this.apiCall('search.messages', {
      query,
    });

    // Mock search results
    return [
      {
        id: 'msg004',
        channel: 'C001',
        user: 'U001',
        text: `Search result for: ${query}`,
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
  }

  async setChannelTopic(channel: string, topic: string): Promise<void> {
    await this.apiCall('conversations.setTopic', {
      channel,
      topic,
    });
  }

  async setChannelPurpose(channel: string, purpose: string): Promise<void> {
    await this.apiCall('conversations.setPurpose', {
      channel,
      purpose,
    });
  }

  async archiveChannel(channel: string): Promise<void> {
    await this.apiCall('conversations.archive', {
      channel,
    });
  }

  async getUserInfo(user: string): Promise<SlackUser> {
    const response = await this.apiCall('users.info', {
      user,
    });

    return {
      id: user,
      name: 'mock.user',
      realName: 'Mock User',
      email: 'mock@company.com',
      isBot: false,
      isAdmin: false,
      avatar: 'https://ui-avatars.com/api/?name=Mock+User',
    };
  }

  async getUserPresence(user: string): Promise<'active' | 'away'> {
    const response = await this.apiCall('users.getPresence', {
      user,
    });

    return Math.random() > 0.5 ? 'active' : 'away';
  }

  // Private helper method
  private async apiCall(method: string, params: any): Promise<any> {
    // Mock API call
    return {
      ok: true,
      ts: `${Date.now()}.${Math.random().toString(36).substr(2, 6)}`,
      channel: {
        id: `C${Math.random().toString(36).substr(2, 9)}`,
        name: params.name || 'mock-channel',
      },
      file: {
        id: `F${Math.random().toString(36).substr(2, 9)}`,
        name: params.title || 'file.txt',
      },
    };
  }
}

export default SlackIntegration;
