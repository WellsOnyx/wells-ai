import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Talk to Wells | Job Seeker Journey',
  description: 'Tell Wells your ideal role. Get matched with companies actually hiring.',
}

export default function JobsChatPage() {
  // Redirect to new unified dashboard
  redirect('/dashboard')
}
