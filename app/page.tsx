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
  return {
    title: 'Grain & Vault',
    description: 'Protected treasury. Your agent introduces people. You decide what happens next.',
  }
}

export default async function Page() {
  const host = (await headers()).get('host')
  if (isWellsOnyxHost(host)) return <LegacyHome />
  return <GrainHome />
}
