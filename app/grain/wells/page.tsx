import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isWellsOnyxHost } from '@/lib/hosts'
import { GrainFrame } from '@/components/grain/GrainFrame'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'WellsAI · Grain & Vault',
  description: 'WellsAI negotiates and sources. Every close still waits for a person.',
}

export default async function WellsPage() {
  const host = (await headers()).get('host')
  if (isWellsOnyxHost(host)) notFound()

  return (
    <GrainFrame
      eyebrow="WellsAI"
      title="It can do the work. You still decide."
      sub="Sourcing, hiring, sales, negotiation. One percent when a deal actually closes. Treasury stays at zero."
      chip={{ href: '/wells-ai', label: 'Explore WellsAI' }}
      orb="gc-blue"
      wide
    >
      <article className="gc-card">
        <div className="gc-big">1%</div>
        <p className="gc-what">Success fee on AI-closed deals. No monthly fee.</p>
        <div className="gc-rows">
          <div>
            <span>Treasury</span>
            <b>0%</b>
          </div>
          <div>
            <span>GRAIN payments</span>
            <b>0%</b>
          </div>
          <div>
            <span>AI sourcing and deals</span>
            <b>1% on close</b>
          </div>
        </div>
      </article>
    </GrainFrame>
  )
}
