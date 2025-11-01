'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function SDKPage() {
  const [activeSDK, setActiveSDK] = useState<'gtm' | 'partner'>('gtm')

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-[#9ea1a7]/10 sticky top-0 bg-white z-50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="12" r="3" fill="#183b6d" />
              <line x1="20" y1="15" x2="12" y2="28" stroke="#183b6d" strokeWidth="1.5" />
              <line x1="20" y1="15" x2="20" y2="32" stroke="#183b6d" strokeWidth="1.5" />
              <line x1="20" y1="15" x2="28" y2="28" stroke="#183b6d" strokeWidth="1.5" />
              <circle cx="12" cy="28" r="2.5" fill="#183b6d" />
              <circle cx="28" cy="28" r="2.5" fill="#183b6d" />
              <circle cx="20" cy="32" r="2.5" fill="#183b6d" />
              <circle cx="20" cy="12" r="1.5" fill="#dba63f" opacity="0.9" />
            </svg>
            <div>
              <div className="font-semibold text-[#183b6d] text-lg tracking-tight">Wells AI</div>
              <div className="text-[10px] text-[#575757] tracking-[0.15em] uppercase">SDK Documentation</div>
            </div>
          </Link>
          <Link
            href="/docs"
            className="text-[#183b6d] hover:text-[#dba63f] transition-colors"
          >
            ← Back to Docs
          </Link>
        </div>
      </nav>

      {/* SDK Selector */}
      <div className="border-b border-[#9ea1a7]/10 bg-[#183b6d]/5">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveSDK('gtm')}
              className={`px-6 py-3 rounded-sm font-medium transition-all ${
                activeSDK === 'gtm'
                  ? 'bg-[#183b6d] text-white'
                  : 'bg-white text-[#575757] hover:bg-[#183b6d]/10'
              }`}
            >
              GTM SDK
            </button>
            <button
              onClick={() => setActiveSDK('partner')}
              className={`px-6 py-3 rounded-sm font-medium transition-all ${
                activeSDK === 'partner'
                  ? 'bg-[#183b6d] text-white'
                  : 'bg-white text-[#575757] hover:bg-[#183b6d]/10'
              }`}
            >
              Partner SDK
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {activeSDK === 'gtm' ? <GTMSDKDocs /> : <PartnerSDKDocs />}
      </div>
    </div>
  )
}

function GTMSDKDocs() {
  return (
    <div className="prose max-w-none">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-5xl font-serif text-[#183b6d] mb-4">Wells GTM SDK</h1>
        <p className="text-xl text-[#575757]">
          Complete GTM automation for enterprise sales at 33 basis points (0.33%) on closed ACV.
        </p>
        <div className="flex gap-3 mt-6">
          <span className="px-3 py-1 bg-[#183b6d]/10 text-[#183b6d] text-sm font-medium rounded-sm">
            v1.0.0
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-sm">
            Production Ready
          </span>
        </div>
      </div>

      {/* Installation */}
      <section className="mb-12">
        <h2 className="text-3xl font-serif text-[#183b6d] mb-4">Installation</h2>
        <div className="bg-gray-900 text-gray-100 p-6 rounded-sm overflow-x-auto">
          <code>npm install @wells/gtm-sdk</code>
        </div>
      </section>

      {/* Quick Start */}
      <section className="mb-12">
        <h2 className="text-3xl font-serif text-[#183b6d] mb-4">Quick Start</h2>
        <div className="bg-gray-900 text-gray-100 p-6 rounded-sm overflow-x-auto">
          <pre className="text-sm">{`import { WellsGTM } from '@wells/gtm-sdk';

const gtm = new WellsGTM({
  apiKey: 'wells_live_xxx',
  icp: {
    role: 'CPO',
    companySize: '500-5000',
    industry: 'SaaS',
    geography: 'North America'
  },
  goal: 'book 5 demos/week'
});

await gtm.initialize();

// That's it. Wells AI now automates your entire GTM:
// 1. Discovers 10k CPOs matching your ICP
// 2. Generates 100 personalized InMails/day
// 3. Books meetings automatically
// 4. Tracks pipeline in real-time
// 5. Invoices 0.33% on closed deals`}</pre>
        </div>
      </section>

      {/* What It Does */}
      <section className="mb-12">
        <h2 className="text-3xl font-serif text-[#183b6d] mb-6">What It Does</h2>
        <div className="grid md:grid-cols-2 gap-6 not-prose">
          {[
            {
              title: 'Prospect Discovery',
              desc: 'Automatically discovers 10,000+ prospects from Apollo, LinkedIn, Crunchbase, and more'
            },
            {
              title: 'ICP Scoring',
              desc: 'Scores every prospect 0-100 against your Ideal Customer Profile'
            },
            {
              title: 'AI Outreach',
              desc: 'Generates 100 personalized InMails/day using Claude Sonnet 4'
            },
            {
              title: 'Meeting Booking',
              desc: 'Automatically books meetings when prospects reply'
            },
            {
              title: 'Pipeline Tracking',
              desc: 'Real-time pipeline metrics and forecasting'
            },
            {
              title: 'Revenue Calculation',
              desc: 'Automatically calculates 33bps fee when deals close'
            }
          ].map((item, i) => (
            <div key={i} className="bg-[#183b6d]/5 p-6 rounded-sm">
              <h3 className="text-lg font-semibold text-[#183b6d] mb-2">{item.title}</h3>
              <p className="text-[#575757] text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Revenue Model */}
      <section className="mb-12">
        <h2 className="text-3xl font-serif text-[#183b6d] mb-4">Revenue Model</h2>
        <p className="text-[#575757] mb-6">
          <strong>Success Fee: 33 basis points (0.33%)</strong> — No upfront cost. You only pay when you close deals.
        </p>
        <div className="bg-white border-2 border-[#9ea1a7]/20 rounded-sm overflow-hidden not-prose">
          <table className="w-full">
            <thead className="bg-[#183b6d] text-white">
              <tr>
                <th className="px-6 py-4 text-left">Pipeline ACV</th>
                <th className="px-6 py-4 text-left">Wells Fee (33bps)</th>
                <th className="px-6 py-4 text-left">Your Net Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#9ea1a7]/20">
              {[
                { acv: '$100,000', fee: '$330', net: '$99,670' },
                { acv: '$1,000,000', fee: '$3,300', net: '$996,700' },
                { acv: '$10,000,000', fee: '$33,000', net: '$9,967,000' },
                { acv: '$100,000,000', fee: '$330,000', net: '$99,670,000' }
              ].map((row, i) => (
                <tr key={i} className="hover:bg-[#183b6d]/5">
                  <td className="px-6 py-4 text-[#183b6d] font-semibold">{row.acv}</td>
                  <td className="px-6 py-4 text-[#575757]">{row.fee}</td>
                  <td className="px-6 py-4 text-[#575757]">{row.net}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-[#575757] mt-4">
          <strong>Why 33bps?</strong> You save 97-99% vs. hiring sales reps (10-15% commission) or agencies (15-20% fee).
        </p>
      </section>

      {/* API Reference */}
      <section className="mb-12">
        <h2 className="text-3xl font-serif text-[#183b6d] mb-4">API Reference</h2>

        <div className="space-y-6">
          {/* Initialize */}
          <div className="border-l-4 border-[#dba63f] pl-6">
            <h3 className="text-xl font-semibold text-[#183b6d] mb-2">gtm.initialize()</h3>
            <p className="text-[#575757] mb-3">Starts automated GTM workflows</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-sm">
              <code className="text-sm">await gtm.initialize();</code>
            </div>
          </div>

          {/* Get Metrics */}
          <div className="border-l-4 border-[#dba63f] pl-6">
            <h3 className="text-xl font-semibold text-[#183b6d] mb-2">gtm.getMetrics()</h3>
            <p className="text-[#575757] mb-3">Returns real-time GTM performance metrics</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-sm">
              <code className="text-sm">const metrics = await gtm.getMetrics();</code>
            </div>
          </div>

          {/* Get Prospects */}
          <div className="border-l-4 border-[#dba63f] pl-6">
            <h3 className="text-xl font-semibold text-[#183b6d] mb-2">gtm.getProspects(options)</h3>
            <p className="text-[#575757] mb-3">Retrieve prospects matching your filters</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-sm overflow-x-auto">
              <pre className="text-sm">{`const prospects = await gtm.getProspects({
  status: 'qualified',
  minICPScore: 80,
  limit: 50
});`}</pre>
            </div>
          </div>

          {/* Mark Closed Won */}
          <div className="border-l-4 border-[#dba63f] pl-6">
            <h3 className="text-xl font-semibold text-[#183b6d] mb-2">gtm.markClosedWon(opportunityId, acv)</h3>
            <p className="text-[#575757] mb-3">Mark deal as closed and calculate fee</p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-sm overflow-x-auto">
              <pre className="text-sm">{`await gtm.markClosedWon(opportunityId, 250000);
// Output: 🎉 Deal closed!
//         ACV: $250,000
//         Wells fee: $825 (33bps)`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Support */}
      <section className="bg-[#183b6d]/5 border-2 border-[#9ea1a7]/20 rounded-sm p-8 not-prose">
        <h3 className="text-2xl font-serif text-[#183b6d] mb-4">Need Help?</h3>
        <p className="text-[#575757] mb-6">
          Our team is here to help you get the most out of the Wells GTM SDK.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/contact"
            className="px-6 py-3 bg-[#183b6d] text-white font-medium rounded-sm hover:bg-[#0d2545] transition-all"
          >
            Contact Support
          </Link>
          <a
            href="mailto:hello@wellsonyx.com"
            className="px-6 py-3 bg-white border-2 border-[#183b6d] text-[#183b6d] font-medium rounded-sm hover:bg-[#183b6d] hover:text-white transition-all"
          >
            Email Us
          </a>
        </div>
      </section>
    </div>
  )
}

function PartnerSDKDocs() {
  return (
    <div className="prose max-w-none">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-5xl font-serif text-[#183b6d] mb-4">Wells Partner SDK</h1>
        <p className="text-xl text-[#575757]">
          Drop-in automation for partnership ecosystems. Deploy into 66+ partner platforms by year-end.
        </p>
        <div className="flex gap-3 mt-6">
          <span className="px-3 py-1 bg-[#183b6d]/10 text-[#183b6d] text-sm font-medium rounded-sm">
            v1.0.0
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-sm">
            Phase 1 Complete
          </span>
        </div>
      </div>

      {/* What It Does */}
      <section className="mb-12">
        <h2 className="text-3xl font-serif text-[#183b6d] mb-4">What It Does</h2>
        <p className="text-[#575757] mb-6">
          The Wells Partner SDK watches partner portals (IBM, Cisco, Snowflake, etc.), learns patterns, suggests actions
          (deal-reg, co-sell, MDF), waits for your approval, then executes. All revenue tracked at 33bps with 10% tithe.
        </p>
        <div className="bg-[#183b6d]/5 border-2 border-[#9ea1a7]/20 rounded-sm p-6">
          <h3 className="text-lg font-semibold text-[#183b6d] mb-3">The Flow:</h3>
          <ol className="space-y-2 text-[#575757]">
            <li>1. You log into IBM PartnerWorld</li>
            <li>2. SDK injects behind your session (or via API)</li>
            <li>3. It observes: "New opportunity in pipeline"</li>
            <li>4. Suggests: "Register this deal? Matches IBM Cloud + AI rules" (92% confidence)</li>
            <li>5. You click "Approve"</li>
            <li>6. SDK submits deal-reg, tracks status</li>
            <li>7. Deal closes → 33bps attribution logged → Invoice generated</li>
          </ol>
        </div>
      </section>

      {/* Quick Start */}
      <section className="mb-12">
        <h2 className="text-3xl font-serif text-[#183b6d] mb-4">Quick Start (TypeScript)</h2>
        <div className="bg-gray-900 text-gray-100 p-6 rounded-sm overflow-x-auto">
          <pre className="text-sm">{`import { WellsPartnerSDK } from '@/lib/partner-sdk'

// Initialize SDK
const sdk = new WellsPartnerSDK({
  partner: 'ibm',
  auth: {
    method: 'oauth',
    credentials: {
      clientId: 'YOUR_CLIENT_ID',
      clientSecret: 'YOUR_CLIENT_SECRET',
    },
  },
  mode: 'suggest',
  playbooks: ['deal_registration', 'co_sell_request', 'mdf_request'],
  consent: {
    required: true,
    type: 'action',
  }
})

// Start observing
await sdk.start()

// Listen for suggested actions
sdk.on('action_suggested', (action) => {
  console.log('New suggestion:', action.type, action.confidence + '%')
})

// Approve action
await sdk.approve('action_xyz789', {
  userId: 'user_1',
  name: 'Your Name',
  email: 'your@email.com',
})`}</pre>
        </div>
      </section>

      {/* Supported Platforms */}
      <section className="mb-12">
        <h2 className="text-3xl font-serif text-[#183b6d] mb-4">Supported Platforms</h2>
        <div className="grid md:grid-cols-2 gap-4 not-prose">
          <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-4">
            <h3 className="font-semibold text-[#183b6d] mb-3">Phase 1 (Built)</h3>
            <ul className="space-y-1 text-[#575757] text-sm">
              <li>✓ IBM PartnerWorld</li>
              <li>✓ Cisco Partner Network</li>
              <li>✓ Snowflake Partner Network</li>
              <li>✓ Freshworks Marketplace</li>
              <li>✓ Microsoft Partner Network</li>
            </ul>
          </div>
          <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-4">
            <h3 className="font-semibold text-[#183b6d] mb-3">Phase 2 (Nov 8-21)</h3>
            <ul className="space-y-1 text-[#575757] text-sm">
              <li>○ AWS Partner Network</li>
              <li>○ Google Cloud Partner Network</li>
              <li>○ Oracle PartnerNetwork</li>
              <li>○ SAP PartnerEdge</li>
              <li>○ Salesforce AppExchange</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Playbooks */}
      <section className="mb-12">
        <h2 className="text-3xl font-serif text-[#183b6d] mb-6">Available Playbooks</h2>
        <div className="space-y-6 not-prose">
          {[
            {
              title: 'Deal Registration',
              desc: 'Automatically register opportunities with partner when they match criteria (geography, deal size, industry, etc.)'
            },
            {
              title: 'Co-Sell Request',
              desc: 'Request partner involvement on opportunities where their participation increases win rate'
            },
            {
              title: 'MDF Request',
              desc: 'Submit marketing development fund requests tied to specific opportunities (typically 5% of deal, capped at $5-10K)'
            }
          ].map((playbook, i) => (
            <div key={i} className="border-l-4 border-[#dba63f] pl-6">
              <h3 className="text-lg font-semibold text-[#183b6d] mb-2">{playbook.title}</h3>
              <p className="text-[#575757]">{playbook.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Revenue Model */}
      <section className="mb-12">
        <h2 className="text-3xl font-serif text-[#183b6d] mb-4">Attribution & Revenue</h2>
        <p className="text-[#575757] mb-6">
          <strong>33 Basis Points Model</strong> — Deal closes → Wells fee = 0.33% of influenced ACV
        </p>
        <div className="bg-gray-900 text-gray-100 p-6 rounded-sm overflow-x-auto">
          <pre className="text-sm">{`// $750K deal with partner influence
const result = {
  revenue: {
    total: 750000,        // Total deal value
    influenced: 750000,   // 100% attributed to partner
    wellsFee: 2475,       // $750K × 0.0033 = $2,475
    tithe: 247.50,        // $2,475 × 0.10 = $247.50
    net: 2227.50          // $2,475 - $247.50 = $2,227.50
  }
}`}</pre>
        </div>
      </section>

      {/* PRM Etiquette */}
      <section className="mb-12 bg-yellow-50 border-2 border-yellow-200 rounded-sm p-6">
        <h2 className="text-2xl font-serif text-yellow-900 mb-4">⚠️ PRM Etiquette (CRITICAL)</h2>
        <p className="text-yellow-800 mb-4">
          Partner Relationship Management rules are SACRED. Violating them = partner expulsion.
        </p>
        <ul className="space-y-2 text-yellow-800 text-sm">
          <li>• <strong>Deal Registration Timeframes:</strong> IBM (48hrs), Cisco (24hrs), Snowflake (72hrs) before customer engagement</li>
          <li>• <strong>Geography & Industry:</strong> Always check restrictions before submitting</li>
          <li>• <strong>Deal Size Limits:</strong> IBM $50K min, Cisco $25K min, Snowflake $100K min</li>
          <li>• <strong>MDF Etiquette:</strong> Don't ask for &gt;$5K without partner PM approval</li>
          <li>• <strong>Co-Sell Protocol:</strong> Customer must approve vendor involvement</li>
        </ul>
      </section>

      {/* Support */}
      <section className="bg-[#183b6d]/5 border-2 border-[#9ea1a7]/20 rounded-sm p-8 not-prose">
        <h3 className="text-2xl font-serif text-[#183b6d] mb-4">Ready to Deploy?</h3>
        <p className="text-[#575757] mb-6">
          Get started with the Partner SDK or reach out for custom integration support.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/partners"
            className="px-6 py-3 bg-[#dba63f] text-white font-medium rounded-sm hover:bg-[#c89430] transition-all"
          >
            Launch Partner SDK
          </Link>
          <Link
            href="/contact"
            className="px-6 py-3 bg-white border-2 border-[#183b6d] text-[#183b6d] font-medium rounded-sm hover:bg-[#183b6d] hover:text-white transition-all"
          >
            Contact Support
          </Link>
        </div>
      </section>
    </div>
  )
}
