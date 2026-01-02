'use client'

/**
 * Sign Up Page - Redirects to Unified /join Flow
 *
 * This page exists for backwards compatibility but immediately
 * redirects to /join which is the unified signup for both
 * wellsonyx.io and grainandvault.com
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'

export default function SignUpPage() {
  const router = useRouter()
  const [redirecting, setRedirecting] = useState(true)

  useEffect(() => {
    // Detect domain and redirect to unified /join with appropriate journey
    const host = window.location.hostname
    const isGrainVault = host.includes('grainandvault') || host.includes('grain')

    // Redirect to unified join page
    if (isGrainVault) {
      router.replace('/join?journey=treasury')
    } else {
      router.replace('/join')
    }
  }, [router])

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-200px] left-[20%] w-[500px] h-[500px] rounded-full bg-amber-500/20 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-100px] w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-[100px]" />
      </div>

      <div className="relative z-10 text-center">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20 animate-pulse">
          <Sparkles className="w-8 h-8 text-black" />
        </div>

        <div className="flex items-center justify-center gap-3 mb-4">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span className="text-lg text-gray-300">Redirecting to signup...</span>
        </div>

        <p className="text-sm text-gray-500">
          If you're not redirected automatically,{' '}
          <a href="/join" className="text-amber-500 hover:text-amber-400 underline">
            click here
          </a>
        </p>
      </div>
    </div>
  )
}
