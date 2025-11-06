'use client'

export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a]">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-[#daa520]/10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-[#daa520]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          {/* Header */}
          <h1 className="text-2xl font-serif text-gray-900 mb-3">Check your email</h1>
          <p className="text-gray-600 mb-6">
            We've sent you a magic link to sign in. Click the link in your email to continue.
          </p>

          {/* Info Box */}
          <div className="bg-[#daa520]/5 rounded-md p-4 mb-6">
            <p className="text-sm text-gray-600">
              The link will expire in 10 minutes. If you don't see the email, check your spam folder.
            </p>
          </div>

          {/* Back Button */}
          <a
            href="/sign-in"
            className="inline-block text-sm text-[#daa520] hover:underline font-medium"
          >
            ← Back to sign in
          </a>
        </div>
      </div>
    </div>
  )
}
