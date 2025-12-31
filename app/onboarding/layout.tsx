import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Welcome | Wells AI',
  description: 'Meet Wells - your AI commerce agent. Tell Wells what you need, and watch it happen.',
  openGraph: {
    title: 'Welcome | Wells AI',
    description: 'Meet Wells - your AI commerce agent. Tell Wells what you need, and watch it happen.',
  },
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dark">
      {children}
    </div>
  )
}
