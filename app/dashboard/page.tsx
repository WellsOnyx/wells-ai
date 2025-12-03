import { currentUser } from '@clerk/nextjs/server'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import {
  Rocket,
  ShoppingCart,
  Store,
  Briefcase,
  ArrowRight,
  MessageSquare,
  TrendingUp,
  CheckCircle,
  Clock
} from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  const firstName = user.firstName || 'there'

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600" />
              <span className="text-xl font-bold">Wells Onyx</span>
            </Link>
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/dashboard" className="text-white font-semibold">
                  Dashboard
                </Link>
                <Link href="/deals" className="text-gray-300 hover:text-white transition-colors">
                  Deals
                </Link>
                <Link href="/settings" className="text-gray-300 hover:text-white transition-colors">
                  Settings
                </Link>
              </nav>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10",
                  }
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">
            Welcome back, {firstName}!
          </h1>
          <p className="text-xl text-gray-400">What would you like to accomplish today?</p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 text-sm font-semibold">Active Deals</h3>
              <TrendingUp className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-bold mb-2">0</div>
            <p className="text-sm text-gray-500">No active deals yet</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 text-sm font-semibold">Completed</h3>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold mb-2">0</div>
            <p className="text-sm text-gray-500">Start your first deal</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 text-sm font-semibold">Pending</h3>
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold mb-2">0</div>
            <p className="text-sm text-gray-500">No pending actions</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link
              href="/founder/chat"
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-amber-500 transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Founder Tools</h3>
              <p className="text-sm text-gray-400 mb-4">Hire talent, find customers, raise capital</p>
              <div className="flex items-center gap-2 text-amber-500 text-sm font-semibold">
                Start now <ArrowRight className="w-4 h-4" />
              </div>
            </Link>

            <Link
              href="/buyer/chat"
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-amber-500 transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Source Products</h3>
              <p className="text-sm text-gray-400 mb-4">Get quotes from verified suppliers</p>
              <div className="flex items-center gap-2 text-amber-500 text-sm font-semibold">
                Start now <ArrowRight className="w-4 h-4" />
              </div>
            </Link>

            <Link
              href="/suppliers/onboard"
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-amber-500 transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Store className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Sell Products</h3>
              <p className="text-sm text-gray-400 mb-4">Get matched with qualified buyers</p>
              <div className="flex items-center gap-2 text-amber-500 text-sm font-semibold">
                Start now <ArrowRight className="w-4 h-4" />
              </div>
            </Link>

            <Link
              href="/jobs/chat"
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-amber-500 transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Find Jobs</h3>
              <p className="text-sm text-gray-400 mb-4">Get matched with your ideal role</p>
              <div className="flex items-center gap-2 text-amber-500 text-sm font-semibold">
                Start now <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        </div>

        {/* Get Started Guide */}
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 rounded-2xl p-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-6 h-6 text-black" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2">Ready to get started?</h3>
              <p className="text-gray-300 mb-6">
                Just tell Wells what you need. Whether you're looking to hire, source products, find customers, or discover opportunities - Wells will handle the rest.
              </p>
              <Link
                href="/founder/chat"
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-600 transition-colors"
              >
                Talk to Wells
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6">Recent Activity</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
            <p className="text-gray-400 mb-6">Start a conversation with Wells to see your activity here</p>
            <Link
              href="/founder/chat"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-600 transition-colors"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-gray-400">
          <p>© 2025 Wells Onyx. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
