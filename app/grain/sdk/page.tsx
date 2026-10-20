import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isWellsOnyxHost } from '@/lib/hosts'
import { GrainFrame } from '@/components/grain/GrainFrame'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Treasury SDK · Grain & Vault',
  description: 'Connect an ERP. Push payables. Settlement stays in Grain & Vault.',
}

const SAMPLE = `import { GrainVault } from '@grainvault/sdk'

const vault = new GrainVault({
  apiKey: process.env.VAULT_API_KEY
})

const payment = await vault.payments.create({
  supplier_id: 'sup_123',
  amount_grain: 10000,
  invoice_ref: 'INV-2025-001',
  due_date: '2025-02-15'
})`

export default async function SdkPage() {
  const host = (await headers()).get('host')
  if (isWellsOnyxHost(host)) notFound()

  return (
    <GrainFrame
      eyebrow="Treasury SDK"
      title="Connect the books you already keep."
      sub="REST and TypeScript. NetSuite, SAP, Oracle, Dynamics 365, Coupa, and Workday."
      chip={{ href: '/join?journey=treasury', label: 'Get API Access' }}
      wide
    >
      <article className="gc-card">
        <pre className="gc-code">{SAMPLE}</pre>
      </article>
      <details className="gc-how">
        <summary>ERP and database routes</summary>
        <ul>
          <li><a href="/erp/connect">Connect an ERP</a></li>
          <li><a href="/erp/payables">Payables</a></li>
          <li><a href="/settings/integrations">Integrations</a></li>
          <li><a href="/grain-vault/demo">SDK walk-through</a></li>
          <li><a href="/grain-vault/sdk-waitlist">SDK waitlist</a></li>
        </ul>
      </details>
    </GrainFrame>
  )
}
