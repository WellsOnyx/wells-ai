import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Founder Experience | Wells AI',
  description: 'Your AI co-pilot for building a company. Hire talent, find suppliers, acquire customers, and close deals.',
}

export default function FounderOnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
