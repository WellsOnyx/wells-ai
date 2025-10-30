import Pusher from 'pusher'
import PusherClient from 'pusher-js'
import { monitorAPI } from './monitoring'

/**
 * Real-Time Negotiation Infrastructure
 * Uses Pusher for WebSocket communication between buyers and suppliers
 */

// Server-side Pusher (for sending messages)
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
  useTLS: true,
})

// Client-side Pusher (for browser)
export function getPusherClient() {
  return new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
  })
}

/**
 * Negotiation Room Events
 */
export const NegotiationEvents = {
  // Supplier joins room
  SUPPLIER_JOINED: 'supplier-joined',

  // New message in room
  MESSAGE_SENT: 'message-sent',

  // Counter-offer submitted
  COUNTER_OFFER: 'counter-offer',

  // Offer accepted
  OFFER_ACCEPTED: 'offer-accepted',

  // Offer rejected
  OFFER_REJECTED: 'offer-rejected',

  // AI assistant message
  AI_SUGGESTION: 'ai-suggestion',

  // Room closed
  ROOM_CLOSED: 'room-closed',

  // Typing indicator
  USER_TYPING: 'user-typing',
}

/**
 * Message types
 */
export interface NegotiationMessage {
  id: string
  roomId: string
  senderId: string
  senderName: string
  senderType: 'buyer' | 'supplier' | 'ai'
  content: string
  timestamp: Date
  metadata?: {
    offer?: {
      price: number
      deliveryTime: string
      terms?: string
    }
    accepted?: boolean
    supplierId?: string
  }
}

/**
 * Counter-offer structure
 */
export interface CounterOffer {
  id: string
  roomId: string
  supplierId: string
  supplierName: string
  price: number
  originalPrice?: number
  deliveryTime: string
  terms?: string
  validUntil: Date
  timestamp: Date
}

/**
 * Send message to negotiation room
 */
export async function sendRoomMessage(
  roomId: string,
  message: NegotiationMessage
): Promise<void> {
  const monitor = monitorAPI('send_room_message', 'POST')

  try {
    await pusherServer.trigger(`negotiation-${roomId}`, NegotiationEvents.MESSAGE_SENT, message)
    monitor.end(true)
  } catch (error) {
    monitor.end(false)
    console.error('[PUSHER] Send message error:', error)
    throw error
  }
}

/**
 * Broadcast counter-offer to room
 */
export async function broadcastCounterOffer(
  roomId: string,
  offer: CounterOffer
): Promise<void> {
  const monitor = monitorAPI('broadcast_counter_offer', 'POST')

  try {
    await pusherServer.trigger(`negotiation-${roomId}`, NegotiationEvents.COUNTER_OFFER, offer)
    monitor.end(true)
  } catch (error) {
    monitor.end(false)
    console.error('[PUSHER] Broadcast counter-offer error:', error)
    throw error
  }
}

/**
 * Notify room that supplier joined
 */
export async function notifySupplierJoined(
  roomId: string,
  supplierInfo: {
    id: string
    name: string
    timestamp: Date
  }
): Promise<void> {
  const monitor = monitorAPI('notify_supplier_joined', 'POST')

  try {
    await pusherServer.trigger(
      `negotiation-${roomId}`,
      NegotiationEvents.SUPPLIER_JOINED,
      supplierInfo
    )
    monitor.end(true)
  } catch (error) {
    monitor.end(false)
    console.error('[PUSHER] Notify supplier joined error:', error)
    throw error
  }
}

/**
 * Send AI negotiation suggestion
 */
export async function sendAISuggestion(
  roomId: string,
  suggestion: {
    type: 'pricing' | 'timing' | 'terms' | 'general'
    message: string
    data?: any
  }
): Promise<void> {
  const monitor = monitorAPI('send_ai_suggestion', 'POST')

  try {
    await pusherServer.trigger(`negotiation-${roomId}`, NegotiationEvents.AI_SUGGESTION, {
      id: `ai-${Date.now()}`,
      roomId,
      senderId: 'wells-ai',
      senderName: 'Wells AI Assistant',
      senderType: 'ai',
      content: suggestion.message,
      timestamp: new Date(),
      metadata: {
        suggestionType: suggestion.type,
        data: suggestion.data,
      },
    })
    monitor.end(true)
  } catch (error) {
    monitor.end(false)
    console.error('[PUSHER] Send AI suggestion error:', error)
    throw error
  }
}

/**
 * Notify offer acceptance
 */
export async function notifyOfferAccepted(
  roomId: string,
  acceptance: {
    buyerId: string
    supplierId: string
    supplierName: string
    finalPrice: number
    deliveryTime: string
    timestamp: Date
  }
): Promise<void> {
  const monitor = monitorAPI('notify_offer_accepted', 'POST')

  try {
    await pusherServer.trigger(
      `negotiation-${roomId}`,
      NegotiationEvents.OFFER_ACCEPTED,
      acceptance
    )
    monitor.end(true)
  } catch (error) {
    monitor.end(false)
    console.error('[PUSHER] Notify acceptance error:', error)
    throw error
  }
}

/**
 * Close negotiation room
 */
export async function closeNegotiationRoom(
  roomId: string,
  reason: 'deal-closed' | 'timeout' | 'cancelled'
): Promise<void> {
  const monitor = monitorAPI('close_negotiation_room', 'POST')

  try {
    await pusherServer.trigger(`negotiation-${roomId}`, NegotiationEvents.ROOM_CLOSED, {
      reason,
      timestamp: new Date(),
    })
    monitor.end(true)
  } catch (error) {
    monitor.end(false)
    console.error('[PUSHER] Close room error:', error)
    throw error
  }
}

/**
 * Send typing indicator
 */
export async function sendTypingIndicator(
  roomId: string,
  user: {
    id: string
    name: string
    type: 'buyer' | 'supplier'
  }
): Promise<void> {
  try {
    await pusherServer.trigger(`negotiation-${roomId}`, NegotiationEvents.USER_TYPING, user)
  } catch (error) {
    console.error('[PUSHER] Typing indicator error:', error)
    // Don't throw - typing indicators are non-critical
  }
}

/**
 * Get room statistics
 */
export async function getRoomStats() {
  try {
    const response: any = await pusherServer.get({ path: '/channels' })
    return {
      activeRooms: response.channels ? Object.keys(response.channels).length : 0,
      timestamp: new Date(),
    }
  } catch (error) {
    console.error('[PUSHER] Get room stats error:', error)
    return {
      activeRooms: 0,
      timestamp: new Date(),
    }
  }
}
