import ChatInterface from '@/app/components/ChatInterface'

export const metadata = {
  title: 'Talk to Wells | Buyer Journey',
  description: 'Describe what you need. Get quotes from verified suppliers with escrow protection.',
}

export default function BuyerChatPage() {
  return (
    <ChatInterface
      journey="buyer"
      title="Buyer Journey"
      subtitle="Describe what you need in plain English. Get matched with verified suppliers."
      placeholder="I need 500 units of..."
      initialMessage="Hi! I'm Wells, your AI procurement partner. Tell me what you need to buy - products, parts, materials, equipment, services - and I'll get you quotes from verified suppliers. All deals are protected by GRAIN escrow. What are you looking for?"
      accentColor="blue"
    />
  )
}
