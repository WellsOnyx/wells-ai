'use client'

/**
 * Sign Up Page - Redirects to Unified /join Flow
 *
 * Grain & Vault branded redirect page
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Coins } from 'lucide-react'

export default function SignUpPage() {
  const router = useRouter()

  useEffect(() => {
    // Always redirect to unified join with treasury journey
    router.replace('/join?journey=treasury')
  }, [router])

  return (
    <div className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-200px] left-[20%] w-[500px] h-[500px] rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-100px] w-[400px] h-[400px] rounded-full bg-teal-500/10 blur-[100px]" />
      </div>

      <div className="relative z-10 text-center">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20 animate-pulse">
          <Coins className="w-8 h-8 text-black" />
        </div>

        <div className="flex items-center justify-center gap-3 mb-4">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
          <span className="text-lg text-gray-300">Redirecting to signup...</span>
        </div>

        <p className="text-sm text-gray-500">
          If you're not redirected automatically,{' '}
          <a href="/join" className="text-emerald-500 hover:text-emerald-400 underline">
            click here
          </a>
        </p>
      </div>
    </div>
  )
}
