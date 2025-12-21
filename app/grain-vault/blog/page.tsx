'use client'

/**
 * Grain & Vault Blog - Thought Leadership Hub
 *
 * SEO-optimized blog featuring white paper level content
 * on treasury infrastructure, stablecoins, and modern finance.
 *
 * 33 comprehensive articles covering treasury, payments, stablecoins,
 * DeFi, regulatory compliance, and enterprise finance.
 */

import Link from 'next/link'
import { useState } from 'react'
import {
  FileText,
  Clock,
  ArrowRight,
  Search,
  TrendingUp,
  Shield,
  Zap,
  Building2,
  Globe,
  Code,
  BarChart3,
  Lock,
  Coins,
  Wallet,
  DollarSign,
  BookOpen,
  Filter,
  Layers,
  Database,
  Network,
  Target,
  Scale,
  Landmark,
  CircuitBoard,
  Cpu,
  Key,
  RefreshCw,
  Receipt,
  Banknote,
  PiggyBank,
  LineChart,
  Percent,
  Timer,
  Users,
  Briefcase,
  Factory,
  Truck,
  ShoppingCart
} from 'lucide-react'
import {
  GlassCard,
  BentoGrid,
  BentoItem,
  ShimmerButton,
  FloatingBadge,
  GlowOrb,
  NoiseOverlay,
  AnimatedText
} from '@/components/ui/modern'

// Blog post data - 33 SEO-optimized white paper level articles
export const blogPosts = [
  // === STABLECOIN & TOKENOMICS (6 articles) ===
  {
    slug: 'stablecoin-trilemma-solved',
    title: 'The Stablecoin Trilemma: How GRAIN Achieves Stability, Decentralization, and Yield',
    excerpt: 'Traditional stablecoins force a choice between stability, decentralization, and capital efficiency. GRAIN\'s novel architecture proves you can have all three through smart collateral management.',
    category: 'Tokenomics',
    readTime: '14 min',
    date: '2025-01-20',
    featured: true,
    icon: Layers,
    color: 'green'
  },
  {
    slug: 'backing-ratio-mechanics',
    title: 'Understanding Backing Ratios: Why 110% Collateralization Creates Anti-Fragility',
    excerpt: 'Deep dive into how over-collateralization protects against black swan events while maintaining capital efficiency. Mathematical models for stress-testing treasury reserves.',
    category: 'Tokenomics',
    readTime: '16 min',
    date: '2025-01-19',
    featured: false,
    icon: Shield,
    color: 'blue'
  },
  {
    slug: 'usdc-foundation-institutional-grade',
    title: 'Building on USDC: Why Circle\'s Regulated Infrastructure Matters for Enterprise',
    excerpt: 'An analysis of Circle\'s regulatory framework, reserve attestations, and why USDC provides the ideal foundation for institutional treasury solutions.',
    category: 'Partnerships',
    readTime: '12 min',
    date: '2025-01-18',
    featured: false,
    icon: Coins,
    color: 'green'
  },
  {
    slug: 'algorithmic-vs-collateralized-stablecoins',
    title: 'Algorithmic vs. Collateralized Stablecoins: A Post-Mortem Analysis',
    excerpt: 'Examining the failures of Terra, Iron Finance, and Basis Cash. Why algorithmic approaches fail and what collateralized designs get right.',
    category: 'Risk Management',
    readTime: '18 min',
    date: '2025-01-17',
    featured: false,
    icon: Scale,
    color: 'red'
  },
  {
    slug: 'yield-bearing-stablecoins-treasury',
    title: 'Yield-Bearing Stablecoins for Treasury: Comparing GRAIN, sDAI, and Ondo',
    excerpt: 'A comprehensive comparison of yield-generating stablecoin options for corporate treasury, with risk-adjusted return analysis.',
    category: 'Market Analysis',
    readTime: '15 min',
    date: '2025-01-16',
    featured: false,
    icon: Percent,
    color: 'amber'
  },
  {
    slug: 'tokenomics-sustainability',
    title: 'Sustainable Tokenomics: How GRAIN\'s Fee Model Funds Perpetual Growth',
    excerpt: 'Breaking down the economic model that allows GRAIN to appreciate indefinitely without relying on new deposits or Ponzi-like dynamics.',
    category: 'Tokenomics',
    readTime: '13 min',
    date: '2025-01-15',
    featured: false,
    icon: RefreshCw,
    color: 'green'
  },

  // === ENTERPRISE TREASURY & PAYMENTS (7 articles) ===
  {
    slug: 'treasury-transformation-playbook',
    title: 'The Treasury Transformation Playbook: From Legacy to Real-Time Operations',
    excerpt: 'A step-by-step guide for CFOs and treasury managers transitioning from batch-based legacy systems to instant, blockchain-powered treasury infrastructure.',
    category: 'Executive',
    readTime: '20 min',
    date: '2025-01-14',
    featured: true,
    icon: Building2,
    color: 'amber'
  },
  {
    slug: 'b2b-payment-failures-hidden-cost',
    title: 'The Hidden Cost of B2B Payment Failures: $250B Lost Annually',
    excerpt: 'Research reveals that failed payments, chargebacks, and reconciliation errors cost enterprises 2-5% of revenue. Here\'s how instant settlement eliminates this waste.',
    category: 'Payments',
    readTime: '11 min',
    date: '2025-01-13',
    featured: false,
    icon: Receipt,
    color: 'red'
  },
  {
    slug: 'working-capital-optimization-stablecoins',
    title: 'Working Capital Optimization Through Stablecoin Treasury',
    excerpt: 'How instant settlement reduces DSO by 15-30 days and unlocks millions in trapped working capital for growth investment.',
    category: 'Business Case',
    readTime: '14 min',
    date: '2025-01-12',
    featured: false,
    icon: PiggyBank,
    color: 'green'
  },
  {
    slug: 'accounts-payable-automation',
    title: 'Accounts Payable Automation: From Invoice to Payment in 60 Seconds',
    excerpt: 'Technical deep-dive into automated AP workflows that eliminate manual processing while maintaining full audit trails and approval controls.',
    category: 'Technical',
    readTime: '16 min',
    date: '2025-01-11',
    featured: false,
    icon: Zap,
    color: 'purple'
  },
  {
    slug: 'multi-entity-treasury-management',
    title: 'Multi-Entity Treasury Management: Unified View Across Subsidiaries',
    excerpt: 'Managing treasury operations across multiple legal entities, currencies, and jurisdictions with a single platform and real-time visibility.',
    category: 'Enterprise',
    readTime: '15 min',
    date: '2025-01-10',
    featured: false,
    icon: Network,
    color: 'blue'
  },
  {
    slug: 'cash-forecasting-ai-treasury',
    title: 'AI-Powered Cash Forecasting: Predicting Liquidity Needs with 95% Accuracy',
    excerpt: 'How machine learning models trained on transaction data deliver unprecedented accuracy in cash flow forecasting for treasury planning.',
    category: 'Technical',
    readTime: '17 min',
    date: '2025-01-09',
    featured: false,
    icon: LineChart,
    color: 'purple'
  },
  {
    slug: 'vendor-payment-network-effects',
    title: 'Vendor Payment Networks: Why Your Suppliers Will Thank You for GRAIN',
    excerpt: 'The network effects of instant vendor payments: faster access to funds, better supplier relationships, and early payment discounts.',
    category: 'Payments',
    readTime: '12 min',
    date: '2025-01-08',
    featured: false,
    icon: Users,
    color: 'green'
  },

  // === TECHNICAL & INTEGRATION (6 articles) ===
  {
    slug: 'erp-integration-architecture',
    title: 'ERP Integration Architecture: SAP, Oracle, NetSuite, and Beyond',
    excerpt: 'A comprehensive technical guide to connecting major ERP systems to blockchain-based treasury infrastructure with minimal disruption.',
    category: 'Technical',
    readTime: '22 min',
    date: '2025-01-07',
    featured: true,
    icon: Code,
    color: 'purple'
  },
  {
    slug: 'api-first-treasury',
    title: 'API-First Treasury: Building Composable Financial Infrastructure',
    excerpt: 'How REST APIs, webhooks, and event-driven architecture enable modular treasury systems that grow with your business.',
    category: 'Technical',
    readTime: '18 min',
    date: '2025-01-06',
    featured: false,
    icon: CircuitBoard,
    color: 'purple'
  },
  {
    slug: 'base-layer-2-enterprise',
    title: 'Why Base Layer 2: Enterprise-Grade Performance at Consumer Costs',
    excerpt: 'Technical analysis of Coinbase\'s Base network for institutional use cases: throughput, finality, costs, and regulatory positioning.',
    category: 'Technical',
    readTime: '15 min',
    date: '2025-01-05',
    featured: false,
    icon: Cpu,
    color: 'blue'
  },
  {
    slug: 'smart-contract-treasury-controls',
    title: 'Smart Contract Treasury Controls: Programmable Compliance and Limits',
    excerpt: 'Implementing spending limits, approval workflows, and compliance rules directly in smart contracts for automated governance.',
    category: 'Technical',
    readTime: '16 min',
    date: '2025-01-04',
    featured: false,
    icon: Key,
    color: 'purple'
  },
  {
    slug: 'webhook-architecture-realtime',
    title: 'Real-Time Treasury with Webhooks: Event-Driven Financial Operations',
    excerpt: 'Building real-time treasury dashboards and automated workflows using webhook notifications for payments, deposits, and settlements.',
    category: 'Technical',
    readTime: '14 min',
    date: '2025-01-03',
    featured: false,
    icon: Database,
    color: 'green'
  },
  {
    slug: 'custody-security-architecture',
    title: 'Custody Security Architecture: Multi-Sig, HSMs, and Defense in Depth',
    excerpt: 'A detailed examination of enterprise-grade custody solutions: key management, multi-signature requirements, and layered security.',
    category: 'Security',
    readTime: '19 min',
    date: '2025-01-02',
    featured: false,
    icon: Lock,
    color: 'red'
  },

  // === REGULATORY & COMPLIANCE (5 articles) ===
  {
    slug: 'stablecoin-regulation-2025',
    title: 'Stablecoin Regulation in 2025: What the New Laws Mean for Treasury',
    excerpt: 'Analysis of emerging stablecoin legislation in the US, EU, and Asia, and how compliant infrastructure positions enterprises for success.',
    category: 'Compliance',
    readTime: '16 min',
    date: '2025-01-01',
    featured: false,
    icon: Landmark,
    color: 'blue'
  },
  {
    slug: 'aml-kyc-enterprise-stablecoins',
    title: 'AML/KYC for Enterprise Stablecoins: Meeting Regulatory Requirements',
    excerpt: 'How to implement compliant onboarding, transaction monitoring, and suspicious activity reporting for stablecoin treasury operations.',
    category: 'Compliance',
    readTime: '14 min',
    date: '2024-12-31',
    featured: false,
    icon: Shield,
    color: 'blue'
  },
  {
    slug: 'proof-of-reserves-transparency',
    title: 'Proof of Reserves: On-Chain Transparency as a Competitive Advantage',
    excerpt: 'How real-time proof of reserves builds institutional trust and why opacity is no longer acceptable in treasury solutions.',
    category: 'Compliance',
    readTime: '12 min',
    date: '2024-12-30',
    featured: false,
    icon: FileText,
    color: 'green'
  },
  {
    slug: 'tax-accounting-stablecoins',
    title: 'Tax and Accounting for Stablecoin Treasury: A Practical Guide',
    excerpt: 'Navigating tax treatment, fair value accounting, and financial statement disclosure for stablecoin holdings and transactions.',
    category: 'Compliance',
    readTime: '15 min',
    date: '2024-12-29',
    featured: false,
    icon: Receipt,
    color: 'amber'
  },
  {
    slug: 'audit-trail-immutability',
    title: 'Immutable Audit Trails: Why Blockchain-Based Treasury Simplifies Compliance',
    excerpt: 'How blockchain\'s inherent immutability creates perfect audit trails that satisfy regulators and reduce compliance costs.',
    category: 'Compliance',
    readTime: '11 min',
    date: '2024-12-28',
    featured: false,
    icon: Database,
    color: 'green'
  },

  // === CROSS-BORDER & GLOBAL (4 articles) ===
  {
    slug: 'cross-border-payments-revolution',
    title: 'The Cross-Border Payments Revolution: Instant Global Settlement',
    excerpt: 'How stablecoin infrastructure eliminates SWIFT delays, correspondent banking fees, and the 3-5 day wait for international payments.',
    category: 'Global',
    readTime: '14 min',
    date: '2024-12-27',
    featured: false,
    icon: Globe,
    color: 'blue'
  },
  {
    slug: 'fx-hedging-stablecoins',
    title: 'FX Risk Management: How Stablecoins Simplify Currency Hedging',
    excerpt: 'Reducing foreign exchange exposure and hedging costs by settling international transactions in dollar-denominated stablecoins.',
    category: 'Global',
    readTime: '13 min',
    date: '2024-12-26',
    featured: false,
    icon: Banknote,
    color: 'green'
  },
  {
    slug: 'emerging-markets-treasury',
    title: 'Treasury Operations in Emerging Markets: Solving the Currency Volatility Problem',
    excerpt: 'How enterprises operating in high-inflation economies use stablecoin treasury to protect working capital from local currency depreciation.',
    category: 'Global',
    readTime: '15 min',
    date: '2024-12-25',
    featured: false,
    icon: TrendingUp,
    color: 'amber'
  },
  {
    slug: 'global-payroll-stablecoins',
    title: 'Global Payroll with Stablecoins: Paying Remote Teams Instantly',
    excerpt: 'A practical guide to running global payroll on stablecoin rails: compliance, tax withholding, and instant delivery to 180+ countries.',
    category: 'Global',
    readTime: '12 min',
    date: '2024-12-24',
    featured: false,
    icon: Users,
    color: 'purple'
  },

  // === INDUSTRY USE CASES (5 articles) ===
  {
    slug: 'supply-chain-finance-stablecoins',
    title: 'Supply Chain Finance: Accelerating the Order-to-Cash Cycle',
    excerpt: 'How manufacturers and distributors use stablecoin treasury to reduce payment delays, improve supplier relationships, and optimize inventory financing.',
    category: 'Use Cases',
    readTime: '16 min',
    date: '2024-12-23',
    featured: false,
    icon: Truck,
    color: 'amber'
  },
  {
    slug: 'saas-billing-stablecoins',
    title: 'SaaS Revenue Operations: Stablecoin Billing for Global Subscriptions',
    excerpt: 'How software companies eliminate payment failures, reduce churn, and simplify international billing with stablecoin payments.',
    category: 'Use Cases',
    readTime: '13 min',
    date: '2024-12-22',
    featured: false,
    icon: Code,
    color: 'purple'
  },
  {
    slug: 'ecommerce-treasury-stablecoins',
    title: 'E-Commerce Treasury: Instant Settlement for Marketplace Operators',
    excerpt: 'Why leading marketplaces are adopting stablecoin settlement for faster merchant payouts and reduced payment processing costs.',
    category: 'Use Cases',
    readTime: '14 min',
    date: '2024-12-21',
    featured: false,
    icon: ShoppingCart,
    color: 'green'
  },
  {
    slug: 'manufacturing-treasury-automation',
    title: 'Manufacturing Treasury: Automating Supplier Payments at Scale',
    excerpt: 'Case study: How a mid-market manufacturer reduced AP processing costs by 70% with automated stablecoin payments.',
    category: 'Use Cases',
    readTime: '12 min',
    date: '2024-12-20',
    featured: false,
    icon: Factory,
    color: 'blue'
  },
  {
    slug: 'professional-services-treasury',
    title: 'Professional Services Firms: Client Billing and Vendor Payments',
    excerpt: 'How consulting, legal, and accounting firms streamline client invoicing and contractor payments with stablecoin treasury.',
    category: 'Use Cases',
    readTime: '11 min',
    date: '2024-12-19',
    featured: false,
    icon: Briefcase,
    color: 'amber'
  }
]

const categories = ['All', 'Tokenomics', 'Technical', 'Payments', 'Compliance', 'Global', 'Executive', 'Use Cases', 'Security', 'Risk Management']

export default function GrainVaultBlog() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredPosts = blogPosts.filter(post => {
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const featuredPosts = blogPosts.filter(post => post.featured)

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <NoiseOverlay />

      {/* Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <GlowOrb color="green" size="xl" position={{ top: '-200px', right: '20%' }} />
        <GlowOrb color="blue" size="lg" position={{ bottom: '30%', left: '-100px' }} animate={false} />
        <GlowOrb color="purple" size="md" position={{ top: '50%', right: '-50px' }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50">
          <GlassCard hover={false} padding="none" className="rounded-none border-x-0 border-t-0">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <Link href="/grain-vault" className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                      <div className="w-4 h-4 bg-black rounded-sm" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
                  </div>
                  <span className="text-lg font-semibold tracking-tight">
                    <AnimatedText text="Grain & Vault" gradient gradientColors="from-green-400 to-blue-400" />
                  </span>
                </Link>

                <nav className="hidden md:flex items-center gap-8">
                  <Link href="/grain-vault" className="text-sm text-gray-400 hover:text-white transition-colors">
                    Home
                  </Link>
                  <Link href="/grain-vault#treasury-sdk" className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium">
                    Treasury SDK
                  </Link>
                  <Link href="/grain-vault/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
                    Dashboard
                  </Link>
                  <ShimmerButton variant="primary" size="sm" className="bg-gradient-to-r from-green-500 to-green-600" onClick={() => window.location.href = '/grain-vault/onboard'}>
                    Open Account
                  </ShimmerButton>
                </nav>
              </div>
            </div>
          </GlassCard>
        </header>

        {/* Hero */}
        <section className="pt-32 pb-16 px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <FloatingBadge color="green">
                <BookOpen className="w-4 h-4" />
                Thought Leadership
              </FloatingBadge>
              <h1 className="text-4xl md:text-6xl font-bold mt-6 mb-4">
                <AnimatedText text="Treasury Insights" gradient gradientColors="from-green-400 via-blue-400 to-purple-400" className="text-4xl md:text-6xl font-bold" />
              </h1>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                White paper level analysis on treasury infrastructure, stablecoins, and the future of enterprise finance. {blogPosts.length} in-depth articles.
              </p>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-12">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-center">
                <Filter className="w-4 h-4 text-gray-500 mr-2" />
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedCategory === cat
                        ? 'bg-green-500 text-black'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Featured Posts */}
        {selectedCategory === 'All' && searchQuery === '' && (
          <section className="px-6 lg:px-8 mb-16">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-green-400" />
                Featured Articles
              </h2>

              <BentoGrid cols={3} className="gap-6">
                {featuredPosts.map((post, i) => (
                  <BentoItem key={post.slug} span={i === 0 ? 2 : 1}>
                    <Link href={`/grain-vault/blog/${post.slug}`}>
                      <GlassCard hover glow={post.color as any} className="h-full group cursor-pointer">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-12 h-12 rounded-xl bg-${post.color}-500/20 flex items-center justify-center`}>
                            <post.icon className={`w-6 h-6 text-${post.color}-400`} />
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${post.color}-500/20 text-${post.color}-400`}>
                            {post.category}
                          </span>
                        </div>

                        <h3 className="text-xl font-bold mb-3 group-hover:text-green-400 transition-colors">
                          {post.title}
                        </h3>

                        <p className="text-gray-400 text-sm mb-6 line-clamp-3">
                          {post.excerpt}
                        </p>

                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {post.readTime}
                          </div>
                          <span>{post.date}</span>
                        </div>
                      </GlassCard>
                    </Link>
                  </BentoItem>
                ))}
              </BentoGrid>
            </div>
          </section>
        )}

        {/* All Posts */}
        <section className="px-6 lg:px-8 pb-24">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-400" />
              {selectedCategory === 'All' ? 'All Articles' : selectedCategory}
              <span className="text-sm font-normal text-gray-500">({filteredPosts.length})</span>
            </h2>

            {filteredPosts.length === 0 ? (
              <GlassCard className="text-center py-16">
                <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">No articles found</h3>
                <p className="text-gray-400">Try adjusting your search or filter criteria.</p>
              </GlassCard>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPosts.map((post) => (
                  <Link key={post.slug} href={`/grain-vault/blog/${post.slug}`}>
                    <GlassCard hover className="h-full group cursor-pointer">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-10 h-10 rounded-lg bg-${post.color}-500/20 flex items-center justify-center`}>
                          <post.icon className={`w-5 h-5 text-${post.color}-400`} />
                        </div>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/5 text-gray-400">
                          {post.category}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold mb-2 group-hover:text-green-400 transition-colors line-clamp-2">
                        {post.title}
                      </h3>

                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {post.excerpt}
                      </p>

                      <div className="flex items-center justify-between text-sm text-gray-500 mt-auto">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {post.readTime}
                        </div>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="px-6 lg:px-8 pb-24">
          <div className="max-w-4xl mx-auto">
            <GlassCard glow="green" className="text-center">
              <h3 className="text-2xl font-bold mb-4">Stay Informed</h3>
              <p className="text-gray-400 mb-6">
                Get the latest research on treasury infrastructure, stablecoins, and enterprise finance delivered to your inbox.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50"
                />
                <ShimmerButton className="bg-gradient-to-r from-green-500 to-green-600">
                  Subscribe
                </ShimmerButton>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                      <div className="w-4 h-4 bg-black rounded-sm" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
                  </div>
                  <span className="text-lg font-semibold">Grain & Vault</span>
                </div>
                <p className="text-gray-400 text-sm">Treasury infrastructure for modern finance teams.</p>
              </div>

              <div>
                <h4 className="font-semibold mb-4 text-sm">Products</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li><Link href="/grain-vault#products" className="hover:text-white transition-colors">GRAIN</Link></li>
                  <li><Link href="/grain-vault#products" className="hover:text-white transition-colors">VAULT</Link></li>
                  <li><Link href="/grain-vault#treasury-sdk" className="text-purple-400 hover:text-purple-300 transition-colors">Treasury SDK</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4 text-sm">Resources</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li><Link href="/grain-vault/demo" className="hover:text-white transition-colors">Documentation</Link></li>
                  <li><Link href="/grain-vault/demo" className="hover:text-white transition-colors">API Reference</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4 text-sm">Company</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li><Link href="/grain-vault/blog" className="text-green-400 hover:text-green-300 transition-colors">Blog</Link></li>
                  <li><Link href="https://wellsonyx.io" className="text-amber-400 hover:text-amber-300 transition-colors">Wells Onyx</Link></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-white/10 text-center text-sm text-gray-500">
              <p>2025 Grain & Vault. A Wells Onyx company.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
