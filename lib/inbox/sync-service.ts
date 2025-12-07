// Unified Inbox Sync Service
// Handles syncing messages from all providers

import { sql } from '@vercel/postgres';
import { google } from 'googleapis';
import {
  InboxProvider,
  InboxAccount,
  InboxThread,
  InboxMessage,
  MessageDirection,
  SyncStatus,
  GmailSyncCursor,
} from './types';

export class InboxSyncService {
  /**
   * Sync messages for an account
   */
  async syncAccount(accountId: string): Promise<void> {
    // Get account
    const accountResult = await sql.query(
      `SELECT * FROM inbox_accounts WHERE id = $1`,
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      throw new Error('Account not found');
    }

    const account = accountResult.rows[0];

    // Create sync log
    const syncLogId = this.generateId();
    await sql.query(
      `INSERT INTO inbox_sync_log (id, account_id, provider, sync_started_at, status)
       VALUES ($1, $2, $3, NOW(), 'running')`,
      [syncLogId, accountId, account.provider]
    );

    try {
      let messagesSynced = 0;

      // Sync based on provider
      switch (account.provider) {
        case InboxProvider.Gmail:
          messagesSynced = await this.syncGmail(account);
          break;
        case InboxProvider.LinkedIn:
          messagesSynced = await this.syncLinkedIn(account);
          break;
        case InboxProvider.X:
          messagesSynced = await this.syncX(account);
          break;
        case InboxProvider.Instagram:
          messagesSynced = await this.syncInstagram(account);
          break;
        case InboxProvider.SMS:
          messagesSynced = await this.syncSMS(account);
          break;
        case InboxProvider.Wells:
          messagesSynced = await this.syncWells(account);
          break;
        default:
          throw new Error(`Unsupported provider: ${account.provider}`);
      }

      // Update sync log
      await sql.query(
        `UPDATE inbox_sync_log
         SET sync_completed_at = NOW(),
             status = 'completed',
             messages_synced = $1
         WHERE id = $2`,
        [messagesSynced, syncLogId]
      );

      // Update account last sync
      await sql.query(
        `UPDATE inbox_accounts SET last_sync_at = NOW() WHERE id = $1`,
        [accountId]
      );

    } catch (error: any) {
      // Update sync log with error
      await sql.query(
        `UPDATE inbox_sync_log
         SET sync_completed_at = NOW(),
             status = 'failed',
             error_message = $1
         WHERE id = $2`,
        [error.message, syncLogId]
      );

      throw error;
    }
  }

  /**
   * Sync Gmail messages using Gmail API
   */
  private async syncGmail(account: any): Promise<number> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    let messagesSynced = 0;
    let syncCursor: GmailSyncCursor = account.sync_cursor
      ? JSON.parse(account.sync_cursor)
      : { historyId: '' };

    // If we have a history ID, use incremental sync
    if (syncCursor.historyId) {
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: syncCursor.historyId,
      });

      if (history.data.history) {
        for (const historyItem of history.data.history) {
          if (historyItem.messagesAdded) {
            for (const messageAdded of historyItem.messagesAdded) {
              await this.importGmailMessage(
                gmail,
                messageAdded.message!.id!,
                account
              );
              messagesSynced++;
            }
          }
        }
      }

      syncCursor.historyId = history.data.historyId || syncCursor.historyId;
    } else {
      // Full sync - get recent messages
      const messages = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 100,
      });

      if (messages.data.messages) {
        for (const message of messages.data.messages) {
          await this.importGmailMessage(gmail, message.id!, account);
          messagesSynced++;
        }
      }

      // Get current history ID for future incremental syncs
      const profile = await gmail.users.getProfile({ userId: 'me' });
      syncCursor.historyId = profile.data.historyId || '';
    }

    // Update sync cursor
    await sql.query(
      `UPDATE inbox_accounts SET sync_cursor = $1 WHERE id = $2`,
      [JSON.stringify(syncCursor), account.id]
    );

    return messagesSynced;
  }

  /**
   * Import a single Gmail message
   */
  private async importGmailMessage(
    gmail: any,
    messageId: string,
    account: any
  ): Promise<void> {
    // Check if already imported
    const existing = await sql.query(
      `SELECT id FROM inbox_messages WHERE external_message_id = $1 AND account_id = $2`,
      [messageId, account.id]
    );

    if (existing.rows.length > 0) {
      return; // Already imported
    }

    // Fetch full message
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = message.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;

    const subject = getHeader('Subject') || '(no subject)';
    const from = getHeader('From') || '';
    const to = getHeader('To') || '';
    const cc = getHeader('Cc');
    const date = getHeader('Date');

    // Extract body
    let bodyText = '';
    let bodyHtml = '';

    if (message.data.payload?.body?.data) {
      bodyText = Buffer.from(message.data.payload.body.data, 'base64').toString('utf-8');
    } else if (message.data.payload?.parts) {
      for (const part of message.data.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    // Create or get thread
    const threadId = await this.getOrCreateThread({
      userId: account.user_id,
      accountId: account.id,
      provider: InboxProvider.Gmail,
      externalThreadId: message.data.threadId || messageId,
      subject,
      participants: [{ email: from }],
    });

    // Insert message
    const inboxMessageId = this.generateId();
    await sql.query(
      `INSERT INTO inbox_messages (
        id, thread_id, account_id, user_id, provider, external_message_id,
        direction, from_address, from_name, to_addresses, cc_addresses,
        subject, body_text, body_html, attachments,
        is_read, received_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())`,
      [
        inboxMessageId,
        threadId,
        account.id,
        account.user_id,
        InboxProvider.Gmail,
        messageId,
        to.includes(account.email) ? MessageDirection.Inbound : MessageDirection.Outbound,
        from,
        null, // from_name - parse if needed
        JSON.stringify([to]),
        cc ? JSON.stringify([cc]) : null,
        subject,
        bodyText,
        bodyHtml,
        JSON.stringify([]), // attachments
        message.data.labelIds?.includes('UNREAD') ? false : true,
        date ? new Date(date) : new Date(),
      ]
    );

    // Update thread
    await sql.query(
      `UPDATE inbox_threads
       SET message_count = message_count + 1,
           last_message_at = $1,
           snippet = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [date ? new Date(date) : new Date(), bodyText.substring(0, 200), threadId]
    );
  }

  /**
   * Sync LinkedIn messages
   */
  private async syncLinkedIn(account: any): Promise<number> {
    // TODO: Implement LinkedIn messaging API sync
    // LinkedIn API endpoint: /messaging/conversations
    console.log('LinkedIn sync not yet implemented');
    return 0;
  }

  /**
   * Sync X (Twitter) DMs
   */
  private async syncX(account: any): Promise<number> {
    // TODO: Implement X (Twitter) DM sync
    // X API v2 endpoint: /2/dm_events
    console.log('X sync not yet implemented');
    return 0;
  }

  /**
   * Sync Instagram DMs
   */
  private async syncInstagram(account: any): Promise<number> {
    // TODO: Implement Instagram messaging API sync
    // Instagram Graph API endpoint: /me/conversations
    console.log('Instagram sync not yet implemented');
    return 0;
  }

  /**
   * Sync SMS messages (from Twilio or other provider)
   */
  private async syncSMS(account: any): Promise<number> {
    // TODO: Implement SMS sync from Twilio
    // Could also integrate with native SMS on iOS/Android
    console.log('SMS sync not yet implemented');
    return 0;
  }

  /**
   * Sync Wells AI internal messages
   */
  private async syncWells(account: any): Promise<number> {
    // TODO: Implement Wells AI internal messaging sync
    console.log('Wells sync not yet implemented');
    return 0;
  }

  /**
   * Get or create a thread
   */
  private async getOrCreateThread(params: {
    userId: string;
    accountId: string;
    provider: InboxProvider;
    externalThreadId: string;
    subject?: string;
    participants: any[];
  }): Promise<string> {
    // Try to find existing thread
    const existing = await sql.query(
      `SELECT id FROM inbox_threads
       WHERE user_id = $1 AND account_id = $2 AND external_thread_id = $3`,
      [params.userId, params.accountId, params.externalThreadId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }

    // Create new thread
    const threadId = this.generateId();
    await sql.query(
      `INSERT INTO inbox_threads (
        id, user_id, account_id, provider, external_thread_id,
        subject, participants, labels, message_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, NOW(), NOW())`,
      [
        threadId,
        params.userId,
        params.accountId,
        params.provider,
        params.externalThreadId,
        params.subject || null,
        JSON.stringify(params.participants),
        JSON.stringify(['inbox']),
      ]
    );

    return threadId;
  }

  /**
   * Sync all active accounts for a user
   */
  async syncAllAccounts(userId: string): Promise<void> {
    const accounts = await sql.query(
      `SELECT id FROM inbox_accounts WHERE user_id = $1 AND is_active = true`,
      [userId]
    );

    for (const account of accounts.rows) {
      try {
        await this.syncAccount(account.id);
      } catch (error) {
        console.error(`Failed to sync account ${account.id}:`, error);
        // Continue with other accounts
      }
    }
  }

  /**
   * Background job to sync all accounts
   */
  async syncAllAccountsBackground(): Promise<void> {
    const accounts = await sql.query(
      `SELECT id FROM inbox_accounts WHERE is_active = true`
    );

    console.log(`Syncing ${accounts.rows.length} accounts...`);

    for (const account of accounts.rows) {
      try {
        await this.syncAccount(account.id);
      } catch (error) {
        console.error(`Failed to sync account ${account.id}:`, error);
      }
    }

    console.log('All accounts synced');
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const inboxSyncService = new InboxSyncService();
