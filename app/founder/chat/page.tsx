import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Talk to Wells | Founder Journey',
  description: 'Tell Wells what you need. Find talent, suppliers, customers, and investors.',
}

export default function FounderChatPage() {
  // Redirect to new unified dashboard
  redirect('/dashboard')
}
