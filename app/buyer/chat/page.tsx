'use client'

/**
 * Buyer Chat Page
 *
 * Pure conversational interface for buyers to source products.
 * No forms, no buttons - just talk to Wells.
 */

import WellsConversationalChat from '@/components/chat/WellsConversationalChat'

export default function BuyerChatPage() {
  return (
    <WellsConversationalChat
      journey="buyer"
      onDataExtracted={(data) => {
        console.log('Buyer data extracted:', data)
        // Handle extracted procurement data (product, quantity, budget, timeline)
      }}
    />
  )
}
