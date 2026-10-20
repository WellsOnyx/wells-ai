import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isWellsOnyxHost } from '@/lib/hosts'
import { GrainFrame } from '@/components/grain/GrainFrame'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Products · Grain & Vault',
  description: 'GRAIN settles. Vault keeps the record. The reserve stays apart.',
}

export default async function ProductsPage() {
  const host = (await headers()).get('host')
  if (isWellsOnyxHost(host)) notFound()

  return (
    <GrainFrame
      eyebrow="Products"
      title="Three products. One quiet place."
      sub="A dollar that settles, a record you can trust, and a reserve that stays apart."
      chip={{ href: '/join?journey=treasury', label: 'Open Your Vault' }}
      wide
    >
      <div className="gc-list">
        <a className="gc-row" href="/grain-vault">
          <b>GRAIN</b>
          <span>Settlement money. Asset-backed. Under a second. No chargebacks.</span>
        </a>
        <a className="gc-row" href="/grain-vault/vault">
          <b>Vault</b>
          <span>Protected reserves. Always collateralized. Always withdrawable.</span>
        </a>
        <a className="gc-row" href="/grain/wells">
          <b>WellsAI</b>
          <span>The intelligence layer. It can negotiate. You still approve.</span>
        </a>
      </div>
      <details className="gc-how">
        <summary>Why the reserve stays apart</summary>
        <p>
          The reserve is not your spending balance, and it does not pay you a return. Your agent does not touch that side.
        </p>
      </details>
    </GrainFrame>
  )
}
