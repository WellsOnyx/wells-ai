import type { Metadata } from 'next'

// Force static generation so metadata is in initial HTML
export const dynamic = 'force-static'

// Metadata moved to page.tsx for Base verification

export default function GrainVaultLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
