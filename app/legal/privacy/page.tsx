import Link from 'next/link'

export default function PrivacyPage() {
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
              <div className="text-[10px] text-[#575757] tracking-[0.15em] uppercase">Privacy Policy</div>
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
          <h1 className="text-5xl font-serif text-[#183b6d] mb-4">Privacy Policy</h1>
          <p className="text-[#575757] mb-8">Last updated: November 1, 2025</p>

          <div className="bg-[#183b6d]/5 border-2 border-[#9ea1a7]/20 rounded-sm p-6 mb-8 not-prose">
            <p className="text-[#575757]">
              At Wells AI, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose,
              and protect your information when you use our platform.
            </p>
          </div>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">1. Information We Collect</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">1.1 Information You Provide</h3>
          <p className="text-[#575757]">We collect information you directly provide to us, including:</p>
          <ul className="text-[#575757]">
            <li><strong>Account Information:</strong> Name, email address, company name, job title, phone number</li>
            <li><strong>Profile Data:</strong> Industry, company size, ideal customer profile (ICP), business goals</li>
            <li><strong>Transaction Data:</strong> RFQ details, procurement specifications, supplier information</li>
            <li><strong>Communication Data:</strong> Messages, feedback, support requests</li>
            <li><strong>Payment Information:</strong> Billing address, payment method (processed securely through Stripe)</li>
          </ul>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">1.2 Information Automatically Collected</h3>
          <p className="text-[#575757]">When you use our platform, we automatically collect:</p>
          <ul className="text-[#575757]">
            <li><strong>Usage Data:</strong> Pages viewed, features used, time spent, click patterns</li>
            <li><strong>Device Information:</strong> Browser type, operating system, IP address, device identifiers</li>
            <li><strong>Location Data:</strong> Approximate geographic location based on IP address</li>
            <li><strong>Cookies and Similar Technologies:</strong> See our Cookie Policy below</li>
          </ul>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">1.3 Information from Third Parties</h3>
          <p className="text-[#575757]">We may receive information from:</p>
          <ul className="text-[#575757]">
            <li><strong>Authentication Providers:</strong> Clerk (account creation and login)</li>
            <li><strong>Data Enrichment Services:</strong> Apollo, LinkedIn, Crunchbase (for GTM SDK)</li>
            <li><strong>Partner Platforms:</strong> IBM, Cisco, Snowflake, etc. (for Partner SDK)</li>
            <li><strong>Communication Services:</strong> Twilio (SMS notifications)</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">2. How We Use Your Information</h2>
          <p className="text-[#575757]">We use your information to:</p>
          <ul className="text-[#575757]">
            <li><strong>Provide Services:</strong> Process transactions, match suppliers, facilitate deals</li>
            <li><strong>Personalization:</strong> Customize your experience, improve AI recommendations</li>
            <li><strong>Communication:</strong> Send transaction updates, notifications, support responses</li>
            <li><strong>Analytics:</strong> Understand usage patterns, improve platform performance</li>
            <li><strong>Marketing:</strong> Send product updates (with your consent, opt-out available)</li>
            <li><strong>Compliance:</strong> Meet legal obligations, prevent fraud, enforce our Terms</li>
            <li><strong>Development:</strong> Improve features, train AI models, develop new services</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">3. How We Share Your Information</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">3.1 With Your Consent</h3>
          <p className="text-[#575757]">
            We share your information when you explicitly consent, such as when connecting suppliers with buyers
            or registering deals with partner platforms.
          </p>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">3.2 Service Providers</h3>
          <p className="text-[#575757]">We work with trusted third-party service providers:</p>
          <ul className="text-[#575757]">
            <li><strong>Vercel:</strong> Hosting and infrastructure</li>
            <li><strong>Clerk:</strong> Authentication and user management</li>
            <li><strong>Anthropic:</strong> AI model (Claude) for conversational features</li>
            <li><strong>Stripe:</strong> Payment processing</li>
            <li><strong>Twilio:</strong> SMS notifications</li>
            <li><strong>Notion:</strong> Database management (encrypted)</li>
          </ul>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">3.3 Business Transfers</h3>
          <p className="text-[#575757]">
            If Wells Onyx is involved in a merger, acquisition, or asset sale, your information may be transferred.
            We will provide notice before your information is transferred and becomes subject to a different Privacy Policy.
          </p>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">3.4 Legal Requirements</h3>
          <p className="text-[#575757]">
            We may disclose your information if required by law or in response to valid requests by public authorities
            (e.g., court orders, subpoenas).
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">4. Data Retention</h2>
          <p className="text-[#575757]">
            We retain your information for as long as your account is active or as needed to provide services.
            We will retain and use your information as necessary to comply with legal obligations, resolve disputes,
            and enforce our agreements.
          </p>
          <ul className="text-[#575757]">
            <li><strong>Account Data:</strong> Retained while your account is active, plus 90 days after deletion</li>
            <li><strong>Transaction Records:</strong> Retained for 7 years for accounting and legal compliance</li>
            <li><strong>Communication Logs:</strong> Retained for 2 years</li>
            <li><strong>Usage Analytics:</strong> Aggregated and anonymized after 1 year</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">5. Data Security</h2>
          <p className="text-[#575757]">We implement industry-standard security measures to protect your information:</p>
          <ul className="text-[#575757]">
            <li><strong>Encryption:</strong> All data encrypted in transit (TLS 1.3) and at rest (AES-256)</li>
            <li><strong>Access Controls:</strong> Role-based access, multi-factor authentication</li>
            <li><strong>Regular Audits:</strong> Security assessments and penetration testing</li>
            <li><strong>Incident Response:</strong> 24/7 monitoring and incident response procedures</li>
          </ul>
          <p className="text-[#575757]">
            See our <Link href="/legal/security" className="text-[#dba63f] hover:text-[#c89430]">Security page</Link> for
            more details.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">6. Your Rights and Choices</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">6.1 Access and Portability</h3>
          <p className="text-[#575757]">
            You can request a copy of your personal data in a machine-readable format.
          </p>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">6.2 Correction and Deletion</h3>
          <p className="text-[#575757]">
            You can update or delete your account information at any time through your account settings or by
            contacting us.
          </p>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">6.3 Opt-Out</h3>
          <p className="text-[#575757]">
            You can opt out of marketing communications at any time by clicking "unsubscribe" in emails or
            adjusting your notification preferences.
          </p>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">6.4 Do Not Track</h3>
          <p className="text-[#575757]">
            We currently do not respond to "Do Not Track" signals as there is no industry standard for compliance.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">7. International Data Transfers</h2>
          <p className="text-[#575757]">
            Your information may be transferred to and processed in countries other than your country of residence.
            These countries may have data protection laws different from those in your country. We ensure appropriate
            safeguards are in place to protect your information in accordance with this Privacy Policy.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">8. Children's Privacy</h2>
          <p className="text-[#575757]">
            Our platform is not intended for individuals under 18 years of age. We do not knowingly collect personal
            information from children. If you become aware that a child has provided us with personal information,
            please contact us immediately.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">9. Cookies Policy</h2>
          <p className="text-[#575757]">We use cookies and similar technologies to:</p>
          <ul className="text-[#575757]">
            <li><strong>Essential Cookies:</strong> Required for authentication and security</li>
            <li><strong>Performance Cookies:</strong> Help us understand how you use the platform</li>
            <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
          </ul>
          <p className="text-[#575757]">
            You can control cookies through your browser settings, though disabling certain cookies may impact
            functionality.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">10. GDPR Compliance (EU Users)</h2>
          <p className="text-[#575757]">If you are in the European Economic Area (EEA), you have additional rights:</p>
          <ul className="text-[#575757]">
            <li>Right to access your personal data</li>
            <li>Right to rectification of inaccurate data</li>
            <li>Right to erasure ("right to be forgotten")</li>
            <li>Right to restrict processing</li>
            <li>Right to data portability</li>
            <li>Right to object to processing</li>
            <li>Right to withdraw consent</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">11. CCPA Compliance (California Users)</h2>
          <p className="text-[#575757]">If you are a California resident, you have the right to:</p>
          <ul className="text-[#575757]">
            <li>Know what personal information we collect, use, and share</li>
            <li>Request deletion of your personal information</li>
            <li>Opt-out of the "sale" of your personal information (Note: We do not sell personal information)</li>
            <li>Non-discrimination for exercising your privacy rights</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">12. Changes to This Policy</h2>
          <p className="text-[#575757]">
            We may update this Privacy Policy from time to time. We will notify you of significant changes by posting
            the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this
            Privacy Policy periodically.
          </p>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">13. Contact Us</h2>
          <p className="text-[#575757]">
            For questions about this Privacy Policy or to exercise your rights, contact us at:
          </p>
          <div className="bg-[#183b6d]/5 p-6 rounded-sm not-prose mt-4">
            <p className="text-[#575757] mb-2">
              <strong>Email:</strong> <a href="mailto:privacy@wellsai.com" className="text-[#dba63f] hover:text-[#c89430]">privacy@wellsai.com</a>
            </p>
            <p className="text-[#575757] mb-2">
              <strong>General Contact:</strong> <a href="mailto:hello@wellsonyx.com" className="text-[#dba63f] hover:text-[#c89430]">hello@wellsonyx.com</a>
            </p>
            <p className="text-[#575757]">
              <strong>Website:</strong> <a href="https://www.wellsonyx.com" target="_blank" rel="noopener noreferrer" className="text-[#dba63f] hover:text-[#c89430]">www.wellsonyx.com</a>
            </p>
          </div>

          <div className="mt-16 pt-8 border-t border-[#9ea1a7]/20 not-prose">
            <div className="flex gap-4">
              <Link
                href="/legal/terms"
                className="text-[#dba63f] hover:text-[#c89430] font-medium"
              >
                Terms of Service →
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
