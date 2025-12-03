import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Talk to Wells | Buyer Journey',
  description: 'Describe what you need. Get quotes from verified suppliers with escrow protection.',
}

export default function BuyerChatPage() {
  // Redirect to new unified dashboard
  redirect('/dashboard')
}
