import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isWellsOnyxHost } from '@/lib/hosts'
import AgentExperience from '@/components/grain/AgentExperience'
import { grainFontClass } from '@/lib/grain-fonts'
import '@/app/grain-site.css'

export const dynamic = 'force-dynamic'

const title = 'Meet Wells · Grain & Vault'
const description =
  'Wells finds, negotiates, and settles a sample flour deal. You approve before anything moves. Simulated. No real money.'

export const metadata: Metadata = {
  metadataBase: new URL('https://grainandvault.com'),
  title,
  description,
  openGraph: {
    title,
    description,
    url: 'https://grainandvault.com/agent',
    siteName: 'Grain & Vault',
    type: 'website',
    images: [
      {
        url: '/grain-vault-og.png',
        width: 1200,
        height: 630,
        alt: 'Meet Wells · Grain & Vault',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/grain-vault-og.png'],
  },
}

export default async function AgentPage() {
  const host = (await headers()).get('host')
  if (isWellsOnyxHost(host)) notFound()
  return (
    <div className={`gv ${grainFontClass}`}>
      <AgentExperience />
    </div>
  )
}
