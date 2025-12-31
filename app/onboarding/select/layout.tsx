import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Choose Your Journey | Wells AI',
  description: 'Select your path: Buyer, Seller, Founder, or Job Seeker. Each journey is tailored to your specific needs.',
}

export default function SelectJourneyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
