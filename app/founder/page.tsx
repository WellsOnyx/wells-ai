'use client'

/**
 * Founder Journey - Pure Conversation
 *
 * No dashboards. No metrics cards. Just talk to Wells.
 *
 * Wells understands what you need and makes it happen.
 */

import { redirect } from 'next/navigation'

export default function FounderPage() {
  // Redirect to chat - founders just talk to Wells
  redirect('/founder/chat')
}
