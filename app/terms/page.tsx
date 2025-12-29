'use client'

/**
 * WellsAI Terms of Service
 */

import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600&display=swap');
        .font-playfair { font-family: 'Playfair Display', Georgia, serif; }
      `}</style>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-gray-900 font-semibold text-[17px]">
            <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 rounded-[7px] flex items-center justify-center text-white text-[13px] font-bold">
              W
            </div>
            WellsAI
          </Link>
          <Link
            href="/chat"
            className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="py-16">
        <div className="max-w-[720px] mx-auto px-6">
          <h1 className="font-playfair text-4xl font-medium text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-gray-500 mb-12">Last updated: December 22, 2025</p>

          <div className="prose prose-gray max-w-none">
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-600 mb-6">
              By accessing or using WellsAI ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. Description of Service</h2>
            <p className="text-gray-600 mb-6">
              WellsAI is an AI-powered platform that facilitates B2B transactions including supplier sourcing, procurement, and talent matching. We connect buyers with sellers and provide tools to manage quotes, contracts, and payments.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. User Accounts</h2>
            <p className="text-gray-600 mb-4">
              To use certain features, you must create an account. You agree to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Be responsible for all activities under your account</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">4. Fees and Payment</h2>
            <p className="text-gray-600 mb-4">
              WellsAI charges a 1% success fee on closed transactions. This fee is:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li>Only charged when a deal closes successfully</li>
              <li>Calculated on the total transaction value</li>
              <li>Typically paid by the seller as part of the transaction</li>
              <li>Deducted from escrow funds before release</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">5. Escrow Services</h2>
            <p className="text-gray-600 mb-6">
              When you accept a quote through WellsAI, funds may be held in escrow. Escrow funds are released to the seller upon confirmation of delivery or service completion by the buyer. Disputes are handled according to our dispute resolution process.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">6. User Conduct</h2>
            <p className="text-gray-600 mb-4">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Provide false or misleading information</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Attempt to circumvent fees or escrow processes</li>
              <li>Harass or threaten other users</li>
              <li>Scrape or collect data without permission</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">7. Intellectual Property</h2>
            <p className="text-gray-600 mb-6">
              The Service and its contents are owned by WellsAI and protected by copyright, trademark, and other laws. You may not copy, modify, distribute, or create derivative works without our express permission.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">8. Disclaimer of Warranties</h2>
            <p className="text-gray-600 mb-6">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE THAT ANY TRANSACTION WILL BE COMPLETED OR THAT SUPPLIERS WILL MEET YOUR EXPECTATIONS. WE ARE A MARKETPLACE FACILITATOR, NOT A PARTY TO YOUR TRANSACTIONS.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-600 mb-6">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WELLSAI SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE FEES YOU PAID TO US IN THE PAST 12 MONTHS.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">10. Indemnification</h2>
            <p className="text-gray-600 mb-6">
              You agree to indemnify and hold harmless WellsAI from any claims, damages, or expenses arising from your use of the Service or violation of these terms.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">11. Termination</h2>
            <p className="text-gray-600 mb-6">
              We may terminate or suspend your account at any time for violations of these terms. You may close your account at any time. Upon termination, pending transactions will be handled according to our standard procedures.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">12. Governing Law</h2>
            <p className="text-gray-600 mb-6">
              These terms are governed by the laws of the State of Texas, without regard to conflict of law principles. Any disputes shall be resolved in the courts of Harris County, Texas.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">13. Changes to Terms</h2>
            <p className="text-gray-600 mb-6">
              We may modify these terms at any time. We will notify you of material changes by email or through the Service. Continued use after changes constitutes acceptance.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">14. Contact</h2>
            <p className="text-gray-600">
              Questions about these Terms should be sent to:
            </p>
            <p className="text-gray-600 mt-2">
              Email: <a href="mailto:legal@wellsai.io" className="text-blue-600 hover:underline">legal@wellsai.io</a><br />
              Address: The ION, 4201 Main Street, Houston, TX 77002
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-200">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 text-gray-900 font-semibold text-[17px] mb-4">
            <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 rounded-[7px] flex items-center justify-center text-white text-[13px] font-bold">
              W
            </div>
            WellsAI
          </Link>
          <p className="text-sm text-gray-500">
            © 2025 WellsAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
