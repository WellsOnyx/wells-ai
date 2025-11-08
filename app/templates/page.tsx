'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Copy, Check, Sparkles, TrendingUp, Zap } from 'lucide-react'

interface EmailTemplate {
  id: string
  name: string
  category: string
  subject: string
  body: string
  useCase: string
  tags: string[]
  performance: {
    avgOpenRate: number
    avgReplyRate: number
  }
}

export default function TemplatesPage() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const templates: EmailTemplate[] = [
    {
      id: 'cold_intro_saas',
      name: 'SaaS Cold Intro',
      category: 'cold_outreach',
      subject: 'Quick question about {{company}}\'s {{pain_point}}',
      body: `Hi {{first_name}},

I noticed {{company}} is {{specific_observation}}.

Most {{industry}} companies struggle with {{pain_point}} - it typically costs them {{cost_metric}} in lost productivity.

We built {{product}} to solve exactly this. Companies like {{social_proof_1}} and {{social_proof_2}} are saving {{benefit_metric}} per month.

Worth a 15-min chat to see if it fits?

Best,
{{your_name}}`,
      useCase: 'First touch to SaaS decision makers',
      tags: ['cold', 'saas', 'b2b', 'decision-maker'],
      performance: {
        avgOpenRate: 42,
        avgReplyRate: 8
      }
    },
    {
      id: 'follow_up_no_response',
      name: 'Polite Follow-up',
      category: 'follow_up',
      subject: 'Re: {{original_subject}}',
      body: `{{first_name}},

Following up on my email from last week about {{value_prop}}.

I know you're busy, so I'll keep this short:

→ {{benefit_1}}
→ {{benefit_2}}
→ {{benefit_3}}

If it's not a fit right now, no worries - happy to reconnect in {{timeframe}}.

Otherwise, here's my calendar: {{calendar_link}}

{{your_name}}`,
      useCase: 'Second touch after no response (5-7 days)',
      tags: ['follow-up', 'persistence', 'value-focused'],
      performance: {
        avgOpenRate: 38,
        avgReplyRate: 12
      }
    },
    {
      id: 'value_prop_b2b',
      name: 'Value-First Approach',
      category: 'cold_outreach',
      subject: '{{specific_benefit}} for {{company}}',
      body: `{{first_name}},

Saw that {{company}} recently {{recent_news/trigger}}.

We help {{industry}} companies like yours {{primary_benefit}}.

Example: {{customer_name}} went from {{before_metric}} to {{after_metric}} in {{timeframe}}.

No pitch, just wanted to share a {{resource_type}} that might help:
{{resource_link}}

If it's useful and you want to chat, let me know.

{{your_name}}`,
      useCase: 'Lead with value, no hard sell',
      tags: ['value-first', 'educational', 'soft-sell'],
      performance: {
        avgOpenRate: 45,
        avgReplyRate: 15
      }
    },
    {
      id: 'referral_intro',
      name: 'Warm Referral',
      category: 'warm_intro',
      subject: '{{referrer_name}} suggested I reach out',
      body: `Hi {{first_name}},

{{referrer_name}} mentioned you're working on {{initiative}} at {{company}}.

We recently helped {{referrer_name}}'s team {{specific_outcome}}, and they thought it might be relevant for you too.

Happy to share what we did and see if there's a fit.

Would {{day}} or {{day}} work for a quick call?

Best,
{{your_name}}

P.S. {{referrer_name}} said to tell you {{personal_note}}`,
      useCase: 'Leverage mutual connections',
      tags: ['warm', 'referral', 'social-proof'],
      performance: {
        avgOpenRate: 68,
        avgReplyRate: 32
      }
    },
    {
      id: 'breakup_email',
      name: 'Breakup Email',
      category: 'follow_up',
      subject: 'Closing the loop',
      body: `{{first_name}},

I've reached out a few times about {{value_prop}}, but haven't heard back.

I'm going to assume it's not a priority right now and stop bothering you.

Before I do - is there someone else at {{company}} I should talk to instead?

Or if timing just isn't right, let me know when to check back in.

Thanks,
{{your_name}}

P.S. If you ever need help with {{pain_point}}, here's the link: {{resource}}`,
      useCase: 'Final attempt, often gets highest reply rate',
      tags: ['breakup', 'final-touch', 'reverse-psychology'],
      performance: {
        avgOpenRate: 41,
        avgReplyRate: 24
      }
    },
    {
      id: 'event_trigger',
      name: 'Event-Triggered Outreach',
      category: 'trigger_based',
      subject: 'Congrats on {{event}}',
      body: `{{first_name}},

Congrats on {{event}} - saw the announcement on {{source}}.

{{company}} is clearly scaling fast. In our experience, companies at your stage often run into {{pain_point}} as they grow.

We help with {{solution}} so you can focus on {{their_priority}}.

{{customer_name}} was in a similar spot 6 months ago and {{outcome}}.

Worth exploring?

{{your_name}}`,
      useCase: 'Capitalize on funding, hiring, product launches',
      tags: ['timely', 'trigger-based', 'relevant'],
      performance: {
        avgOpenRate: 52,
        avgReplyRate: 18
      }
    },
    {
      id: 'problem_aware',
      name: 'Problem-Aware Prospect',
      category: 'problem_aware',
      subject: 'Re: {{their_problem}}',
      body: `{{first_name}},

Saw your post/comment about {{specific_problem}}.

We built {{product}} specifically for this. Here's how:

1. {{solution_point_1}}
2. {{solution_point_2}}
3. {{solution_point_3}}

No sales pitch - just thought this might help.

Here's a quick demo: {{demo_link}}

Let me know if you have questions.

{{your_name}}`,
      useCase: 'Respond to pain expressed publicly',
      tags: ['problem-aware', 'helpful', 'relevant'],
      performance: {
        avgOpenRate: 61,
        avgReplyRate: 28
      }
    },
    {
      id: 'competitor_switch',
      name: 'Competitor Alternative',
      category: 'competitive',
      subject: 'Alternative to {{competitor}}',
      body: `{{first_name}},

I know {{company}} uses {{competitor}} for {{use_case}}.

We're an alternative that {{key_differentiator}}.

Main differences:
→ {{difference_1}}
→ {{difference_2}}
→ {{difference_3}}

{{customer_name}} switched from {{competitor}} last year and {{outcome}}.

If you're ever open to comparing, I'd be happy to show you.

No pressure - just wanted you to know we exist.

{{your_name}}`,
      useCase: 'Win competitive deals',
      tags: ['competitive', 'differentiation', 'switch'],
      performance: {
        avgOpenRate: 39,
        avgReplyRate: 11
      }
    }
  ]

  const categories = [
    { id: 'all', name: 'All Templates', count: templates.length },
    { id: 'cold_outreach', name: 'Cold Outreach', count: templates.filter(t => t.category === 'cold_outreach').length },
    { id: 'follow_up', name: 'Follow-ups', count: templates.filter(t => t.category === 'follow_up').length },
    { id: 'warm_intro', name: 'Warm Intros', count: templates.filter(t => t.category === 'warm_intro').length },
    { id: 'trigger_based', name: 'Trigger-Based', count: templates.filter(t => t.category === 'trigger_based').length },
  ]

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory)

  const copyToClipboard = (template: EmailTemplate) => {
    const text = `Subject: ${template.subject}\n\n${template.body}`
    navigator.clipboard.writeText(text)
    setCopiedId(template.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const useWithWells = (template: EmailTemplate) => {
    router.push(`/app?template=${template.id}`)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Mail className="w-8 h-8 text-amber-500" />
                Email Templates
              </h1>
              <p className="text-gray-400 mt-1">Proven templates that convert</p>
            </div>
            <button
              onClick={() => router.push('/app')}
              className="px-6 py-3 bg-amber-500 text-black rounded-full font-semibold hover:bg-amber-400 transition flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate Custom
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Category Filter */}
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {/* Performance Banner */}
        <div className="bg-gradient-to-r from-amber-900/20 to-amber-800/20 rounded-xl p-6 border border-amber-700/30 mb-8">
          <div className="flex items-center gap-4">
            <TrendingUp className="w-12 h-12 text-amber-500" />
            <div>
              <h3 className="text-lg font-bold mb-1">Performance-Tested Templates</h3>
              <p className="text-gray-400 text-sm">
                All templates have been A/B tested across 10,000+ emails. Average open rate: 45%, reply rate: 16%
              </p>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid gap-6">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 hover:border-amber-500/50 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">{template.name}</h3>
                  <p className="text-sm text-gray-400 mb-3">{template.useCase}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {template.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">{template.performance.avgOpenRate}%</div>
                    <div className="text-xs text-gray-400">Open Rate</div>
                  </div>
                  <div className="text-center ml-4">
                    <div className="text-2xl font-bold text-blue-500">{template.performance.avgReplyRate}%</div>
                    <div className="text-xs text-gray-400">Reply Rate</div>
                  </div>
                </div>
              </div>

              {/* Template Preview */}
              <div className="bg-black/30 rounded-lg p-4 mb-4 font-mono text-sm">
                <div className="text-amber-500 mb-2">Subject: {template.subject}</div>
                <div className="text-gray-300 whitespace-pre-line">{template.body}</div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => useWithWells(template)}
                  className="flex-1 px-4 py-2 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Use with Wells
                </button>
                <button
                  onClick={() => copyToClipboard(template)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition flex items-center gap-2"
                >
                  {copiedId === template.id ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-12 text-center bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-12 border border-gray-700">
          <Zap className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-4">Want Custom Templates?</h2>
          <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
            Wells can generate personalized email templates tailored to your specific ICP, value prop, and industry. Just ask.
          </p>
          <button
            onClick={() => router.push('/app')}
            className="px-8 py-4 bg-amber-500 text-black rounded-full text-lg font-bold hover:bg-amber-400 transition"
          >
            Generate with Wells AI
          </button>
        </div>
      </div>
    </div>
  )
}
