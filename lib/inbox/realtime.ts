/**
 * Real-time inbox updates
 * Uses Pusher for WebSocket connections
 */

import Pusher from 'pusher';
import PusherClient from 'pusher-js';

// Server-side Pusher instance
const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true
});

/**
 * Get client-side Pusher instance
 */
export function getPusherClient(): PusherClient {
  return new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!
  });
}

/**
 * Publish new message event
 */
export async function publishMessage(
  provider: string,
  threadId: string,
  message: any
): Promise<void> {
  try {
    await pusherServer.trigger(
      `inbox-${threadId}`,
      'new_message',
      {
        provider,
        message,
        timestamp: new Date().toISOString()
      }
    );

    // Also publish to user's personal channel if applicable
    if (message.to || message.participants) {
      const recipients = Array.isArray(message.to)
        ? message.to
        : message.participants || [];

      for (const recipient of recipients) {
        const userId = recipient.user_id || recipient.email;
        if (userId) {
          await pusherServer.trigger(
            `user-${userId}`,
            'new_message',
            {
              provider,
              threadId,
              message,
              timestamp: new Date().toISOString()
            }
          );
        }
      }
    }
  } catch (error) {
    console.error('Error publishing message:', error);
  }
}

/**
 * Publish thread update event
 */
export async function publishThreadUpdate(
  threadId: string,
  update: any
): Promise<void> {
  try {
    await pusherServer.trigger(
      `inbox-${threadId}`,
      'thread_updated',
      {
        threadId,
        update,
        timestamp: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error('Error publishing thread update:', error);
  }
}

/**
 * Publish message read event
 */
export async function publishMessageRead(
  threadId: string,
  messageId: string,
  userId: string
): Promise<void> {
  try {
    await pusherServer.trigger(
      `inbox-${threadId}`,
      'message_read',
      {
        messageId,
        userId,
        timestamp: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error('Error publishing message read:', error);
  }
}

/**
 * Publish typing indicator
 */
export async function publishTypingIndicator(
  threadId: string,
  userId: string,
  userName: string,
  isTyping: boolean
): Promise<void> {
  try {
    await pusherServer.trigger(
      `inbox-${threadId}`,
      'typing',
      {
        userId,
        userName,
        isTyping,
        timestamp: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error('Error publishing typing indicator:', error);
  }
}

/**
 * Publish notification
 */
export async function publishNotification(
  userId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
  }
): Promise<void> {
  try {
    await pusherServer.trigger(
      `user-${userId}`,
      'notification',
      {
        ...notification,
        timestamp: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error('Error publishing notification:', error);
  }
}

/**
 * Subscribe to thread updates (client-side)
 */
export function subscribeToThread(
  threadId: string,
  callbacks: {
    onNewMessage?: (data: any) => void;
    onThreadUpdated?: (data: any) => void;
    onMessageRead?: (data: any) => void;
    onTyping?: (data: any) => void;
  }
): () => void {
  const pusher = getPusherClient();
  const channel = pusher.subscribe(`inbox-${threadId}`);

  if (callbacks.onNewMessage) {
    channel.bind('new_message', callbacks.onNewMessage);
  }

  if (callbacks.onThreadUpdated) {
    channel.bind('thread_updated', callbacks.onThreadUpdated);
  }

  if (callbacks.onMessageRead) {
    channel.bind('message_read', callbacks.onMessageRead);
  }

  if (callbacks.onTyping) {
    channel.bind('typing', callbacks.onTyping);
  }

  // Return unsubscribe function
  return () => {
    channel.unbind_all();
    pusher.unsubscribe(`inbox-${threadId}`);
  };
}

/**
 * Subscribe to user notifications (client-side)
 */
export function subscribeToUser(
  userId: string,
  callbacks: {
    onNewMessage?: (data: any) => void;
    onNotification?: (data: any) => void;
  }
): () => void {
  const pusher = getPusherClient();
  const channel = pusher.subscribe(`user-${userId}`);

  if (callbacks.onNewMessage) {
    channel.bind('new_message', callbacks.onNewMessage);
  }

  if (callbacks.onNotification) {
    channel.bind('notification', callbacks.onNotification);
  }

  // Return unsubscribe function
  return () => {
    channel.unbind_all();
    pusher.unsubscribe(`user-${userId}`);
  };
}

/**
 * Send typing indicator
 */
export async function sendTypingIndicator(
  threadId: string,
  userId: string,
  userName: string,
  isTyping: boolean
): Promise<void> {
  await publishTypingIndicator(threadId, userId, userName, isTyping);
}

/**
 * Batch publish events
 */
export async function publishBatch(
  events: Array<{
    channel: string;
    event: string;
    data: any;
  }>
): Promise<void> {
  try {
    await pusherServer.triggerBatch(
      events.map(e => ({
        channel: e.channel,
        name: e.event,
        data: {
          ...e.data,
          timestamp: new Date().toISOString()
        }
      }))
    );
  } catch (error) {
    console.error('Error publishing batch events:', error);
  }
}

/**
 * Get presence channel for online users in a thread
 */
export function getPresenceChannel(
  threadId: string,
  userId: string,
  userInfo: { name: string; avatar?: string }
): any {
  const pusher = getPusherClient();

  const channel = pusher.subscribe(`presence-inbox-${threadId}`);

  // Update user info
  (channel as any).bind('pusher:subscription_succeeded', (members: any) => {
    console.log('Online users:', members);
  });

  (channel as any).bind('pusher:member_added', (member: any) => {
    console.log('User joined:', member);
  });

  (channel as any).bind('pusher:member_removed', (member: any) => {
    console.log('User left:', member);
  });

  return channel;
}
