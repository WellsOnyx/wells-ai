/**
 * LinkedIn GTM Page
 *
 * Main page for managing LinkedIn campaigns
 */

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import LinkedInCampaignDashboard from '../components/LinkedInCampaignDashboard'

export default async function LinkedInPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <LinkedInCampaignDashboard />
    </div>
  )
}
