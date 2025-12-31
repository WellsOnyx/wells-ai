import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Job Seeker Experience | Wells AI',
  description: 'Skip job boards. Get direct intros to hiring managers at companies actually hiring for roles you want.',
}

export default function JobsOnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
