import { headers } from 'next/headers'
import { isWellsOnyxHost } from '@/lib/hosts'
import LegacySignIn from '@/components/auth/LegacySignIn'
import GrainSignIn from '@/components/auth/GrainSignIn'

export const dynamic = 'force-dynamic'

export default async function SignInPage() {
  const host = (await headers()).get('host')
  if (isWellsOnyxHost(host)) return <LegacySignIn />
  return <GrainSignIn />
}
