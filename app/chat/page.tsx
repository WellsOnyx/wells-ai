'use client'

/**
 * Wells AI Main Chat Page
 *
 * The unified chat interface - no forms, no buttons, just pure conversation.
 * Wells detects your intent and routes you to the right journey.
 */

import WellsConversationalChat from '@/components/chat/WellsConversationalChat'
import { useRouter } from 'next/navigation'
import type { JourneyType } from '@/components/chat/WellsConversationalChat'

export default function ChatPage() {
  const router = useRouter()

  const handleJourneyDetected = (journey: JourneyType) => {
    // Optionally redirect to journey-specific chat
    // Or just let the chat continue with the detected context
    console.log('Journey detected:', journey)
  }

  return (
    <WellsConversationalChat
      journey="general"
      onJourneyDetected={handleJourneyDetected}
      onDataExtracted={(data) => {
        console.log('Data extracted:', data)
      }}
    />
  )
}
