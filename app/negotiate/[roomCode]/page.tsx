'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { getPusherClient } from '@/lib/pusher'
import { NegotiationEvents } from '@/lib/pusher'

interface Message {
  id: string
  senderId: string
  senderName: string
  senderType: 'buyer' | 'supplier' | 'ai'
  content: string
  timestamp: Date
  metadata?: any
}

interface CounterOffer {
  id: string
  supplierId: string
  supplierName: string
  originalPrice?: number
  offeredPrice: number
  deliveryTime: string
  terms?: string
  status: string
  validUntil: Date
  createdAt: Date
}

interface Participant {
  id: string
  participantId: string
  type: 'buyer' | 'supplier'
  name: string
  joinedAt: Date
  isActive: boolean
}

interface RoomData {
  room: {
    id: string
    roomCode: string
    status: string
    buyerId: string
    buyerEmail: string
  }
  participants: Participant[]
  messages: Message[]
  counterOffers: CounterOffer[]
  stats: {
    supplierCount: number
    messageCount: number
    counterOfferCount: number
  }
}

export default function NegotiationRoomPage() {
  const params = useParams()
  const roomCode = params.roomCode as string

  const [roomData, setRoomData] = useState<RoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [userType, setUserType] = useState<'buyer' | 'supplier'>('buyer')
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('')

  const [messageInput, setMessageInput] = useState('')
  const [offerPrice, setOfferPrice] = useState('')
  const [offerDelivery, setOfferDelivery] = useState('')
  const [offerTerms, setOfferTerms] = useState('')

  const [showOfferForm, setShowOfferForm] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pusherRef = useRef<any>(null)

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load room data
  useEffect(() => {
    async function loadRoom() {
      try {
        const response = await fetch(`/api/negotiation/${roomCode}`)
        if (!response.ok) {
          throw new Error('Room not found')
        }

        const data = await response.json()
        setRoomData(data)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load room')
        setLoading(false)
      }
    }

    loadRoom()
  }, [roomCode])

  // Set up Pusher real-time updates
  useEffect(() => {
    if (!roomData) return

    const pusher = getPusherClient()
    const channel = pusher.subscribe(`negotiation-${roomData.room.id}`)

    // New message
    channel.bind(NegotiationEvents.MESSAGE_SENT, (message: Message) => {
      setRoomData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          messages: [...prev.messages, message],
        }
      })
      scrollToBottom()
    })

    // Supplier joined
    channel.bind(NegotiationEvents.SUPPLIER_JOINED, (supplierInfo: any) => {
      setRoomData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          participants: [
            ...prev.participants,
            {
              id: supplierInfo.id,
              participantId: supplierInfo.id,
              type: 'supplier',
              name: supplierInfo.name,
              joinedAt: supplierInfo.timestamp,
              isActive: true,
            },
          ],
          stats: {
            ...prev.stats,
            supplierCount: prev.stats.supplierCount + 1,
          },
        }
      })
    })

    // Counter offer
    channel.bind(NegotiationEvents.COUNTER_OFFER, (offer: CounterOffer) => {
      setRoomData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          counterOffers: [...prev.counterOffers, offer],
          stats: {
            ...prev.stats,
            counterOfferCount: prev.stats.counterOfferCount + 1,
          },
        }
      })
    })

    // Offer accepted
    channel.bind(NegotiationEvents.OFFER_ACCEPTED, (acceptance: any) => {
      setRoomData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          room: {
            ...prev.room,
            status: 'completed',
          },
        }
      })
    })

    // AI suggestion
    channel.bind(NegotiationEvents.AI_SUGGESTION, (suggestion: any) => {
      setAiSuggestion(suggestion.content)
      setTimeout(() => setAiSuggestion(null), 10000) // Hide after 10 seconds
    })

    pusherRef.current = pusher

    return () => {
      channel.unbind_all()
      channel.unsubscribe()
    }
  }, [roomData?.room.id])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom()
  }, [roomData?.messages.length])

  // Send message
  async function sendMessage() {
    if (!messageInput.trim() || !roomData || !userId || !userName) return

    try {
      await fetch(`/api/negotiation/${roomData.room.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: userId,
          senderName: userName,
          senderType: userType,
          content: messageInput,
        }),
      })

      setMessageInput('')
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }

  // Submit counter offer
  async function submitCounterOffer() {
    if (!roomData || !userId || !userName || !offerPrice || !offerDelivery) return

    try {
      await fetch(`/api/negotiation/${roomData.room.id}/counter-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          supplierId: userId,
          supplierName: userName,
          offeredPrice: parseFloat(offerPrice),
          deliveryTime: offerDelivery,
          terms: offerTerms,
          validHours: 24,
        }),
      })

      setShowOfferForm(false)
      setOfferPrice('')
      setOfferDelivery('')
      setOfferTerms('')
    } catch (err) {
      console.error('Failed to submit counter offer:', err)
    }
  }

  // Accept counter offer
  async function acceptOffer(offerId: string) {
    if (!roomData || !userId) return

    const confirmed = confirm('Accept this offer? This will close the negotiation.')
    if (!confirmed) return

    try {
      await fetch(`/api/negotiation/${roomData.room.id}/counter-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          offerId,
          buyerId: userId,
        }),
      })
    } catch (err) {
      console.error('Failed to accept offer:', err)
    }
  }

  // Request AI assistance
  async function requestAIAssist(type: 'pricing' | 'timing' | 'terms' | 'general') {
    if (!roomData) return

    try {
      const response = await fetch(`/api/negotiation/${roomData.room.id}/ai-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          userType,
        }),
      })

      if (response.ok) {
        // AI suggestion will arrive via WebSocket
      }
    } catch (err) {
      console.error('Failed to request AI assistance:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading negotiation room...</p>
        </div>
      </div>
    )
  }

  if (error || !roomData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Room Not Found</h2>
          <p className="mt-2 text-gray-600">{error || 'This room does not exist or has expired.'}</p>
        </div>
      </div>
    )
  }

  // Show user setup if not configured
  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4">Join Negotiation</h2>
          <p className="text-gray-600 mb-4">Room: {roomData.room.roomCode}</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
              <input
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Role</label>
              <select
                value={userType}
                onChange={e => setUserType(e.target.value as 'buyer' | 'supplier')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="buyer">Buyer</option>
                <option value="supplier">Supplier</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your ID</label>
              <input
                type="text"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter your user ID"
              />
            </div>

            <button
              onClick={() => {
                if (userName && userId) {
                  // Join room
                  if (userType === 'supplier') {
                    fetch(`/api/negotiation/${roomData.room.id}/join`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        supplierId: userId,
                        supplierName: userName,
                      }),
                    })
                  }
                }
              }}
              disabled={!userName || !userId}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Negotiation Room</h1>
            <p className="text-sm text-gray-600">
              Code: {roomData.room.roomCode} • Status:{' '}
              <span
                className={`font-medium ${
                  roomData.room.status === 'active'
                    ? 'text-green-600'
                    : roomData.room.status === 'completed'
                    ? 'text-blue-600'
                    : 'text-gray-600'
                }`}
              >
                {roomData.room.status}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            <p className="text-xs text-gray-600 capitalize">{userType}</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-140px)]">
          {/* Participants & Stats */}
          <div className="col-span-3 bg-white rounded-lg shadow-sm p-4 overflow-y-auto">
            <h3 className="font-bold text-gray-900 mb-3">Participants ({roomData.participants.length})</h3>
            <div className="space-y-2 mb-6">
              {roomData.participants.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      p.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  ></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{p.type}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="font-bold text-gray-900 mb-3">Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Suppliers:</span>
                <span className="font-medium">{roomData.stats.supplierCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Messages:</span>
                <span className="font-medium">{roomData.stats.messageCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Offers:</span>
                <span className="font-medium">{roomData.stats.counterOfferCount}</span>
              </div>
            </div>

            {/* AI Assistant */}
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-bold text-gray-900 mb-3">AI Assistant</h3>
              <div className="space-y-2">
                <button
                  onClick={() => requestAIAssist('pricing')}
                  className="w-full text-left px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                >
                  💰 Pricing Advice
                </button>
                <button
                  onClick={() => requestAIAssist('timing')}
                  className="w-full text-left px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                >
                  ⏱️ Timing Advice
                </button>
                <button
                  onClick={() => requestAIAssist('terms')}
                  className="w-full text-left px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                >
                  📋 Terms Advice
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="col-span-6 bg-white rounded-lg shadow-sm flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-900">Conversation</h3>
            </div>

            {/* AI Suggestion */}
            {aiSuggestion && (
              <div className="mx-4 mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm font-medium text-purple-900 mb-1">🤖 AI Suggestion</p>
                <p className="text-sm text-purple-800">{aiSuggestion}</p>
              </div>
            )}

            {/* Message list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {roomData.messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.senderId === userId ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      msg.senderType === 'ai'
                        ? 'bg-purple-100 text-purple-900'
                        : msg.senderId === userId
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-xs font-medium mb-1 opacity-75">{msg.senderName}</p>
                    <p className="text-sm">{msg.content}</p>
                    <p className="text-xs mt-1 opacity-50">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            {roomData.room.status === 'active' && (
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <button
                    onClick={sendMessage}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Counter Offers */}
          <div className="col-span-3 bg-white rounded-lg shadow-sm p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900">Offers</h3>
              {userType === 'supplier' && roomData.room.status === 'active' && (
                <button
                  onClick={() => setShowOfferForm(!showOfferForm)}
                  className="text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  {showOfferForm ? 'Cancel' : '+ New'}
                </button>
              )}
            </div>

            {/* Offer form */}
            {showOfferForm && userType === 'supplier' && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
                <input
                  type="number"
                  value={offerPrice}
                  onChange={e => setOfferPrice(e.target.value)}
                  placeholder="Price ($)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                />
                <input
                  type="text"
                  value={offerDelivery}
                  onChange={e => setOfferDelivery(e.target.value)}
                  placeholder="Delivery (e.g., 4-6 weeks)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                />
                <textarea
                  value={offerTerms}
                  onChange={e => setOfferTerms(e.target.value)}
                  placeholder="Terms (optional)"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                />
                <button
                  onClick={submitCounterOffer}
                  className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Submit Offer
                </button>
              </div>
            )}

            {/* Offer list */}
            <div className="space-y-3">
              {roomData.counterOffers.map(offer => (
                <div key={offer.id} className="p-3 border border-gray-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">{offer.supplierName}</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    ${offer.offeredPrice.toLocaleString()}
                  </p>
                  {offer.originalPrice && (
                    <p className="text-xs text-gray-500 line-through">
                      ${offer.originalPrice.toLocaleString()}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mt-2">⏱️ {offer.deliveryTime}</p>
                  {offer.terms && (
                    <p className="text-xs text-gray-500 mt-1">{offer.terms}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        offer.status === 'accepted'
                          ? 'bg-green-100 text-green-700'
                          : offer.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : offer.status === 'expired'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {offer.status}
                    </span>
                    {userType === 'buyer' && offer.status === 'pending' && (
                      <button
                        onClick={() => acceptOffer(offer.id)}
                        className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Accept
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
