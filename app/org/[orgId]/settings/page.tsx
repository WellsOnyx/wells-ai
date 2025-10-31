'use client'

import { useOrganization, useUser } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * Organization Settings Page
 *
 * Manages organization details, members, invites, and permissions
 */
export default function OrganizationSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const { organization, membership, memberships, invitations } = useOrganization({
    memberships: { pageSize: 50 },
    invitations: { pageSize: 50 }
  })
  const { user } = useUser()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'org:admin' | 'org:member'>('org:member')
  const [isInviting, setIsInviting] = useState(false)
  const [organizationName, setOrganizationName] = useState('')
  const [isUpdatingName, setIsUpdatingName] = useState(false)

  // Check if user is admin
  const isAdmin = membership?.role === 'org:admin'

  // Load organization name
  useEffect(() => {
    if (organization) {
      setOrganizationName(organization.name)
    }
  }, [organization])

  // Verify user has access to this org
  useEffect(() => {
    if (organization && params.orgId !== organization.id) {
      router.push('/')
    }
  }, [organization, params.orgId, router])

  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !organization) return

    setIsInviting(true)
    try {
      await organization.inviteMember({
        emailAddress: inviteEmail,
        role: inviteRole
      })

      setInviteEmail('')
      alert('Invitation sent successfully!')
    } catch (error: any) {
      console.error('Failed to invite member:', error)
      alert(`Failed to invite member: ${error.message}`)
    } finally {
      setIsInviting(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!organization || !isAdmin) return

    const confirmed = confirm('Are you sure you want to remove this member?')
    if (!confirmed) return

    try {
      await organization.removeMember(userId)
    } catch (error: any) {
      console.error('Failed to remove member:', error)
      alert(`Failed to remove member: ${error.message}`)
    }
  }

  const handleUpdateRole = async (userId: string, newRole: 'org:admin' | 'org:member') => {
    if (!organization || !isAdmin) return

    try {
      await organization.updateMember({
        userId,
        role: newRole
      })
    } catch (error: any) {
      console.error('Failed to update role:', error)
      alert(`Failed to update role: ${error.message}`)
    }
  }

  const handleUpdateName = async () => {
    if (!organization || !organizationName.trim() || !isAdmin) return

    setIsUpdatingName(true)
    try {
      await organization.update({
        name: organizationName
      })
      alert('Organization name updated!')
    } catch (error: any) {
      console.error('Failed to update name:', error)
      alert(`Failed to update name: ${error.message}`)
    } finally {
      setIsUpdatingName(false)
    }
  }

  const handleLeaveOrganization = async () => {
    if (!organization || !user) return

    const confirmed = confirm('Are you sure you want to leave this organization?')
    if (!confirmed) return

    try {
      await organization.removeMember(user.id)
      router.push('/')
    } catch (error: any) {
      console.error('Failed to leave organization:', error)
      alert(`Failed to leave organization: ${error.message}`)
    }
  }

  const handleDeleteOrganization = async () => {
    if (!organization || !isAdmin) return

    const confirmed = confirm(
      'Are you sure you want to delete this organization? This action cannot be undone.'
    )
    if (!confirmed) return

    const doubleConfirm = confirm(
      'This will permanently delete all organization data. Type DELETE to confirm.'
    )
    if (!doubleConfirm) return

    try {
      await organization.destroy()
      router.push('/')
    } catch (error: any) {
      console.error('Failed to delete organization:', error)
      alert(`Failed to delete organization: ${error.message}`)
    }
  }

  const handleRevokeInvite = async (invitationId: string) => {
    if (!organization || !isAdmin) return

    try {
      await organization.invitations?.revoke({ invitationId })
    } catch (error: any) {
      console.error('Failed to revoke invitation:', error)
      alert(`Failed to revoke invitation: ${error.message}`)
    }
  }

  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#183b6d] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#575757]">Loading organization...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-[#9ea1a7]/20">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/"
                className="text-sm text-[#9ea1a7] hover:text-[#183b6d] mb-2 inline-block"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="text-3xl font-serif text-[#183b6d]">Organization Settings</h1>
              <p className="text-sm text-[#575757] mt-1">{organization.name}</p>
            </div>
            <div className="w-16 h-16 bg-[#183b6d] rounded-sm flex items-center justify-center">
              <span className="text-white text-2xl font-medium">
                {organization.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid gap-8">
          {/* Organization Details */}
          <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
            <h2 className="text-xl font-medium text-[#183b6d] mb-6">Organization Details</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#575757] mb-2">
                  Organization Name
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    disabled={!isAdmin}
                    className="flex-1 px-4 py-2 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] disabled:bg-gray-50 disabled:text-[#9ea1a7]"
                  />
                  {isAdmin && (
                    <button
                      onClick={handleUpdateName}
                      disabled={isUpdatingName || organizationName === organization.name}
                      className="px-6 py-2 bg-[#183b6d] text-white rounded-sm hover:bg-[#0d2545] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdatingName ? 'Saving...' : 'Update'}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#575757] mb-2">
                  Organization ID
                </label>
                <code className="block px-4 py-2 bg-gray-50 border border-[#9ea1a7]/20 rounded-sm text-sm text-[#575757]">
                  {organization.id}
                </code>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#575757] mb-2">
                  Your Role
                </label>
                <div className="inline-flex px-3 py-1 bg-[#dba63f]/10 text-[#dba63f] rounded-sm text-sm font-medium">
                  {membership?.role === 'org:admin' ? 'Admin' : 'Member'}
                </div>
              </div>
            </div>
          </div>

          {/* Invite Members */}
          {isAdmin && (
            <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
              <h2 className="text-xl font-medium text-[#183b6d] mb-6">Invite Team Members</h2>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 px-4 py-2 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d]"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'org:admin' | 'org:member')}
                    className="px-4 py-2 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d]"
                  >
                    <option value="org:member">Member</option>
                    <option value="org:admin">Admin</option>
                  </select>
                  <button
                    onClick={handleInviteMember}
                    disabled={isInviting || !inviteEmail.trim()}
                    className="px-6 py-2 bg-[#dba63f] text-white rounded-sm hover:bg-[#c89430] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isInviting ? 'Inviting...' : 'Invite'}
                  </button>
                </div>

                <div className="text-sm text-[#575757]">
                  <strong>Admin:</strong> Can invite members, manage settings, approve purchases
                  <br />
                  <strong>Member:</strong> Can request quotes, chat with AI, view org data
                </div>
              </div>

              {/* Pending Invitations */}
              {invitations && invitations.data && invitations.data.length > 0 && (
                <div className="mt-6 pt-6 border-t border-[#9ea1a7]/20">
                  <h3 className="text-sm font-medium text-[#575757] mb-3">
                    Pending Invitations ({invitations.data.length})
                  </h3>
                  <div className="space-y-2">
                    {invitations.data.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-sm"
                      >
                        <div>
                          <div className="text-sm text-[#183b6d]">
                            {invitation.emailAddress}
                          </div>
                          <div className="text-xs text-[#9ea1a7]">
                            Role: {invitation.role === 'org:admin' ? 'Admin' : 'Member'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevokeInvite(invitation.id)}
                          className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Members List */}
          <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
            <h2 className="text-xl font-medium text-[#183b6d] mb-6">
              Team Members ({memberships?.data?.length || 0})
            </h2>

            <div className="space-y-3">
              {memberships?.data?.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between px-4 py-3 border border-[#9ea1a7]/20 rounded-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#183b6d] rounded-sm flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {member.publicUserData?.firstName?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#183b6d]">
                        {member.publicUserData?.firstName} {member.publicUserData?.lastName}
                        {member.publicUserData?.userId === user?.id && (
                          <span className="ml-2 text-xs text-[#9ea1a7]">(You)</span>
                        )}
                      </div>
                      <div className="text-xs text-[#575757]">
                        {member.publicUserData?.identifier}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isAdmin && member.publicUserData?.userId !== user?.id ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleUpdateRole(
                            member.publicUserData?.userId || '',
                            e.target.value as 'org:admin' | 'org:member'
                          )
                        }
                        className="px-3 py-1 text-sm border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d]"
                      >
                        <option value="org:member">Member</option>
                        <option value="org:admin">Admin</option>
                      </select>
                    ) : (
                      <div className="px-3 py-1 bg-[#dba63f]/10 text-[#dba63f] rounded-sm text-xs font-medium">
                        {member.role === 'org:admin' ? 'Admin' : 'Member'}
                      </div>
                    )}

                    {isAdmin && member.publicUserData?.userId !== user?.id && (
                      <button
                        onClick={() => handleRemoveMember(member.publicUserData?.userId || '')}
                        className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-sm border border-red-200 p-6">
            <h2 className="text-xl font-medium text-red-600 mb-6">Danger Zone</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-[#9ea1a7]/20">
                <div>
                  <h3 className="text-sm font-medium text-[#183b6d]">Leave Organization</h3>
                  <p className="text-xs text-[#575757] mt-1">
                    Remove yourself from this organization
                  </p>
                </div>
                <button
                  onClick={handleLeaveOrganization}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-sm hover:bg-red-50 transition-colors text-sm"
                >
                  Leave Organization
                </button>
              </div>

              {isAdmin && (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-red-600">Delete Organization</h3>
                    <p className="text-xs text-[#575757] mt-1">
                      Permanently delete this organization and all its data
                    </p>
                  </div>
                  <button
                    onClick={handleDeleteOrganization}
                    className="px-4 py-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors text-sm"
                  >
                    Delete Organization
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
