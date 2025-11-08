'use client'

/**
 * Wells AI - Conversational Interface
 *
 * No forms. No buttons. No cards.
 * Just you and Wells, talking.
 */

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function WellsApp() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in')
    }
  }, [isLoaded, user, router])

  // Redirect to founder dashboard (conversational interface)
  useEffect(() => {
    if (user) {
      router.push('/founder/dashboard')
    }
  }, [user, router])

  return null
}
