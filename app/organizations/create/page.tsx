'use client'

import { OrganizationProfile, CreateOrganization } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * Organization Creation Page
 *
 * Uses Clerk's built-in CreateOrganization component
 */
export default function CreateOrganizationPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-[#9ea1a7]/20">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link
            href="/"
            className="text-sm text-[#9ea1a7] hover:text-[#183b6d] mb-2 inline-block"
          >
            ← Back to Wells AI
          </Link>
          <h1 className="text-3xl font-serif text-[#183b6d]">Create Organization</h1>
          <p className="text-sm text-[#575757] mt-1">
            Set up a team to share procurement and collaborate
          </p>
        </div>
      </div>

      {/* Clerk Create Organization Component */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-8">
          <CreateOrganization
            afterCreateOrganizationUrl={(org) => `/org/${org.id}/dashboard`}
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'shadow-none',
              },
            }}
          />
        </div>

        {/* Benefits */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
            <div className="w-12 h-12 bg-[#183b6d]/10 rounded-sm flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[#183b6d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-[#183b6d] mb-2">Team Collaboration</h3>
            <p className="text-xs text-[#575757]">
              Invite team members and manage shared procurement across your organization
            </p>
          </div>

          <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
            <div className="w-12 h-12 bg-[#dba63f]/10 rounded-sm flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[#dba63f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-[#183b6d] mb-2">Role-Based Access</h3>
            <p className="text-xs text-[#575757]">
              Admins can approve purchases, members can request quotes and view data
            </p>
          </div>

          <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
            <div className="w-12 h-12 bg-[#183b6d]/10 rounded-sm flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[#183b6d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-[#183b6d] mb-2">Shared Analytics</h3>
            <p className="text-xs text-[#575757]">
              View organization-wide procurement metrics and supplier relationships
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
