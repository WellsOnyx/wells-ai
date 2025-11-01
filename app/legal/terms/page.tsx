import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-[#9ea1a7]/10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="12" r="3" fill="#183b6d" />
              <line x1="20" y1="15" x2="12" y2="28" stroke="#183b6d" strokeWidth="1.5" />
              <line x1="20" y1="15" x2="20" y2="32" stroke="#183b6d" strokeWidth="1.5" />
              <line x1="20" y1="15" x2="28" y2="28" stroke="#183b6d" strokeWidth="1.5" />
              <circle cx="12" cy="28" r="2.5" fill="#183b6d" />
              <circle cx="28" cy="28" r="2.5" fill="#183b6d" />
              <circle cx="20" cy="32" r="2.5" fill="#183b6d" />
              <circle cx="20" cy="12" r="1.5" fill="#dba63f" opacity="0.9" />
            </svg>
            <div>
              <div className="font-semibold text-[#183b6d] text-lg tracking-tight">Wells AI</div>
              <div className="text-[10px] text-[#575757] tracking-[0.15em] uppercase">Terms of Service</div>
            </div>
          </Link>
          <Link
            href="/"
            className="text-[#183b6d] hover:text-[#dba63f] transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto prose prose-lg">
          <h1 className="text-5xl font-serif text-[#183b6d] mb-4">Terms of Service</h1>
          <p className="text-[#575757] mb-8">Last updated: November 1, 2025</p>

          <div className="bg-[#183b6d]/5 border-2 border-[#9ea1a7]/20 rounded-sm p-6 mb-8 not-prose">
            <p className="text-[#575757]">
              Welcome to Wells AI. By using our platform, you agree to these Terms of Service. Please read them carefully.
            </p>
          </div>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">1. Acceptance of Terms</h2>
          <p className="text-[#575757]">
            By accessing or using Wells AI ("the Platform"), you agree to be bound by these Terms of Service and all applicable
            laws and regulations. If you do not agree with any of these terms, you are prohibited from using the Platform.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">2. Description of Service</h2>
          <p className="text-[#575757]">
            Wells AI provides an enterprise conversational commerce platform that facilitates business transactions across
            industries, including but not limited to:
          </p>
          <ul className="text-[#575757]">
            <li>Procurement and supplier matching</li>
            <li>Executive search and talent placement</li>
            <li>Professional services coordination</li>
            <li>Go-to-market automation (GTM SDK)</li>
            <li>Partnership ecosystem management (Partner SDK)</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">3. Pricing and Fees</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">3.1 Success-Based Pricing</h3>
          <p className="text-[#575757]">
            Wells AI operates on a success-based pricing model. Our standard fee structure is:
          </p>
          <ul className="text-[#575757]">
            <li><strong>Base Rate:</strong> 33 basis points (0.33%) on closed annual contract value (ACV)</li>
            <li><strong>Variable Rates:</strong> May range from 0.5% to 10% depending on transaction type, complexity, and value</li>
            <li><strong>No Upfront Costs:</strong> You only pay when transactions successfully close</li>
          </ul>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">3.2 Payment Terms</h3>
          <p className="text-[#575757]">
            Payment is due within 30 days of invoice date. Fees are calculated based on the total transaction value
            facilitated through the Platform. All fees are non-refundable once services have been rendered.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">4. User Accounts</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">4.1 Account Creation</h3>
          <p className="text-[#575757]">
            To use certain features of the Platform, you must create an account. You agree to:
          </p>
          <ul className="text-[#575757]">
            <li>Provide accurate, current, and complete information</li>
            <li>Maintain and promptly update your account information</li>
            <li>Maintain the security of your password and account</li>
            <li>Accept responsibility for all activities under your account</li>
          </ul>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">4.2 Account Termination</h3>
          <p className="text-[#575757]">
            We reserve the right to terminate or suspend your account immediately, without prior notice, for conduct
            that we believe violates these Terms or is harmful to other users, us, or third parties.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">5. Acceptable Use</h2>
          <p className="text-[#575757]">You agree not to:</p>
          <ul className="text-[#575757]">
            <li>Use the Platform for any illegal or unauthorized purpose</li>
            <li>Violate any laws in your jurisdiction</li>
            <li>Transmit any viruses, malware, or malicious code</li>
            <li>Attempt to gain unauthorized access to the Platform or related systems</li>
            <li>Interfere with or disrupt the Platform or servers</li>
            <li>Impersonate any person or entity</li>
            <li>Collect or store personal data about other users without consent</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">6. Intellectual Property</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">6.1 Platform Ownership</h3>
          <p className="text-[#575757]">
            The Platform and its original content, features, and functionality are owned by Wells Onyx and are protected
            by international copyright, trademark, patent, trade secret, and other intellectual property laws.
          </p>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">6.2 User Data</h3>
          <p className="text-[#575757]">
            You retain all rights to data you submit to the Platform. By using the Platform, you grant us a limited license
            to use, store, and process your data to provide our services.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">7. API and SDK Usage</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">7.1 GTM SDK</h3>
          <p className="text-[#575757]">
            Use of the Wells GTM SDK is subject to these Terms. The SDK is provided "as is" and we reserve the right
            to modify, suspend, or discontinue the SDK at any time.
          </p>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">7.2 Partner SDK</h3>
          <p className="text-[#575757]">
            The Partner SDK must be used in compliance with all applicable partner platform terms of service. You are
            responsible for maintaining compliance with partner relationship management (PRM) rules and etiquette.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">8. Disclaimers and Limitations of Liability</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">8.1 No Warranties</h3>
          <p className="text-[#575757]">
            THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT
            LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
          </p>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">8.2 Limitation of Liability</h3>
          <p className="text-[#575757]">
            IN NO EVENT SHALL WELLS ONYX BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
            INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE
            OF THE PLATFORM.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">9. Indemnification</h2>
          <p className="text-[#575757]">
            You agree to indemnify and hold harmless Wells Onyx and its affiliates, officers, agents, and employees from
            any claim or demand, including reasonable attorneys' fees, made by any third party due to or arising out of
            your use of the Platform, your violation of these Terms, or your violation of any rights of another.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">10. Governing Law</h2>
          <p className="text-[#575757]">
            These Terms shall be governed by and construed in accordance with the laws of the State of Florida, United States,
            without regard to its conflict of law provisions.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">11. Dispute Resolution</h2>
          <p className="text-[#575757]">
            Any dispute arising from these Terms shall be resolved through binding arbitration in accordance with the
            rules of the American Arbitration Association. The arbitration shall take place in Miami, Florida.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">12. Changes to Terms</h2>
          <p className="text-[#575757]">
            We reserve the right to modify these Terms at any time. We will provide notice of significant changes by
            posting the new Terms on this page and updating the "Last updated" date. Your continued use of the Platform
            after such modifications constitutes acceptance of the updated Terms.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">13. Contact Information</h2>
          <p className="text-[#575757]">
            For questions about these Terms, please contact us at:
          </p>
          <div className="bg-[#183b6d]/5 p-6 rounded-sm not-prose mt-4">
            <p className="text-[#575757] mb-2">
              <strong>Email:</strong> <a href="mailto:hello@wellsai.com" className="text-[#dba63f] hover:text-[#c89430]">hello@wellsai.com</a>
            </p>
            <p className="text-[#575757]">
              <strong>Website:</strong> <a href="https://www.wellsonyx.com" target="_blank" rel="noopener noreferrer" className="text-[#dba63f] hover:text-[#c89430]">www.wellsonyx.com</a>
            </p>
          </div>

          <div className="mt-16 pt-8 border-t border-[#9ea1a7]/20 not-prose">
            <div className="flex gap-4">
              <Link
                href="/legal/privacy"
                className="text-[#dba63f] hover:text-[#c89430] font-medium"
              >
                Privacy Policy →
              </Link>
              <Link
                href="/legal/security"
                className="text-[#dba63f] hover:text-[#c89430] font-medium"
              >
                Security →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
