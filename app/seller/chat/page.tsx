'use client'

/**
 * Seller Chat Page
 *
 * Pure conversational interface for sellers to find buyers.
 * No forms, no buttons - just talk to Wells.
 */

import WellsConversationalChat from '@/components/chat/WellsConversationalChat'

export default function SellerChatPage() {
  return (
    <WellsConversationalChat
      journey="seller"
      onDataExtracted={(data) => {
        console.log('Seller data extracted:', data)
        // Handle extracted seller data (products, categories, capabilities)
      }}
    />
  )
}
