import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft, Zap, Shield, MessageSquare } from 'lucide-react'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600" />
              <span className="text-xl font-bold">Wells Onyx</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Value Props */}
          <div className="hidden lg:block">
            <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Join Wells Onyx
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              The AI platform that turns conversations into outcomes
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Natural Conversations</h3>
                  <p className="text-gray-400">Just tell Wells what you need. No forms, no complexity.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Instant Results</h3>
                  <p className="text-gray-400">Get matched with talent, suppliers, or customers in minutes.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Secure Transactions</h3>
                  <p className="text-gray-400">Built-in escrow and payment protection for every deal.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 p-6 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-amber-400 font-semibold mb-2">Pay only on success</p>
              <p className="text-gray-400 text-sm">1% flat fee on closed deals. Searching and matching are free.</p>
            </div>
          </div>

          {/* Right Side - Sign Up Form */}
          <div className="w-full max-w-md mx-auto lg:mx-0">
            <div className="text-center mb-8 lg:hidden">
              <h1 className="text-3xl font-bold mb-2">Get Started</h1>
              <p className="text-gray-400">Create your Wells Onyx account</p>
            </div>

            {/* Clerk Sign Up Component */}
            <div className="flex justify-center">
              <SignUp
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "bg-gray-900 border border-gray-800 shadow-xl",
                    headerTitle: "text-white",
                    headerSubtitle: "text-gray-400",
                    socialButtonsBlockButton: "bg-gray-800 border border-gray-700 text-white hover:bg-gray-700",
                    socialButtonsBlockButtonText: "text-white",
                    formButtonPrimary: "bg-amber-500 hover:bg-amber-600 text-black font-semibold",
                    formFieldInput: "bg-gray-800 border-gray-700 text-white",
                    formFieldLabel: "text-gray-300",
                    footerActionLink: "text-amber-500 hover:text-amber-400",
                    identityPreviewText: "text-white",
                    identityPreviewEditButton: "text-amber-500",
                    dividerLine: "bg-gray-700",
                    dividerText: "text-gray-400",
                    otpCodeFieldInput: "bg-gray-800 border-gray-700 text-white",
                  }
                }}
              />
            </div>

            {/* Additional Info */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-400">
                Already have an account?{' '}
                <Link href="/sign-in" className="text-amber-500 hover:text-amber-400 font-semibold">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-gray-400">
          <p>© 2025 Wells Onyx. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
