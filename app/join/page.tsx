import { Suspense } from 'react'
import { headers } from 'next/headers'
import { isWellsOnyxHost } from '@/lib/hosts'
import JoinFlow from './JoinFlow'

export const dynamic = 'force-dynamic'

export default async function JoinPage() {
  const host = (await headers()).get('host')
  return (
    <Suspense fallback={null}>
      <JoinFlow calm={!isWellsOnyxHost(host)} />
    </Suspense>
  )
}
