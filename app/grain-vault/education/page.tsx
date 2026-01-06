'use client'

/**
 * Grain & Vault - Education Vertical Landing Page
 * ESA/SFO (Education Savings Account / Scholarship Fund Organization)
 *
 * Target audience: SFO administrators, ESA program managers, private scholarship funds
 *
 * Key value prop: Protect education funds. Empower students.
 * - 100% protected deposits
 * - Funds appreciate while protected
 * - Disburse via credit line
 * - Full compliance and reporting
 */

import Link from 'next/link'
import {
  Shield,
  GraduationCap,
  Users,
  Building2,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  FileCheck,
  Lock,
  DollarSign,
  MapPin,
  BookOpen,
  Wallet,
  BarChart3,
  Globe,
  Clock,
  Zap,
  CreditCard,
  Receipt,
  UserCheck,
  School
} from 'lucide-react'

export default function EducationLandingPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/grain-vault" className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <div className="w-4 h-4 bg-black rounded-sm" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
              </div>
              <span className="text-lg font-semibold tracking-tight">Grain & Vault</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link href="/grain-vault" className="text-sm text-gray-400 hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/grain-vault/education" className="text-sm text-emerald-400 font-medium">
                Education
              </Link>
              <Link href="/grain-vault/enterprise" className="text-sm text-gray-400 hover:text-white transition-colors">
                Enterprise
              </Link>
              <div className="flex items-center gap-3 ml-4">
                <Link
                  href="/grain-vault/signin"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/grain-vault/education/dashboard"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black text-sm font-medium rounded-lg transition-all"
                >
                  SFO Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 lg:px-8 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-black to-black" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">Education Fund Management</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-white">Protect Education Funds.</span>
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500 bg-clip-text text-transparent">
                Empower Students.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-400 mb-12 leading-relaxed max-w-3xl mx-auto">
              State-funded ESAs. Private scholarships. Microschool funding.
              <br />
              100% protected. Full compliance. Zero hassle.
            </p>

            {/* Value Prop Grid */}
            <div className="grid md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-12">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="text-2xl font-bold text-white">100%</div>
                <div className="text-sm text-emerald-400">Fund Protection</div>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <div className="text-2xl font-bold text-white">4.5%+</div>
                <div className="text-sm text-blue-400">Annual Appreciation</div>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div className="text-2xl font-bold text-white">0%</div>
                <div className="text-sm text-purple-400">Disbursement Fees</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="text-2xl font-bold text-white">Real-time</div>
                <div className="text-sm text-amber-400">Compliance</div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link
                href="/grain-vault/education/dashboard"
                className="group px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-black rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/50 flex items-center gap-2"
              >
                Access SFO Dashboard
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="mailto:education@grainandvault.com?subject=ESA/SFO Inquiry"
                className="group px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl font-semibold text-lg transition-all flex items-center gap-2"
              >
                <GraduationCap className="w-5 h-5" />
                Schedule Demo
              </a>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>State ESA Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>SOC 2 Type II</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Real-time Auditing</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Eligible Expense Validation</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works for ESAs/SFOs */}
      <section className="py-24 px-6 lg:px-8 bg-gradient-to-b from-black to-black/95">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">How It Works for SFOs</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Deposit state funds. Keep them 100% protected. Disburse via credit line.
              Your principal never leaves the vault.
            </p>
          </div>

          {/* Three Layer Visual */}
          <div className="max-w-4xl mx-auto mb-16">
            {/* Layer 3: Appreciation (Top) */}
            <div className="p-6 rounded-t-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 border-b-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/30 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-purple-400 font-medium">LAYER 3: APPRECIATION</p>
                    <p className="text-lg text-white font-semibold">Funds grow while protected</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-purple-400">+4.5%</p>
                  <p className="text-sm text-gray-400">subsidizes admin costs</p>
                </div>
              </div>
            </div>

            {/* Layer 2: Credit Line (Middle) */}
            <div className="p-6 bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-x border-blue-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/30 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-blue-400 font-medium">LAYER 2: CREDIT LINE</p>
                    <p className="text-lg text-white font-semibold">Disburse to approved vendors</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-400">0%</p>
                  <p className="text-sm text-gray-400">disbursement fees</p>
                </div>
              </div>
            </div>

            {/* Layer 1: Protected Deposit (Bottom) */}
            <div className="p-6 rounded-b-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 border-t-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/30 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-emerald-400 font-medium">LAYER 1: PROTECTED PRINCIPAL</p>
                    <p className="text-lg text-white font-semibold">State funds 100% protected</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-emerald-400">100%</p>
                  <p className="text-sm text-gray-400">always available</p>
                </div>
              </div>
            </div>
          </div>

          {/* Step by Step */}
          <div className="max-w-4xl mx-auto grid md:grid-cols-4 gap-6">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-4xl font-bold text-emerald-400 mb-2">1</div>
              <h3 className="text-lg font-semibold mb-2">Receive State Funds</h3>
              <p className="text-sm text-gray-400">
                State ESA program deposits funds for your enrolled students.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-4xl font-bold text-blue-400 mb-2">2</div>
              <h3 className="text-lg font-semibold mb-2">Deposit to Vault</h3>
              <p className="text-sm text-gray-400">
                Funds are 100% protected. Get a 1:1 credit line for disbursements.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-4xl font-bold text-purple-400 mb-2">3</div>
              <h3 className="text-lg font-semibold mb-2">Disburse to Vendors</h3>
              <p className="text-sm text-gray-400">
                Pay approved vendors via GRAIN. Auto-validated for eligible expenses.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-4xl font-bold text-amber-400 mb-2">4</div>
              <h3 className="text-lg font-semibold mb-2">Report & Comply</h3>
              <p className="text-sm text-gray-400">
                Real-time compliance. Auto-generated state reports. Full audit trail.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* State Program Compatibility */}
      <section className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">State Program Compatible</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Built for compliance with state ESA programs and private scholarship requirements.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Arizona ESA */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-emerald-500/30 transition-all h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold">Arizona ESA</h3>
                    <p className="text-xs text-gray-400">Empowerment Scholarship</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Universal eligibility
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ClassWallet integration ready
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Quarterly reporting
                  </li>
                </ul>
              </div>
            </div>

            {/* Florida FES */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-blue-500/30 transition-all h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold">Florida FES</h3>
                    <p className="text-xs text-gray-400">Family Empowerment</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    Step Up For Students ready
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    K-12 + special needs
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    DOE reporting format
                  </li>
                </ul>
              </div>
            </div>

            {/* West Virginia Hope */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-amber-500/30 transition-all h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold">West Virginia Hope</h3>
                    <p className="text-xs text-gray-400">Hope Scholarship</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-500" />
                    K-12 eligible
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-500" />
                    State Treasurer approved
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-500" />
                    Annual audit support
                  </li>
                </ul>
              </div>
            </div>

            {/* Private Scholarships */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-purple-500/30 transition-all h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-bold">Private SFOs</h3>
                    <p className="text-xs text-gray-400">Scholarship Funds</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-500" />
                    Custom eligibility rules
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-500" />
                    Donor reporting
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-500" />
                    Tax credit compatible
                  </li>
                </ul>
              </div>
            </div>

            {/* Microschools */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-cyan-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-teal-500/30 transition-all h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                    <School className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h3 className="font-bold">Microschool Funds</h3>
                    <p className="text-xs text-gray-400">Learning Pods & Co-ops</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-teal-500" />
                    Multi-family pooling
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-teal-500" />
                    Educator payments
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-teal-500" />
                    Facility & curriculum
                  </li>
                </ul>
              </div>
            </div>

            {/* 529 Adjacent */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white/5 border border-white/10 rounded-xl p-6 hover:border-indigo-500/30 transition-all h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-bold">529 Adjacent</h3>
                    <p className="text-xs text-gray-400">Education Savings</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-indigo-500" />
                    K-12 tuition eligible
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-indigo-500" />
                    Protected appreciation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-indigo-500" />
                    IRS reporting support
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-4">
              Don't see your state or program? We're expanding rapidly.
            </p>
            <a
              href="mailto:education@grainandvault.com?subject=State Program Inquiry"
              className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Contact us about your program
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Compliance Features */}
      <section className="py-24 px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Built for Compliance</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Every feature designed with state reporting and audit requirements in mind.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Eligible Expense Validation */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Eligible Expense Validation</h3>
              <p className="text-gray-400 text-sm">
                Every disbursement automatically validated against state-specific eligible expense categories.
                Tuition, curriculum, therapy, and more.
              </p>
            </div>

            {/* Per-Student Accounting */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Per-Student Accounting</h3>
              <p className="text-gray-400 text-sm">
                Individual student accounts with complete transaction history.
                Track allocations, disbursements, and balances per student.
              </p>
            </div>

            {/* Vendor Qualification */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4">
                <UserCheck className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Vendor Qualification</h3>
              <p className="text-gray-400 text-sm">
                Approved vendor management with category verification.
                Only pay vendors approved for specific expense types.
              </p>
            </div>

            {/* Real-time Audit Trail */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center mb-4">
                <FileCheck className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Real-time Audit Trail</h3>
              <p className="text-gray-400 text-sm">
                Every transaction logged with timestamps, approvals, and compliance checks.
                Blockchain-verified for immutable records.
              </p>
            </div>

            {/* State Reporting */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="w-12 h-12 rounded-lg bg-teal-500/20 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-teal-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">State Reporting</h3>
              <p className="text-gray-400 text-sm">
                Auto-generated quarterly and annual reports in state-required formats.
                One-click submission ready.
              </p>
            </div>

            {/* Fund Protection */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">100% Fund Protection</h3>
              <p className="text-gray-400 text-sm">
                State funds are 100% protected at all times.
                Disbursements via credit line - principal never at risk.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Advantage Section */}
      <section className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 rounded-3xl blur opacity-20" />
            <div className="relative bg-gradient-to-br from-emerald-500/10 via-green-500/10 to-teal-500/10 border border-emerald-500/30 rounded-3xl p-8 md:p-16">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">The Grain & Vault Advantage</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold mb-6">
                    Your funds work harder.
                    <br />
                    <span className="text-emerald-400">Your students benefit.</span>
                  </h2>
                  <p className="text-gray-400 mb-8 leading-relaxed">
                    Traditional SFO accounts sit idle. With Grain & Vault, your protected principal
                    earns appreciation that can subsidize administrative costs or expand student services.
                  </p>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <span className="text-gray-300">4.5%+ annual appreciation on protected funds</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <span className="text-gray-300">Zero disbursement fees inside the ecosystem</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <span className="text-gray-300">Principal 100% protected, always available</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <span className="text-gray-300">More funds for students, not banks</span>
                    </li>
                  </ul>
                  <Link
                    href="/grain-vault/education/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-black rounded-xl font-semibold transition-all"
                  >
                    See It In Action
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>

                {/* Visual - Fund Growth */}
                <div className="space-y-4">
                  <div className="p-6 bg-black/30 border border-white/10 rounded-xl">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm text-gray-400">Traditional SFO Account</span>
                      <span className="text-red-400 text-sm">0% growth</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full">
                      <div className="h-2 bg-gray-500 rounded-full" style={{ width: '100%' }} />
                    </div>
                    <div className="mt-2 text-right text-sm text-gray-500">$2,500,000 stays $2,500,000</div>
                  </div>

                  <div className="p-6 bg-black/30 border border-emerald-500/30 rounded-xl">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm text-emerald-400">Grain & Vault</span>
                      <span className="text-emerald-400 text-sm">+4.5% appreciation</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full">
                      <div className="h-2 bg-gradient-to-r from-emerald-500 to-green-400 rounded-full" style={{ width: '100%' }} />
                    </div>
                    <div className="mt-2 text-right text-sm text-emerald-400">$2,500,000 + $112,500 appreciation</div>
                  </div>

                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
                    <div className="text-3xl font-bold text-emerald-400">$112,500</div>
                    <div className="text-sm text-gray-400">Additional funds for students annually</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-green-500/10 to-teal-500/10" />

        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Ready to protect student funds?
          </h2>

          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Join the SFOs and ESA administrators who trust Grain & Vault
            to protect and grow education funds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/grain-vault/education/dashboard"
              className="group px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-black rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/50 flex items-center gap-2"
            >
              Access SFO Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="mailto:education@grainandvault.com?subject=SFO Demo Request"
              className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl font-semibold text-lg transition-all flex items-center gap-2"
            >
              <GraduationCap className="w-5 h-5" />
              Request Demo
            </a>
          </div>

          <p className="mt-8 text-sm text-gray-500">
            Questions? <span className="text-white">education@grainandvault.com</span>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <div className="w-3 h-3 bg-black rounded-sm" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-sm" />
              </div>
              <span className="text-sm text-gray-400">
                2025 Grain & Vault Education. A{' '}
                <Link href="https://wellsonyx.io" className="text-amber-400 hover:text-amber-300">
                  Wells Onyx
                </Link>
                {' '}company.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-gray-500 hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="text-gray-500 hover:text-white transition-colors">Terms</Link>
              <a href="mailto:education@grainandvault.com" className="text-gray-500 hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
