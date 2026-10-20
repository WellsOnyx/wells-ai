import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Treasury · Grain & Vault',
  description: 'Protected deposits, a 0% credit line, and treasury paths for companies, nonprofits, and faith organizations.',
}

export default function TreasuryLayout({ children }: { children: React.ReactNode }) {
  return children
}
