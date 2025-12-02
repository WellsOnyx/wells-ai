import ChatInterface from '@/app/components/ChatInterface'

export const metadata = {
  title: 'Talk to Wells | Job Seeker Journey',
  description: 'Tell Wells your ideal role. Get matched with companies actually hiring.',
}

export default function JobsChatPage() {
  return (
    <ChatInterface
      journey="jobs"
      title="Job Seeker Journey"
      subtitle="Tell Wells what you're looking for. Get direct intros to hiring managers."
      placeholder="I'm looking for VP Engineering roles..."
      initialMessage="Hi! I'm Wells, your AI career partner. Tell me what kind of role you're looking for - title, industry, location, remote preference, compensation expectations. I'll match you with companies that are actually hiring and get you in front of the right people. What are you looking for?"
      accentColor="purple"
    />
  )
}
