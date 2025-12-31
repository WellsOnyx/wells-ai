import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Buyer Experience | Wells AI',
  description: 'Discover how Wells AI transforms procurement. Find suppliers, get quotes, and close deals faster than ever.',
}

export default function BuyerOnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
