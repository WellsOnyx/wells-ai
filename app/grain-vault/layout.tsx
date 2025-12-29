import type { Metadata } from 'next'

// Force dynamic rendering - uses Clerk components
export const dynamic = 'force-dynamic'

// Metadata moved to page.tsx for Base verification

export default function GrainVaultLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
