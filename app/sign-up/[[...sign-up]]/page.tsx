'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('email', {
        email,
        redirect: false,
        callbackUrl: '/app',
      })

      if (result?.error) {
        setError('Failed to send magic link. Please try again.')
      } else {
        router.push('/verify-request')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a]">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif text-[#daa520] mb-2">Wells</h1>
            <p className="text-gray-600">Create your account</p>
          </div>

          {/* Sign Up Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#daa520] focus:border-transparent"
                placeholder="your@email.com"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#daa520] to-[#b8860b] text-white font-medium py-2.5 px-4 rounded-md hover:from-[#b8860b] hover:to-[#daa520] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sending magic link...' : 'Continue with Email'}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/sign-in" className="text-[#daa520] hover:underline font-medium">
              Sign in
            </a>
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-[#daa520]/5 rounded-md">
            <p className="text-xs text-gray-600 text-center">
              We'll send you a magic link to sign in without a password.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
