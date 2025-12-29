'use client'

/**
 * WellsAI 404 Page
 * Custom not found page
 */

import Link from 'next/link'
import { Home, MessageSquare, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600&display=swap');
        .font-playfair { font-family: 'Playfair Display', Georgia, serif; }
      `}</style>

      <div className="text-center px-6">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2.5 text-gray-900 font-semibold text-[17px] mb-12">
          <div className="w-8 h-8 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            W
          </div>
          WellsAI
        </Link>

        {/* 404 */}
        <div className="mb-8">
          <div className="text-[120px] font-bold text-gray-100 leading-none">404</div>
          <h1 className="font-playfair text-3xl font-medium text-gray-900 -mt-8">
            Page Not Found
          </h1>
        </div>

        <p className="text-lg text-gray-500 max-w-md mx-auto mb-10">
          Looks like Wells couldn't find what you're looking for.
          The page may have moved or doesn't exist.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
          >
            <MessageSquare className="w-5 h-5" />
            Talk to Wells
          </Link>
        </div>

        {/* Popular Links */}
        <div className="mt-16 pt-10 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">Popular pages:</p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Pricing
            </Link>
            <Link href="/how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              How It Works
            </Link>
            <Link href="/about" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              About
            </Link>
            <Link href="/contact" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Contact
            </Link>
            <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Blog
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
