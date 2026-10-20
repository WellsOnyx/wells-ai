import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isWellsOnyxHost } from '@/lib/hosts'
import AgentExperience from '@/components/grain/AgentExperience'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Wells · Grain & Vault',
  description:
    'Wells finds a deal for you. Both sides confirm before anything settles. Simulated. No real money.',
}

export default async function AgentPage() {
  const host = (await headers()).get('host')
  if (isWellsOnyxHost(host)) notFound()
  return <AgentExperience />
}
