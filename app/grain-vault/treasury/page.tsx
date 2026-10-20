'use client'

import '@/app/grain-calm.css'
import { GrainFrame } from '@/components/grain/GrainFrame'

const JOURNEYS = [
  {
    href: '/grain-vault/treasury/corporate',
    title: 'Corporate treasury',
    text: 'Protect operating cash. Open a 0% line for payroll and payables.',
  },
  {
    href: '/grain-vault/treasury/nonprofit',
    title: 'Nonprofit treasury',
    text: 'Safeguard reserves, move grants, and keep a record a board can read.',
  },
  {
    href: '/grain-vault/treasury/faith',
    title: 'Faith organizations',
    text: 'Protect tithes and offerings. Keep building funds visible.',
  },
  {
    href: '/grain-vault/endowment',
    title: 'Endowments',
    text: 'Long-term reserves with a spending policy and board reporting.',
  },
]

export default function TreasuryLandingPage() {
  return (
    <GrainFrame
      eyebrow="Treasury"
      title="Your money stays protected."
      sub="One deposit. A credit line at 0%. Withdraw whenever you want."
      chip={{ href: '/join?journey=treasury', label: 'Open Your Vault' }}
      wide
    >
      <div className="gc-list">
        {JOURNEYS.map((journey) => (
          <a key={journey.href} className="gc-row" href={journey.href}>
            <b>{journey.title}</b>
            <span>{journey.text}</span>
          </a>
        ))}
      </div>
      <details className="gc-how">
        <summary>What the deposit does</summary>
        <ul>
          <li>The deposit is 100% protected and always withdrawable.</li>
          <li>It backs a 1:1 credit line. 0% interest. 0% transaction fees inside the network.</li>
          <li>Settlement is under a second, with the Treasury SDK on the ERP you already run.</li>
          <li>
            <a href="/grain/sdk">Treasury SDK</a>
          </li>
        </ul>
      </details>
    </GrainFrame>
  )
}
