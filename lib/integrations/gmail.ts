/**
 * Wells Onyx AI Ops - Gmail Integration
 */

import { IntegrationService, Integration } from './index';
import { cache } from '@/lib/cache';

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  snippet: string;
  date: string;
  labels: string[];
  attachments: GmailAttachment[];
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
}

export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // base64 encoded
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  color?: {
    backgroundColor: string;
    textColor: string;
  };
  messagesTotal: number;
  messagesUnread: number;
}

export interface GmailThread {
  id: string;
  messages: GmailMessage[];
  subject: string;
  participants: string[];
  lastMessageDate: string;
  messageCount: number;
}

export interface GmailDraft {
  id: string;
  message: GmailMessage;
}

export interface GmailSearchQuery {
  query: string;
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}

export class GmailIntegration extends IntegrationService {
  private baseUrl = 'https://gmail.googleapis.com/gmail/v1';

  constructor(integration: Integration) {
    super(integration);
  }

  async connect(clientId: string, credentials: any): Promise<void> {
    const { accessToken, refreshToken, email } = credentials;

    this.integration.credentials = {
      accessToken,
      refreshToken,
      email,
    };

    this.integration.status = 'connected';
    this.integration.lastSync = new Date().toISOString();

    await this.logAction('connect', { email }, 'success');
  }

  async disconnect(clientId: string): Promise<void> {
    this.integration.status = 'disconnected';
    this.integration.credentials = {};

    await this.logAction('disconnect', {}, 'success');
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.apiCall('GET', '/users/me/profile', {});
      return !!response.emailAddress;
    } catch (error) {
      return false;
    }
  }

  async syncData(): Promise<any> {
    const [messages, labels] = await Promise.all([
      this.getMessages({ maxResults: 50 }),
      this.getLabels(),
    ]);

    const syncData = {
      messages,
      labels,
      syncedAt: new Date().toISOString(),
    };

    const key = `gmail_sync:${this.integration.clientId}`;
    await cache.set(key, JSON.stringify(syncData), { ttl: 3600 });

    this.integration.lastSync = new Date().toISOString();

    await this.logAction('sync', { messageCount: messages.length, labelCount: labels.length }, 'success');

    return syncData;
  }

  async sendAction(action: string, data: any): Promise<any> {
    const actionMap: Record<string, () => Promise<any>> = {
      'send-email': () => this.sendEmail(data.to, data.subject, data.body, data.options),
      'read-inbox': () => this.getMessages({ maxResults: data.maxResults || 50 }),
      'search-emails': () => this.searchMessages(data.query),
      'create-draft': () => this.createDraft(data.to, data.subject, data.body),
      'reply-to-thread': () => this.replyToThread(data.threadId, data.body),
      'add-label': () => this.addLabel(data.messageId, data.labelId),
      'mark-read': () => this.markAsRead(data.messageId),
      'mark-unread': () => this.markAsUnread(data.messageId),
      'archive': () => this.archiveMessage(data.messageId),
      'delete': () => this.deleteMessage(data.messageId),
      'get-attachment': () => this.getAttachment(data.messageId, data.attachmentId),
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
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
    ];

    const state = Buffer.from(JSON.stringify({ clientId, timestamp: Date.now() })).toString('base64');

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || 'mock_client_id',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  // Gmail-specific methods

  async sendEmail(
    to: string | string[],
    subject: string,
    body: string,
    options?: {
      cc?: string[];
      bcc?: string[];
      html?: boolean;
      attachments?: GmailAttachment[];
      threadId?: string;
      replyTo?: string;
    }
  ): Promise<GmailMessage> {
    const toArray = Array.isArray(to) ? to : [to];

    const email = this.createEmailMessage({
      to: toArray,
      cc: options?.cc,
      bcc: options?.bcc,
      subject,
      body,
      html: options?.html,
      attachments: options?.attachments,
    });

    const response = await this.apiCall('POST', '/users/me/messages/send', {
      raw: email,
      threadId: options?.threadId,
    });

    return {
      id: response.id,
      threadId: response.threadId || response.id,
      from: this.integration.credentials.email,
      to: toArray,
      cc: options?.cc,
      bcc: options?.bcc,
      subject,
      body,
      bodyHtml: options?.html ? body : undefined,
      snippet: body.substring(0, 100),
      date: new Date().toISOString(),
      labels: ['SENT'],
      attachments: options?.attachments || [],
      isRead: true,
      isStarred: false,
      isImportant: false,
    };
  }

  async getMessages(options?: { maxResults?: number; labelIds?: string[]; pageToken?: string }): Promise<GmailMessage[]> {
    const response = await this.apiCall('GET', '/users/me/messages', {
      maxResults: options?.maxResults || 100,
      labelIds: options?.labelIds,
      pageToken: options?.pageToken,
    });

    // Mock messages
    return [
      {
        id: 'msg001',
        threadId: 'thread001',
        from: 'client@company.com',
        to: [this.integration.credentials.email],
        subject: 'Project Update Required',
        body: 'Hi, can you provide an update on the current project status?',
        snippet: 'Hi, can you provide an update...',
        date: new Date(Date.now() - 3600000).toISOString(),
        labels: ['INBOX', 'UNREAD'],
        attachments: [],
        isRead: false,
        isStarred: false,
        isImportant: true,
      },
      {
        id: 'msg002',
        threadId: 'thread002',
        from: 'team@company.com',
        to: [this.integration.credentials.email],
        cc: ['manager@company.com'],
        subject: 'Meeting Tomorrow at 2pm',
        body: 'Reminder: We have our weekly sync meeting tomorrow at 2pm.',
        snippet: 'Reminder: We have our weekly sync...',
        date: new Date(Date.now() - 7200000).toISOString(),
        labels: ['INBOX'],
        attachments: [],
        isRead: true,
        isStarred: false,
        isImportant: false,
      },
      {
        id: 'msg003',
        threadId: 'thread003',
        from: 'noreply@service.com',
        to: [this.integration.credentials.email],
        subject: 'Your Invoice #12345',
        body: 'Thank you for your payment. Your invoice is attached.',
        snippet: 'Thank you for your payment...',
        date: new Date(Date.now() - 86400000).toISOString(),
        labels: ['INBOX'],
        attachments: [
          {
            id: 'attach001',
            filename: 'invoice-12345.pdf',
            mimeType: 'application/pdf',
            size: 45678,
          },
        ],
        isRead: true,
        isStarred: true,
        isImportant: false,
      },
    ];
  }

  async getMessage(messageId: string): Promise<GmailMessage> {
    const response = await this.apiCall('GET', `/users/me/messages/${messageId}`, {
      format: 'full',
    });

    return this.parseMockMessage(messageId);
  }

  async searchMessages(query: string): Promise<GmailMessage[]> {
    const response = await this.apiCall('GET', '/users/me/messages', {
      q: query,
    });

    // Mock search results
    return [
      {
        id: 'search001',
        threadId: 'thread004',
        from: 'search@example.com',
        to: [this.integration.credentials.email],
        subject: `Search result for: ${query}`,
        body: `This message matches your search query: ${query}`,
        snippet: `This message matches your search...`,
        date: new Date(Date.now() - 172800000).toISOString(),
        labels: ['INBOX'],
        attachments: [],
        isRead: true,
        isStarred: false,
        isImportant: false,
      },
    ];
  }

  async createDraft(to: string | string[], subject: string, body: string): Promise<GmailDraft> {
    const toArray = Array.isArray(to) ? to : [to];

    const email = this.createEmailMessage({
      to: toArray,
      subject,
      body,
    });

    const response = await this.apiCall('POST', '/users/me/drafts', {
      message: { raw: email },
    });

    return {
      id: response.id,
      message: {
        id: 'draft_msg_' + response.id,
        threadId: '',
        from: this.integration.credentials.email,
        to: toArray,
        subject,
        body,
        snippet: body.substring(0, 100),
        date: new Date().toISOString(),
        labels: ['DRAFT'],
        attachments: [],
        isRead: true,
        isStarred: false,
        isImportant: false,
      },
    };
  }

  async replyToThread(threadId: string, body: string): Promise<GmailMessage> {
    const thread = await this.getThread(threadId);
    const originalMessage = thread.messages[thread.messages.length - 1];

    return this.sendEmail(originalMessage.from, `Re: ${originalMessage.subject}`, body, {
      threadId,
    });
  }

  async getThread(threadId: string): Promise<GmailThread> {
    const response = await this.apiCall('GET', `/users/me/threads/${threadId}`, {
      format: 'full',
    });

    // Mock thread
    const messages = [this.parseMockMessage('msg001')];

    return {
      id: threadId,
      messages,
      subject: messages[0].subject,
      participants: [messages[0].from, ...messages[0].to],
      lastMessageDate: messages[messages.length - 1].date,
      messageCount: messages.length,
    };
  }

  async addLabel(messageId: string, labelId: string): Promise<void> {
    await this.apiCall('POST', `/users/me/messages/${messageId}/modify`, {
      addLabelIds: [labelId],
    });
  }

  async removeLabel(messageId: string, labelId: string): Promise<void> {
    await this.apiCall('POST', `/users/me/messages/${messageId}/modify`, {
      removeLabelIds: [labelId],
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.removeLabel(messageId, 'UNREAD');
  }

  async markAsUnread(messageId: string): Promise<void> {
    await this.addLabel(messageId, 'UNREAD');
  }

  async archiveMessage(messageId: string): Promise<void> {
    await this.removeLabel(messageId, 'INBOX');
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.apiCall('DELETE', `/users/me/messages/${messageId}`, {});
  }

  async trashMessage(messageId: string): Promise<void> {
    await this.apiCall('POST', `/users/me/messages/${messageId}/trash`, {});
  }

  async starMessage(messageId: string): Promise<void> {
    await this.addLabel(messageId, 'STARRED');
  }

  async getLabels(): Promise<GmailLabel[]> {
    const response = await this.apiCall('GET', '/users/me/labels', {});

    // Mock labels
    return [
      {
        id: 'INBOX',
        name: 'Inbox',
        type: 'system',
        messagesTotal: 42,
        messagesUnread: 5,
      },
      {
        id: 'SENT',
        name: 'Sent',
        type: 'system',
        messagesTotal: 156,
        messagesUnread: 0,
      },
      {
        id: 'DRAFT',
        name: 'Drafts',
        type: 'system',
        messagesTotal: 3,
        messagesUnread: 0,
      },
      {
        id: 'Label_1',
        name: 'Work',
        type: 'user',
        color: {
          backgroundColor: '#42d692',
          textColor: '#ffffff',
        },
        messagesTotal: 28,
        messagesUnread: 2,
      },
      {
        id: 'Label_2',
        name: 'Important',
        type: 'user',
        color: {
          backgroundColor: '#f691b2',
          textColor: '#ffffff',
        },
        messagesTotal: 12,
        messagesUnread: 1,
      },
    ];
  }

  async createLabel(name: string, color?: { backgroundColor: string; textColor: string }): Promise<GmailLabel> {
    const response = await this.apiCall('POST', '/users/me/labels', {
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      color,
    });

    return {
      id: response.id,
      name,
      type: 'user',
      color,
      messagesTotal: 0,
      messagesUnread: 0,
    };
  }

  async getAttachment(messageId: string, attachmentId: string): Promise<GmailAttachment> {
    const response = await this.apiCall('GET', `/users/me/messages/${messageId}/attachments/${attachmentId}`, {});

    return {
      id: attachmentId,
      filename: 'mock-attachment.pdf',
      mimeType: 'application/pdf',
      size: 12345,
      data: response.data,
    };
  }

  async sendBatch(messages: Array<{ to: string; subject: string; body: string }>): Promise<GmailMessage[]> {
    const results = await Promise.all(
      messages.map((msg) => this.sendEmail(msg.to, msg.subject, msg.body))
    );

    return results;
  }

  // Private helper methods
  private async apiCall(method: string, endpoint: string, data: any): Promise<any> {
    // Mock API call
    return {
      id: `gmail${Date.now()}`,
      threadId: `thread${Date.now()}`,
      emailAddress: this.integration.credentials.email,
      data: 'base64encodeddata==',
    };
  }

  private createEmailMessage(options: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    html?: boolean;
    attachments?: GmailAttachment[];
  }): string {
    const lines = [];

    lines.push(`To: ${options.to.join(', ')}`);
    if (options.cc) lines.push(`Cc: ${options.cc.join(', ')}`);
    if (options.bcc) lines.push(`Bcc: ${options.bcc.join(', ')}`);
    lines.push(`Subject: ${options.subject}`);
    lines.push(`Content-Type: ${options.html ? 'text/html' : 'text/plain'}; charset=utf-8`);
    lines.push('');
    lines.push(options.body);

    const email = lines.join('\r\n');
    return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private parseMockMessage(messageId: string): GmailMessage {
    return {
      id: messageId,
      threadId: 'thread001',
      from: 'mock@example.com',
      to: [this.integration.credentials.email],
      subject: 'Mock Message',
      body: 'This is a mock message for testing.',
      snippet: 'This is a mock message...',
      date: new Date().toISOString(),
      labels: ['INBOX'],
      attachments: [],
      isRead: false,
      isStarred: false,
      isImportant: false,
    };
  }
}

export default GmailIntegration;
