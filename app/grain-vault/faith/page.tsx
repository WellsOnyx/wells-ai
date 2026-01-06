'use client'

/**
 * Grain & Vault Faith-Based Organization Landing Page
 * grainandvault.com/faith
 *
 * Treasury infrastructure designed for churches, ministries, and religious organizations.
 * "Now faith is the substance of things hoped for, the evidence of things not seen." - Hebrews 11:1
 *
 * Dark theme with emerald accents - trustworthy and reverent design
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  Shield,
  Church,
  Heart,
  Globe,
  Building2,
  ArrowRight,
  CheckCircle,
  Users,
  TrendingUp,
  Lock,
  PieChart,
  HandHeart,
  BookOpen,
  Wallet,
  CreditCard,
  DollarSign,
  ChevronRight,
  Play,
  Quote,
  Star,
  Sparkles
} from 'lucide-react'

// Mock testimonials from churches
const testimonials = [
  {
    quote: "Grain & Vault has transformed how we steward our congregation's tithes. Our building fund grew 18% last year while remaining fully protected.",
    author: "Pastor David Chen",
    role: "Senior Pastor",
    church: "Grace Community Church",
    location: "Atlanta, GA",
    members: "2,500 members"
  },
  {
    quote: "The benevolence fund feature lets us help families in crisis immediately, with full privacy protection. It's exactly what ministry requires.",
    author: "Rev. Maria Santos",
    role: "Executive Pastor",
    church: "New Hope Fellowship",
    location: "Houston, TX",
    members: "1,800 members"
  },
  {
    quote: "Our missions giving has increased 40% since we started showing donors how their gifts appreciate over time. The transparency builds trust.",
    author: "Elder James Williams",
    role: "Board Chairman",
    church: "First Baptist Church",
    location: "Nashville, TN",
    members: "5,000 members"
  }
]

// Fund types with descriptions
const fundTypes = [
  {
    icon: Church,
    name: 'General Fund',
    description: 'Tithes and offerings for operational expenses, staff salaries, and ministry programs',
    color: 'emerald',
    percentage: '70%',
  },
  {
    icon: Building2,
    name: 'Building Fund',
    description: 'Capital campaigns, facility maintenance, and future expansion projects',
    color: 'blue',
    percentage: '10%',
  },
  {
    icon: Globe,
    name: 'Missions Fund',
    description: 'Support for missionaries, outreach programs, and global ministry partners',
    color: 'purple',
    percentage: '15%',
  },
  {
    icon: HandHeart,
    name: 'Benevolence Fund',
    description: 'Emergency assistance and support for congregation members in need',
    color: 'amber',
    percentage: '5%',
  },
]

export default function FaithLandingPage() {
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/grain-vault" className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <div className="w-4 h-4 bg-black rounded-sm" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-300 rounded-sm" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-semibold tracking-tight">Grain & Vault</span>
                <span className="text-xs text-emerald-400 -mt-1">for Faith Organizations</span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">
                Features
              </Link>
              <Link href="#funds" className="text-sm text-gray-400 hover:text-white transition-colors">
                Fund Types
              </Link>
              <Link href="#testimonials" className="text-sm text-gray-400 hover:text-white transition-colors">
                Testimonials
              </Link>
              <div className="flex items-center gap-3 ml-4">
                <Link
                  href="/grain-vault/signin"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/join?journey=faith"
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black text-sm font-medium rounded-lg transition-all"
                >
                  Protect Your Ministry
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-6 lg:px-8 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/50 via-black to-black" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-emerald-400/5 rounded-full blur-3xl" />

        {/* Subtle cross pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M28 0h4v28h28v4H32v28h-4V32H0v-4h28V0z' fill='%23ffffff' fill-opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }} />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
              <Church className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">Treasury for Faith Organizations</span>
            </div>

            {/* Scripture Reference - Subtle */}
            <p className="text-sm text-emerald-400/60 italic mb-4">
              "Now faith is the substance of things hoped for, the evidence of things not seen." - Hebrews 11:1
            </p>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-white">Protect Your</span>
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
                Ministry's Treasury
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-400 mb-8 leading-relaxed max-w-3xl mx-auto">
              100% protected deposits. 0% interest credit lines for operations.
              Tithe and offering management built for churches and ministries.
            </p>

            {/* Value Props */}
            <div className="grid md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-12">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <Shield className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">100%</div>
                <div className="text-sm text-emerald-400">Protected Deposits</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <CreditCard className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">0%</div>
                <div className="text-sm text-emerald-400">Interest Credit Line</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <TrendingUp className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">4.5%+</div>
                <div className="text-sm text-emerald-400">Annual Appreciation</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <PieChart className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">4</div>
                <div className="text-sm text-emerald-400">Fund Types</div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link
                href="/join?journey=faith"
                className="group px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/30 flex items-center gap-2"
              >
                Start Protecting Your Treasury
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="#features"
                className="group px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 text-white rounded-xl font-semibold text-lg transition-all flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                See How It Works
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>501(c)(3) Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Full Audit Trail</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Tax Receipt Generation</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-24 px-6 lg:px-8 bg-gradient-to-b from-black to-emerald-950/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Your Congregation's Tithes Deserve Better
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Traditional church banking leaves your ministry's treasury exposed
              to inflation and earning minimal interest. Every dollar lost to
              inflation is a dollar that could fund missions.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="p-6 rounded-xl bg-red-500/5 border border-red-500/20">
              <div className="text-4xl font-bold text-red-400 mb-2">-3.2%</div>
              <h3 className="font-semibold mb-2">Purchasing Power Lost</h3>
              <p className="text-sm text-gray-400">
                Average church treasury loses purchasing power annually due to inflation
                exceeding interest earned.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="text-4xl font-bold text-amber-400 mb-2">0.01%</div>
              <h3 className="font-semibold mb-2">Typical Bank Interest</h3>
              <p className="text-sm text-gray-400">
                Most church accounts earn virtually nothing while banks profit
                from your deposits.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <div className="text-4xl font-bold text-emerald-400 mb-2">+4.5%</div>
              <h3 className="font-semibold mb-2">With Grain & Vault</h3>
              <p className="text-sm text-gray-400">
                Your treasury appreciates over time, growing your ministry's
                purchasing power annually.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works for Churches */}
      <section id="features" className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm text-emerald-400 italic mb-4">
              "The plans of the diligent lead surely to abundance." - Proverbs 21:5
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Faithful Stewardship, Modern Treasury
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Grain & Vault protects your ministry's resources while making them
              work harder for the Kingdom.
            </p>
          </div>

          {/* Three Layer Model */}
          <div className="max-w-4xl mx-auto mb-16">
            {/* Layer 3: Appreciation */}
            <div className="p-6 rounded-t-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 border-b-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/30 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-purple-400 font-medium">LAYER 3: APPRECIATION</p>
                    <p className="text-lg text-white font-semibold">Your treasury grows over time</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-purple-400">+4.5%</p>
                  <p className="text-sm text-gray-400">annual growth</p>
                </div>
              </div>
            </div>

            {/* Layer 2: Credit Line */}
            <div className="p-6 bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-x border-blue-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/30 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-blue-400 font-medium">LAYER 2: CREDIT LINE</p>
                    <p className="text-lg text-white font-semibold">0% interest operations funding</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-400">0%</p>
                  <p className="text-sm text-gray-400">interest forever</p>
                </div>
              </div>
            </div>

            {/* Layer 1: Protected Deposit */}
            <div className="p-6 rounded-b-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 border-t-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/30 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-emerald-400 font-medium">LAYER 1: PROTECTED DEPOSIT</p>
                    <p className="text-lg text-white font-semibold">Your congregation's tithes, always safe</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-emerald-400">100%</p>
                  <p className="text-sm text-gray-400">protected</p>
                </div>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-emerald-500/30 transition-all h-full">
                <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-4">
                  <Church className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">Tithe Management</h3>
                <p className="text-gray-400 text-sm">
                  Automatic allocation of tithes and offerings across General, Building,
                  Missions, and Benevolence funds.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-blue-500/30 transition-all h-full">
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">Missions Tracking</h3>
                <p className="text-gray-400 text-sm">
                  Track missionary support, designate funds by field, and show
                  donors exactly where their gifts go.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-amber-500/30 transition-all h-full">
                <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center mb-4">
                  <HandHeart className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">Benevolence Workflow</h3>
                <p className="text-gray-400 text-sm">
                  Private request intake, approval workflow, and immediate disbursement
                  from credit line for urgent needs.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-purple-500/30 transition-all h-full">
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">Building Fund Growth</h3>
                <p className="text-gray-400 text-sm">
                  Watch your building fund appreciate over time. Set goals, track
                  progress, and fund your vision.
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-green-500/30 transition-all h-full">
                <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-4">
                  <BookOpen className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">Full Transparency</h3>
                <p className="text-gray-400 text-sm">
                  Complete audit trail, board-ready reports, and donor statements
                  for 501(c)(3) compliance.
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-cyan-500/30 transition-all h-full">
                <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">Staff Payroll</h3>
                <p className="text-gray-400 text-sm">
                  Pay pastoral staff and employees directly from your treasury.
                  Housing allowance tracking included.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fund Types Section */}
      <section id="funds" className="py-24 px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Four Funds, One Treasury
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Every tithe and offering is automatically allocated according to
              your ministry's priorities. Full visibility, complete control.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {fundTypes.map((fund) => {
              const Icon = fund.icon
              const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
                emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400' },
                blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
                purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400' },
                amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400' },
              }
              const colors = colorClasses[fund.color]

              return (
                <div
                  key={fund.name}
                  className={`p-6 rounded-xl bg-white/5 border ${colors.border} hover:bg-white/[0.08] transition-all`}
                >
                  <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${colors.text}`} />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">{fund.name}</h3>
                    <span className={`text-sm font-mono ${colors.text}`}>{fund.percentage}</span>
                  </div>
                  <p className="text-sm text-gray-400">{fund.description}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-4">
              Customize allocation percentages to match your ministry's priorities.
            </p>
            <Link
              href="/join?journey=faith"
              className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Configure Your Allocations
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm text-emerald-400 italic mb-4">
              "A good name is to be chosen rather than great riches." - Proverbs 22:1
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Trusted by Ministries Everywhere
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Churches across the country are protecting their treasuries
              and growing their ministry impact with Grain & Vault.
            </p>
          </div>

          {/* Featured Testimonial */}
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-3xl blur-xl" />
              <div className="relative bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/30 rounded-3xl p-8 md:p-12">
                <Quote className="w-12 h-12 text-emerald-400/40 mb-6" />
                <blockquote className="text-2xl md:text-3xl font-medium mb-8 leading-relaxed">
                  "{testimonials[activeTestimonial].quote}"
                </blockquote>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Users className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{testimonials[activeTestimonial].author}</p>
                    <p className="text-gray-400">{testimonials[activeTestimonial].role}</p>
                    <p className="text-sm text-emerald-400">
                      {testimonials[activeTestimonial].church} - {testimonials[activeTestimonial].members}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Testimonial Navigation */}
            <div className="flex justify-center gap-3 mt-8">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTestimonial(index)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === activeTestimonial
                      ? 'bg-emerald-500 w-8'
                      : 'bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">500+</div>
              <p className="text-gray-400">Churches Protected</p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">$47M</div>
              <p className="text-gray-400">Treasury Protected</p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">4.7%</div>
              <p className="text-gray-400">Average Appreciation</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benevolence Highlight */}
      <section className="py-24 px-6 lg:px-8 bg-gradient-to-b from-black to-amber-950/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
                <HandHeart className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400 font-medium">Benevolence Ministry</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Help Families in Crisis, Immediately
              </h2>
              <p className="text-gray-400 mb-8 leading-relaxed">
                When a family in your congregation faces an emergency, they need help now,
                not in two weeks. Grain & Vault's benevolence workflow lets you respond
                immediately while protecting privacy.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span className="text-gray-300">Private request submission</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span className="text-gray-300">Pastoral review workflow</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span className="text-gray-300">Immediate disbursement from credit line</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span className="text-gray-300">Direct vendor payment option</span>
                </li>
              </ul>
              <Link
                href="/grain-vault/faith/benevolence"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black rounded-xl font-semibold transition-all"
              >
                Learn About Benevolence
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            {/* Visual */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 to-orange-500/10 rounded-3xl blur-2xl" />
              <div className="relative bg-black/50 border border-amber-500/30 rounded-2xl p-8">
                {/* Mock benevolence request card */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-amber-400 font-medium">URGENT REQUEST</span>
                    <span className="px-2 py-1 bg-amber-500/20 rounded text-xs text-amber-400">Immediate</span>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-sm text-gray-400 mb-2">Category</p>
                    <p className="font-medium">Utility Assistance</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-sm text-gray-400 mb-2">Amount Requested</p>
                    <p className="text-2xl font-bold text-amber-400">$450.00</p>
                  </div>
                  <div className="flex gap-3">
                    <button className="flex-1 py-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg font-medium text-sm">
                      Approve
                    </button>
                    <button className="flex-1 py-3 bg-white/5 border border-white/10 text-gray-400 rounded-lg font-medium text-sm">
                      Review
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    * All requestor information kept confidential
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/50 via-black to-black" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto text-center">
          <p className="text-sm text-emerald-400/60 italic mb-4">
            "Honor the LORD with your wealth, with the firstfruits of all your crops." - Proverbs 3:9
          </p>

          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Ready to Protect Your Ministry's Treasury?
          </h2>

          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Join hundreds of churches stewarding their resources with Grain & Vault.
            100% protected. Growing over time. Built for ministry.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/join?journey=faith"
              className="group px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/30 flex items-center gap-2"
            >
              Start Protecting Your Treasury
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="mailto:faith@grainandvault.com?subject=Faith Organization Inquiry"
              className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 text-white rounded-xl font-semibold text-lg transition-all"
            >
              Talk to Our Team
            </a>
          </div>

          <p className="mt-8 text-sm text-gray-500">
            Questions? Email us at <span className="text-emerald-400">faith@grainandvault.com</span>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <div className="w-3 h-3 bg-black rounded-sm" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-300 rounded-sm" />
              </div>
              <span className="text-sm text-gray-400">
                Grain & Vault for Faith Organizations
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/grain-vault" className="text-gray-500 hover:text-white transition-colors">Main Site</Link>
              <Link href="/privacy" className="text-gray-500 hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="text-gray-500 hover:text-white transition-colors">Terms</Link>
              <a href="mailto:faith@grainandvault.com" className="text-gray-500 hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
