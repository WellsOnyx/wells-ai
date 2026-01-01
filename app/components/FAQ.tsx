'use client'

import { useState } from 'react'
import {
  ChevronDown,
  Bot,
  Percent,
  Shield,
  MessageSquare,
  Link2,
  Users,
  Zap,
  Gift,
  HelpCircle
} from 'lucide-react'

interface FAQItem {
  id: number
  question: string
  answer: string
  icon: React.ReactNode
  category?: string
}

const faqData: FAQItem[] = [
  {
    id: 1,
    question: 'What is WellsAI?',
    answer: 'WellsAI is an enterprise AI platform that autonomously negotiates B2B deals on your behalf. Think of it as your tireless negotiation expert that works 24/7, analyzing market data, understanding counterparty positions, and securing optimal terms for your business. From supplier contracts to sales deals, WellsAI handles the entire negotiation lifecycle.',
    icon: <Bot className="w-5 h-5" />,
    category: 'Getting Started'
  },
  {
    id: 2,
    question: 'How does the 1% fee work?',
    answer: 'Our fee structure is simple and aligned with your success: we only charge 1% of the deal value, and only when a deal successfully closes. No upfront costs, no monthly subscriptions, no hidden fees. If WellsAI saves you $100,000 on a supplier contract, you pay just $1,000. If the deal falls through? You pay nothing. We succeed when you succeed.',
    icon: <Percent className="w-5 h-5" />,
    category: 'Pricing'
  },
  {
    id: 3,
    question: 'Is my data secure?',
    answer: 'Absolutely. We implement enterprise-grade security with SOC 2 Type II compliance, end-to-end encryption, and zero data sharing with third parties. Your negotiation strategies, pricing data, and deal terms remain completely confidential. We also offer on-premise deployment for organizations with the strictest security requirements.',
    icon: <Shield className="w-5 h-5" />,
    category: 'Security'
  },
  {
    id: 4,
    question: 'How does AI-to-AI negotiation work?',
    answer: 'When both parties use WellsAI, something magical happens: your Wells talks directly to their Wells. The AIs exchange structured proposals, analyze mutual benefit zones, and converge on optimal outcomes faster than human negotiators ever could. This eliminates emotional friction, scheduling delays, and communication gaps. Deals that took weeks now close in hours.',
    icon: <MessageSquare className="w-5 h-5" />,
    category: 'Technology'
  },
  {
    id: 5,
    question: 'Can I integrate with my ERP?',
    answer: 'Yes! WellsAI offers native integrations with NetSuite, SAP, and QuickBooks out of the box. We also provide a robust API for custom ERP systems. Deal terms, pricing agreements, and contract data flow seamlessly into your existing workflows. No manual data entry, no reconciliation headaches.',
    icon: <Link2 className="w-5 h-5" />,
    category: 'Integrations'
  },
  {
    id: 6,
    question: "What if the other party doesn't have Wells?",
    answer: "No problem! We onboard your counterparties for free. They receive a simple invitation to join the negotiation, and we guide them through a 2-minute setup process. They don't need to be paying customers. This removes all friction and ensures you can use WellsAI for every deal, regardless of your counterparty's tech stack.",
    icon: <Users className="w-5 h-5" />,
    category: 'Getting Started'
  },
  {
    id: 7,
    question: 'How fast can I get started?',
    answer: 'From signup to your first deal in under 10 minutes. Create your account, connect your existing systems (optional), set your negotiation parameters, and launch your first RFQ. Our onboarding wizard handles the heavy lifting, and our team is available for white-glove setup if you need it.',
    icon: <Zap className="w-5 h-5" />,
    category: 'Getting Started'
  },
  {
    id: 8,
    question: 'Is there a free trial?',
    answer: 'Yes! Every new account gets 5 free RFQs to experience the full power of WellsAI. No credit card required. Use these to run real negotiations, see the AI in action, and measure the value before committing. Most customers convert after their first successful deal.',
    icon: <Gift className="w-5 h-5" />,
    category: 'Pricing'
  }
]

export default function FAQ() {
  const [openItems, setOpenItems] = useState<number[]>([])

  const toggleItem = (id: number) => {
    setOpenItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  const isOpen = (id: number) => openItems.includes(id)

  return (
    <section className="py-24 bg-gradient-to-b from-white to-gray-50 dark:from-[#0a0f1a] dark:to-[#0d1424] relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-full text-sm font-medium text-blue-600 dark:text-blue-400 mb-6">
            <HelpCircle className="w-4 h-4" />
            Frequently Asked Questions
          </div>

          <h2 className="font-playfair text-[clamp(32px,4vw,48px)] font-medium text-gray-900 dark:text-white mb-4 tracking-tight">
            Everything You Need
            <br />
            <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
              to Know
            </span>
          </h2>

          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Get answers to the most common questions about WellsAI and how it can transform your B2B negotiations.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {faqData.map((item, index) => (
            <div
              key={item.id}
              className="group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div
                className={`
                  relative overflow-hidden rounded-2xl
                  bg-white/80 dark:bg-white/5
                  backdrop-blur-xl
                  border transition-all duration-300 ease-out
                  ${isOpen(item.id)
                    ? 'border-blue-300 dark:border-blue-500/40 shadow-lg shadow-blue-500/5 dark:shadow-blue-500/10'
                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                  }
                `}
              >
                {/* Question Button */}
                <button
                  onClick={() => toggleItem(item.id)}
                  className="w-full px-6 py-5 flex items-center gap-4 text-left transition-colors"
                  aria-expanded={isOpen(item.id)}
                >
                  {/* Icon */}
                  <div
                    className={`
                      flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                      transition-all duration-300
                      ${isOpen(item.id)
                        ? 'bg-gradient-to-br from-blue-500 to-violet-500 text-white'
                        : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 group-hover:text-blue-500'
                      }
                    `}
                  >
                    {item.icon}
                  </div>

                  {/* Question Text */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`
                        text-base font-semibold transition-colors duration-200
                        ${isOpen(item.id)
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-900 dark:text-white'
                        }
                      `}
                    >
                      {item.question}
                    </h3>
                    {item.category && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mt-0.5 block">
                        {item.category}
                      </span>
                    )}
                  </div>

                  {/* Chevron */}
                  <div
                    className={`
                      flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                      transition-all duration-300 ease-out
                      ${isOpen(item.id)
                        ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rotate-180'
                        : 'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-500 group-hover:bg-gray-200 dark:group-hover:bg-white/15'
                      }
                    `}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </button>

                {/* Answer Panel */}
                <div
                  className={`
                    overflow-hidden transition-all duration-300 ease-out
                    ${isOpen(item.id) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
                  `}
                >
                  <div className="px-6 pb-6 pt-0">
                    <div className="pl-14">
                      <div className="h-px bg-gradient-to-r from-blue-200 via-violet-200 to-transparent dark:from-blue-500/20 dark:via-violet-500/20 dark:to-transparent mb-4" />
                      <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-[15px]">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-white/5 dark:to-white/[0.02] rounded-2xl border border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-violet-500 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Still have questions?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Our team is here to help
                </p>
              </div>
            </div>
            <a
              href="/contact"
              className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Contact Us
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
