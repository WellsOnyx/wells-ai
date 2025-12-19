import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Get Started | Wells AI',
  description: 'Set up your Wells AI account in less than 2 minutes. AI-powered commerce for founders, buyers, sellers, and job seekers.',
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
