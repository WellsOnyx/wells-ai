import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { isWellsOnyxHost } from '@/lib/hosts'
import LegacyHome from '@/components/legacy-home/LegacyHome'
import GrainHome from '@/components/grain/GrainHome'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get('host')
  if (isWellsOnyxHost(host)) {
    return {
      title: 'Grain & Vault | Protected Treasury. Zero Friction Payments.',
      description:
        'Deposit your predictable spend. 100% protected. 0% interest credit line. 1% success fee. Powered by WellsAI.',
    }
  }
  const title = 'Grain & Vault — Wells finds the deal. Grain pays it. Vault records it.'
  const description =
    'Wells is an AI agent that finds and negotiates business deals. Grain is a dollar-backed stablecoin with zero fees. Vault keeps an audited record of every deal.'
  return {
    metadataBase: new URL('https://grainandvault.com'),
    title,
    description,
    openGraph: {
      title,
      description,
      url: 'https://grainandvault.com',
      siteName: 'Grain & Vault',
      type: 'website',
      images: [
        {
          url: '/grain-vault-og.png',
          width: 1200,
          height: 630,
          alt: 'Grain & Vault',
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
}

export default async function Page() {
  const host = (await headers()).get('host')
  if (isWellsOnyxHost(host)) return <LegacyHome />
  return <GrainHome />
}
