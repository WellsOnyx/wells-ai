'use client'

import { useOrganization, useOrganizationList, useUser } from '@clerk/nextjs'
import { useState } from 'react'
import Link from 'next/link'

/**
 * OrganizationSelector - Multi-tenant organization switcher
 *
 * Displays current organization and allows switching between orgs
 * Integrates with Clerk's Organizations feature
 */
export default function OrganizationSelector() {
  const { organization } = useOrganization()
  const { userMemberships, setActive } = useOrganizationList()
  const { user } = useUser()
  const [isOpen, setIsOpen] = useState(false)

  // If no organizations, show create button
  if (!userMemberships?.data || userMemberships.data.length === 0) {
    return (
      <div className="relative">
        <Link
          href="/organizations/create"
          className="flex items-center gap-2 px-4 py-2 bg-[#dba63f] text-white text-sm rounded-sm hover:bg-[#c89430] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Organization
        </Link>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Current Organization Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white border border-[#9ea1a7]/20 rounded-sm hover:border-[#183b6d] transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Organization Icon */}
          <div className="w-8 h-8 bg-[#183b6d] rounded-sm flex items-center justify-center">
            <span className="text-white text-xs font-medium">
              {organization?.name?.charAt(0).toUpperCase() || 'P'}
            </span>
          </div>

          <div className="text-left">
            <div className="text-sm font-medium text-[#183b6d]">
              {organization?.name || 'Personal Account'}
            </div>
            <div className="text-xs text-[#575757]">
              {organization ? `${organization.membersCount} members` : user?.primaryEmailAddress?.emailAddress}
            </div>
          </div>
        </div>

        {/* Dropdown Arrow */}
        <svg
          className={`w-4 h-4 text-[#9ea1a7] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-[#9ea1a7]/20 rounded-sm shadow-lg z-20">
            {/* Personal Account */}
            <div className="p-2 border-b border-[#9ea1a7]/20">
              <button
                onClick={async () => {
                  if (setActive) {
                    await setActive({ organization: null })
                    setIsOpen(false)
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-sm transition-colors ${
                  !organization ? 'bg-[#183b6d]/10' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-8 h-8 bg-[#9ea1a7] rounded-sm flex items-center justify-center">
                  <span className="text-white text-xs font-medium">
                    {user?.firstName?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-[#183b6d]">Personal Account</div>
                  <div className="text-xs text-[#575757]">
                    {user?.primaryEmailAddress?.emailAddress}
                  </div>
                </div>
                {!organization && (
                  <svg className="w-4 h-4 text-[#dba63f]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>

            {/* Organizations */}
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-[#9ea1a7] uppercase tracking-wide">
                Organizations
              </div>
              {userMemberships.data.map((org) => (
                <button
                  key={org.organization.id}
                  onClick={async () => {
                    if (setActive) {
                      await setActive({ organization: org.organization.id })
                      setIsOpen(false)
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-sm transition-colors ${
                    organization?.id === org.organization.id ? 'bg-[#183b6d]/10' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-8 h-8 bg-[#183b6d] rounded-sm flex items-center justify-center">
                    <span className="text-white text-xs font-medium">
                      {org.organization.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-[#183b6d]">
                      {org.organization.name}
                    </div>
                    <div className="text-xs text-[#575757]">
                      {org.role}
                    </div>
                  </div>
                  {organization?.id === org.organization.id && (
                    <svg className="w-4 h-4 text-[#dba63f]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="p-2 border-t border-[#9ea1a7]/20">
              <Link
                href="/organizations/create"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#183b6d] hover:bg-gray-50 rounded-sm transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Organization
              </Link>

              {organization && (
                <Link
                  href={`/org/${organization.id}/settings`}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#183b6d] hover:bg-gray-50 rounded-sm transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Manage Organization
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
