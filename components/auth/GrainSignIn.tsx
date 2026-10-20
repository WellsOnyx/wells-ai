'use client'

import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { grainCalmSignInAppearance } from '@/lib/clerk-theme'
import { GrainFrame } from '@/components/grain/GrainFrame'

export default function GrainSignIn() {
  return (
    <GrainFrame
      eyebrow="Sign in"
      title="Welcome back."
      sub="Your vault is where you left it."
      menu
    >
      <div className="gc-card" style={{ padding: 18 }}>
        <SignIn
          appearance={grainCalmSignInAppearance}
          signUpUrl="/join?journey=treasury"
          forceRedirectUrl="/dashboard?journey=treasury"
        />
      </div>
      <p className="gc-fee">
        New here? <Link href="/join?journey=treasury">Open Your Vault</Link>
      </p>
    </GrainFrame>
  )
}
