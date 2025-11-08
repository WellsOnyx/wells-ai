'use client'

/**
 * Main Dashboard - Post-Login Landing
 *
 * The 4 Journeys:
 * - Buyer: Procurement and sourcing
 * - Seller: GTM and revenue
 * - Job Seeker: Career and opportunities
 * - Founder: Holistic command center
 */

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart,
  Target,
  Briefcase,
  Rocket,
  ArrowRight,
  Sparkles
} from 'lucide-react'

export default function AppDashboard() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  // Redirect to sign-in if not authenticated
  if (isLoaded && !user) {
    router.push('/sign-in')
    return null
  }

  const journeys = [
    {
      id: 'buyer',
      title: 'Buyer Journey',
      description: 'Source anything, anywhere. AI finds suppliers, negotiates, and manages procurement.',
      icon: ShoppingCart,
      color: 'from-blue-600 to-blue-800',
      borderColor: 'border-blue-500/30',
      href: '/quotes',
      tag: 'Procurement'
    },
    {
      id: 'seller',
      title: 'Seller Journey',
      description: 'Automated GTM engine. Wells finds customers, runs campaigns, closes deals.',
      icon: Target,
      color: 'from-amber-600 to-amber-800',
      borderColor: 'border-amber-500/30',
      href: '/gtm',
      tag: 'Revenue'
    },
    {
      id: 'job-seeker',
      title: 'Job Seeker Journey',
      description: 'Find your calling. Wells helps you discover passions and land opportunities.',
      icon: Briefcase,
      color: 'from-purple-600 to-purple-800',
      borderColor: 'border-purple-500/30',
      href: '/job-seeker/dashboard',
      tag: 'Career'
    },
    {
      id: 'founder',
      title: 'Founder Journey',
      description: 'Holistic command center. Product, marketing, sales, ops—everything in one place.',
      icon: Rocket,
      color: 'from-green-600 to-green-800',
      borderColor: 'border-green-500/30',
      href: '/founder/dashboard',
      tag: 'Leadership'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900">
      {/* Header */}
      <div className="border-b border-gray-800 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-amber-400" />
                Welcome to Wells AI
              </h1>
              <p className="text-gray-400 mt-2">
                Hey {user?.firstName || 'there'}, I'm Wells—your AI companion for business.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Intro */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            Choose Your Journey
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            I handle all four journeys: <span className="text-amber-400">Buyer</span>, <span className="text-amber-400">Seller</span>, <span className="text-amber-400">Job Seeker</span>, and <span className="text-amber-400">Founder</span>.
            <br />
            No forms. No buttons. Just conversation.
          </p>
        </div>

        {/* Journey Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {journeys.map((journey) => {
            const Icon = journey.icon
            return (
              <button
                key={journey.id}
                onClick={() => router.push(journey.href)}
                className={`
                  group relative overflow-hidden
                  bg-gray-900/50 border ${journey.borderColor}
                  rounded-xl p-8
                  hover:scale-[1.02] hover:shadow-2xl
                  transition-all duration-300
                  text-left
                `}
              >
                {/* Background Gradient */}
                <div className={`
                  absolute inset-0 bg-gradient-to-br ${journey.color}
                  opacity-0 group-hover:opacity-10 transition-opacity duration-300
                `} />

                {/* Content */}
                <div className="relative">
                  {/* Tag */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800/50 border border-gray-700 mb-4">
                    <span className="text-xs font-medium text-gray-400">
                      {journey.tag}
                    </span>
                  </div>

                  {/* Icon */}
                  <div className="mb-4">
                    <Icon className="w-12 h-12 text-amber-400" />
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-amber-400 transition-colors">
                    {journey.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-400 leading-relaxed mb-4">
                    {journey.description}
                  </p>

                  {/* CTA */}
                  <div className="flex items-center gap-2 text-amber-400 font-medium">
                    Get Started
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer Note */}
        <div className="max-w-3xl mx-auto mt-12 p-6 bg-gradient-to-br from-amber-900/20 to-amber-800/10 border border-amber-900/30 rounded-lg">
          <p className="text-gray-300 text-center leading-relaxed">
            <strong className="text-white">Humans never talk directly.</strong>
            <br />
            You talk to me (Wells). I handle everything—sourcing, negotiating, hiring, selling.
            <br />
            Think of me as Ghost from Destiny. I'm your companion.
          </p>
        </div>
      </div>
    </div>
  )
}
