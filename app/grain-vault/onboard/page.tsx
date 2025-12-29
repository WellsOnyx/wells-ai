'use client'

/**
 * Grain & Vault Onboarding - TEMPORARILY REDIRECTING TO WAITLIST
 * Re-enable original code when Circle Mint is approved
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function GrainVaultOnboardPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/grain-vault/waitlist')
  }, [router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Redirecting to waitlist...</p>
      </div>
    </div>
  )
}
