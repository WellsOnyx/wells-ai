import ChatInterface from '@/app/components/ChatInterface'

export const metadata = {
  title: 'Talk to Wells | Founder Journey',
  description: 'Tell Wells what you need. Find talent, suppliers, customers, and investors.',
}

export default function FounderChatPage() {
  return (
    <ChatInterface
      journey="founder"
      title="Founder Journey"
      subtitle="Tell Wells what you're building. Get matched with talent, suppliers, customers, and investors."
      placeholder="I need to hire a CTO..."
      initialMessage="Hey! I'm Wells, your AI partner for building and scaling. Tell me what you're working on and what you need - whether it's hiring talent, sourcing suppliers, finding customers, or connecting with investors. What can I help you with?"
      accentColor="amber"
    />
  )
}
