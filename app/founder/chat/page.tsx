'use client'

/**
 * Founder Chat Page
 *
 * Pure conversational interface for founders.
 * Hire talent, source suppliers, find customers, get investors.
 * No forms, no buttons - just talk to Wells.
 */

import WellsConversationalChat from '@/components/chat/WellsConversationalChat'

export default function FounderChatPage() {
  return (
    <WellsConversationalChat
      journey="founder"
      onDataExtracted={(data) => {
        console.log('Founder data extracted:', data)
        // Handle extracted founder needs (hiring, sourcing, fundraising)
      }}
    />
  )
}
