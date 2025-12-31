import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Seller Experience | Wells AI',
  description: 'Connect with qualified buyers who need what you sell. No cold outreach - just warm introductions.',
}

export default function SellerOnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
