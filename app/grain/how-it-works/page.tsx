import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isWellsOnyxHost } from '@/lib/hosts'
import { GrainFrame } from '@/components/grain/GrainFrame'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'How It Works · Grain & Vault',
  description: 'One deposit creates a protected reserve, a 0% credit line, and room to grow.',
}

export default async function HowItWorksPage() {
  const host = (await headers()).get('host')
  if (isWellsOnyxHost(host)) notFound()

  return (
    <GrainFrame
      eyebrow="How It Works"
      title="One deposit. Three layers."
      sub="Your cash stays yours. It also opens a credit line, and it can grow with the network."
      chip={{ href: '/join?journey=treasury', label: 'Open Your Vault' }}
      wide
    >
      <article className="gc-card" aria-label="How a deposit works">
        <div className="gc-rows">
          <div>
            <span>Protected deposit</span>
            <b>100% yours</b>
          </div>
          <div>
            <span>GRAIN credit line</span>
            <b>0% interest</b>
          </div>
          <div>
            <span>Appreciation</span>
            <b>Grows with the network</b>
          </div>
        </div>
        <p className="gc-fee">Example: $1,000,000 deposited stays withdrawable, and opens 100,000 GRAIN at your lock-in price.</p>
      </article>
      <details className="gc-how">
        <summary>The longer walk-through</summary>
        <ul>
          <li>Protected reserves are always withdrawable.</li>
          <li>The credit line is 1:1 with the deposit. No interest. No transaction fee inside the network.</li>
          <li>Bonus GRAIN comes from ecosystem growth, not from spending your deposit.</li>
          <li>
            <a href="/grain-vault/how-it-works">Open the full story</a>
          </li>
        </ul>
      </details>
    </GrainFrame>
  )
}
