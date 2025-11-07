import Link from 'next/link';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
            Terms of Service
          </h1>
          <p className="text-lg text-slate-600">
            Last Updated: November 7, 2025
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-slate max-w-none">
          <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200 sm:p-12">
            {/* Introduction */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                1. Agreement to Terms
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                These Terms of Service ("Terms") constitute a legally binding agreement between you and Wells Onyx, LLC ("Wells AI," "Grain & Vault," "we," "us," or "our") governing your access to and use of our platform, including our websites, applications, and services (collectively, the "Services").
              </p>
              <p className="text-slate-700 leading-relaxed">
                By accessing or using our Services, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms, you may not access or use the Services.
              </p>
            </section>

            {/* Services Description */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                2. Description of Services
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                Wells AI provides an integrated platform combining artificial intelligence-powered business automation, procurement services, HR management, and enterprise resource planning capabilities under the Grain & Vault ecosystem. Our Services include but are not limited to:
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700">
                <li>AI-powered conversational interfaces for business operations</li>
                <li>Procurement and supplier management systems</li>
                <li>Human resources and applicant tracking systems</li>
                <li>Go-to-market automation and sales engagement tools</li>
                <li>Partnership and negotiation management platforms</li>
                <li>Transaction processing and financial operations</li>
                <li>Integration with third-party services and APIs</li>
              </ul>
            </section>

            {/* User Accounts */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                3. User Accounts and Registration
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Account Creation:</strong> To access certain features of the Services, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to immediately notify us of any unauthorized use of your account.
              </p>
              <p className="text-slate-700 leading-relaxed">
                <strong>Organization Accounts:</strong> If you create an account on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.
              </p>
            </section>

            {/* User Responsibilities */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                4. User Responsibilities and Conduct
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                You agree to use the Services only for lawful purposes and in accordance with these Terms. You agree not to:
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700">
                <li>Violate any applicable laws, regulations, or third-party rights</li>
                <li>Use the Services in any manner that could damage, disable, or impair our systems</li>
                <li>Attempt to gain unauthorized access to any portion of the Services</li>
                <li>Use automated systems or software to extract data from the Services without authorization</li>
                <li>Interfere with or disrupt the integrity or performance of the Services</li>
                <li>Transmit any viruses, malware, or other malicious code</li>
                <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
                <li>Use the Services to harass, abuse, or harm another person or entity</li>
                <li>Collect or store personal data about other users without their consent</li>
              </ul>
            </section>

            {/* AI Services and Content */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                5. AI Services and Generated Content
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>AI-Generated Content:</strong> Our Services utilize artificial intelligence and machine learning technologies to generate content, recommendations, and insights. You acknowledge that AI-generated content may contain errors, inaccuracies, or biases.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>No Professional Advice:</strong> AI-generated content is provided for informational purposes only and does not constitute professional advice (legal, financial, medical, or otherwise). You should consult with appropriate professionals before making decisions based on AI-generated content.
              </p>
              <p className="text-slate-700 leading-relaxed">
                <strong>User Responsibility:</strong> You are solely responsible for reviewing, verifying, and determining the appropriateness of any AI-generated content before using or relying upon it.
              </p>
            </section>

            {/* Intellectual Property */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                6. Intellectual Property Rights
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Our Property:</strong> The Services, including all content, features, functionality, software, designs, text, graphics, logos, and trademarks, are owned by Wells Onyx, LLC or our licensors and are protected by intellectual property laws.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Your Content:</strong> You retain ownership of any content, data, or information you submit to the Services ("User Content"). By submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, store, process, and display such content as necessary to provide the Services.
              </p>
              <p className="text-slate-700 leading-relaxed">
                <strong>Feedback:</strong> Any feedback, suggestions, or ideas you provide regarding the Services become our property, and we may use them without obligation to you.
              </p>
            </section>

            {/* Payment and Billing */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                7. Payment Terms and Billing
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Fees:</strong> Certain features of the Services require payment of fees. You agree to pay all applicable fees as described at the time of purchase.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Billing:</strong> For subscription services, you authorize us to charge your payment method on a recurring basis until you cancel the subscription. All fees are non-refundable unless otherwise specified.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Price Changes:</strong> We reserve the right to modify our pricing with at least 30 days' notice. Continued use of the Services after a price change constitutes acceptance of the new pricing.
              </p>
              <p className="text-slate-700 leading-relaxed">
                <strong>Taxes:</strong> You are responsible for all applicable taxes associated with your use of the Services.
              </p>
            </section>

            {/* Disclaimers */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                8. Disclaimers and Warranties
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed font-semibold uppercase">
                THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                To the fullest extent permitted by law, we disclaim all warranties, express or implied, including but not limited to:
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700">
                <li>Warranties of merchantability, fitness for a particular purpose, and non-infringement</li>
                <li>Warranties regarding the accuracy, reliability, or completeness of the Services or content</li>
                <li>Warranties that the Services will be uninterrupted, secure, or error-free</li>
                <li>Warranties regarding the results obtained from using the Services</li>
              </ul>
              <p className="mt-4 text-slate-700 leading-relaxed">
                We do not warrant that the Services will meet your requirements or that defects will be corrected. Your use of the Services is at your sole risk.
              </p>
            </section>

            {/* Limitation of Liability */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                9. Limitation of Liability
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed font-semibold uppercase">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WELLS ONYX, LLC, ITS AFFILIATES, DIRECTORS, OFFICERS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                Our total liability to you for all claims arising from or relating to the Services shall not exceed the greater of: (a) the amount you paid us in the 12 months preceding the claim, or (b) $100 USD.
              </p>
              <p className="text-slate-700 leading-relaxed">
                Some jurisdictions do not allow the exclusion or limitation of certain damages, so some of the above limitations may not apply to you.
              </p>
            </section>

            {/* Indemnification */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                10. Indemnification
              </h2>
              <p className="text-slate-700 leading-relaxed">
                You agree to indemnify, defend, and hold harmless Wells Onyx, LLC and its affiliates, officers, directors, employees, agents, and licensors from any claims, liabilities, damages, losses, costs, or expenses (including reasonable attorneys' fees) arising from: (a) your use of the Services, (b) your violation of these Terms, (c) your violation of any rights of another party, or (d) your User Content.
              </p>
            </section>

            {/* Term and Termination */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                11. Term and Termination
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Term:</strong> These Terms remain in effect while you use the Services.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Termination by You:</strong> You may terminate your account at any time by contacting us or using account closure features in the Services.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Termination by Us:</strong> We reserve the right to suspend or terminate your access to the Services at any time, with or without cause, with or without notice, including for violation of these Terms.
              </p>
              <p className="text-slate-700 leading-relaxed">
                <strong>Effect of Termination:</strong> Upon termination, your right to use the Services will immediately cease. We may delete your account and User Content. Sections of these Terms that by their nature should survive termination shall survive, including intellectual property provisions, disclaimers, indemnification, and limitations of liability.
              </p>
            </section>

            {/* Data and Privacy */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                12. Data Collection and Privacy
              </h2>
              <p className="text-slate-700 leading-relaxed">
                Your privacy is important to us. Our collection and use of personal information is governed by our{' '}
                <Link href="/privacy" className="text-slate-900 font-semibold hover:text-slate-700 underline">
                  Privacy Policy
                </Link>
                , which is incorporated into these Terms by reference. By using the Services, you consent to our collection and use of data as described in the Privacy Policy.
              </p>
            </section>

            {/* Third-Party Services */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                13. Third-Party Services and Links
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                The Services may contain links to third-party websites, services, or integrations that are not owned or controlled by us. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party services.
              </p>
              <p className="text-slate-700 leading-relaxed">
                You acknowledge and agree that we shall not be liable for any damage or loss caused by your use of any third-party services. We encourage you to review the terms and privacy policies of any third-party services you access.
              </p>
            </section>

            {/* Dispute Resolution */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                14. Dispute Resolution and Arbitration
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Informal Resolution:</strong> Before filing a claim, you agree to contact us at legal@wellsonyx.com to attempt to resolve the dispute informally.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Binding Arbitration:</strong> If we cannot resolve the dispute informally, any dispute arising from or relating to these Terms or the Services shall be resolved through binding arbitration in accordance with the American Arbitration Association's Commercial Arbitration Rules.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Class Action Waiver:</strong> You agree that any arbitration or proceeding shall be limited to the dispute between you and us individually. To the fullest extent permitted by law, you waive any right to participate in a class action lawsuit or class-wide arbitration.
              </p>
              <p className="text-slate-700 leading-relaxed">
                <strong>Exceptions:</strong> Either party may seek injunctive or other equitable relief in a court of competent jurisdiction to prevent actual or threatened infringement of intellectual property rights.
              </p>
            </section>

            {/* Governing Law */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                15. Governing Law and Jurisdiction
              </h2>
              <p className="text-slate-700 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the State of Florida, United States, without regard to its conflict of law provisions. Any legal action or proceeding arising under these Terms shall be brought exclusively in the federal or state courts located in Florida, and you consent to personal jurisdiction in such courts.
              </p>
            </section>

            {/* Changes to Terms */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                16. Changes to Terms
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on our website and updating the "Last Updated" date. Your continued use of the Services after such changes constitutes acceptance of the modified Terms.
              </p>
              <p className="text-slate-700 leading-relaxed">
                If you do not agree to the modified Terms, you must stop using the Services and may terminate your account.
              </p>
            </section>

            {/* General Provisions */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                17. General Provisions
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Entire Agreement:</strong> These Terms, together with our Privacy Policy, constitute the entire agreement between you and us regarding the Services.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Severability:</strong> If any provision of these Terms is held to be invalid or unenforceable, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Waiver:</strong> Our failure to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                <strong>Assignment:</strong> You may not assign or transfer these Terms or your rights under these Terms without our prior written consent. We may assign these Terms without restriction.
              </p>
              <p className="text-slate-700 leading-relaxed">
                <strong>Force Majeure:</strong> We shall not be liable for any failure or delay in performance due to circumstances beyond our reasonable control.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                18. Contact Information
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="rounded-lg bg-slate-50 p-6 text-slate-700">
                <p className="font-semibold">Wells Onyx, LLC</p>
                <p>Email: legal@wellsonyx.com</p>
                <p>Website: https://wellsonyx.com</p>
              </div>
            </section>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center text-slate-600 hover:text-slate-900 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
