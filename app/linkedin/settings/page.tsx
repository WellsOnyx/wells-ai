/**
 * LinkedIn Settings Page
 *
 * Connect/disconnect LinkedIn integration
 */

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import LinkedInSettings from '@/app/components/LinkedInSettings'

export default async function LinkedInSettingsPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <LinkedInSettings />
    </div>
  )
}
