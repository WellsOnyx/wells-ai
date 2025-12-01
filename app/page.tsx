/**
 * Root Landing Page
 *
 * Product Split Strategy:
 * - Wells AI is the primary product (most customers start here)
 * - Grain & Vault is the infrastructure layer (developers/platforms)
 *
 * This page defaults to Wells AI, with navigation to Grain & Vault
 */

import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to Wells AI landing (primary product)
  redirect('/wells-ai')
}
