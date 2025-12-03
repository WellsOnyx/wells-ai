import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function SignInPage() {
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
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
            <p className="text-gray-400">Sign in to your Wells Onyx account</p>
          </div>

          {/* Clerk Sign In Component */}
          <div className="flex justify-center">
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "bg-gray-900 border border-gray-800 shadow-xl",
                  headerTitle: "text-white",
                  headerSubtitle: "text-gray-400",
                  socialButtonsBlockButton: "bg-gray-800 border border-gray-700 text-white hover:bg-gray-700",
                  socialButtonsBlockButtonText: "text-white",
                  formButtonPrimary: "bg-amber-500 hover:bg-amber-600 text-black",
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
              Don't have an account?{' '}
              <Link href="/sign-up" className="text-amber-500 hover:text-amber-400 font-semibold">
                Sign up
              </Link>
            </p>
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
