import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
            Privacy Policy
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
                1. Introduction
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                Wells Onyx, LLC ("Wells AI," "Grain & Vault," "we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform, websites, applications, and services (collectively, the "Services").
              </p>
              <p className="mb-4 text-slate-700 leading-relaxed">
                By accessing or using our Services, you acknowledge that you have read, understood, and agree to the collection, use, and disclosure of your information as described in this Privacy Policy.
              </p>
              <p className="text-slate-700 leading-relaxed">
                If you do not agree with this Privacy Policy, please do not access or use the Services.
              </p>
            </section>

            {/* Information We Collect */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                2. Information We Collect
              </h2>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                2.1 Information You Provide to Us
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We collect information that you voluntarily provide when using our Services:
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-6">
                <li><strong>Account Information:</strong> Name, email address, phone number, company name, job title, and password</li>
                <li><strong>Profile Information:</strong> Biographical information, professional details, preferences, and settings</li>
                <li><strong>Business Information:</strong> Company details, organizational structure, team member information</li>
                <li><strong>Communication Data:</strong> Messages, chat transcripts, emails, and other communications with our AI systems or support team</li>
                <li><strong>Payment Information:</strong> Billing address, payment method details (processed securely through third-party payment processors)</li>
                <li><strong>User Content:</strong> Documents, files, data, and other content you upload or submit to the Services</li>
                <li><strong>Feedback and Surveys:</strong> Responses to surveys, feedback forms, and customer support inquiries</li>
              </ul>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                2.2 Information Collected Automatically
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                When you access or use our Services, we automatically collect certain information:
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-6">
                <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers, and device settings</li>
                <li><strong>Usage Information:</strong> Pages viewed, features used, time spent on pages, links clicked, and navigation paths</li>
                <li><strong>Log Data:</strong> Access times, error logs, and other system activity</li>
                <li><strong>Location Data:</strong> General geographic location derived from IP address</li>
                <li><strong>Cookies and Tracking Technologies:</strong> Information collected through cookies, web beacons, and similar technologies (see Section 8)</li>
              </ul>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                2.3 Information from Third Parties
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We may receive information about you from third-party sources:
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700">
                <li><strong>Authentication Services:</strong> Information from Clerk, Google, or other authentication providers</li>
                <li><strong>Integration Partners:</strong> Data from integrated services such as Notion, Slack, Twilio, and other platforms you connect</li>
                <li><strong>Business Partners:</strong> Information from partners, resellers, and affiliates</li>
                <li><strong>Public Sources:</strong> Publicly available information from business databases and directories</li>
              </ul>
            </section>

            {/* How We Use Information */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                3. How We Use Your Information
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We use the information we collect for the following purposes:
              </p>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                3.1 Providing and Improving Services
              </h3>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-6">
                <li>Operate, maintain, and deliver the Services</li>
                <li>Process transactions and send transaction notifications</li>
                <li>Provide customer support and respond to inquiries</li>
                <li>Develop, test, and improve our Services and AI models</li>
                <li>Personalize your experience and deliver relevant content</li>
                <li>Analyze usage patterns and optimize performance</li>
              </ul>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                3.2 AI Training and Development
              </h3>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-6">
                <li>Train and improve our artificial intelligence and machine learning models</li>
                <li>Enhance natural language processing capabilities</li>
                <li>Develop new AI-powered features and functionalities</li>
                <li>Generate insights and recommendations</li>
              </ul>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                3.3 Communications
              </h3>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-6">
                <li>Send administrative messages, updates, and security alerts</li>
                <li>Respond to your requests and communications</li>
                <li>Send marketing communications (with your consent)</li>
                <li>Conduct surveys and request feedback</li>
              </ul>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                3.4 Security and Compliance
              </h3>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-6">
                <li>Protect against fraud, unauthorized access, and security threats</li>
                <li>Comply with legal obligations and enforce our Terms of Service</li>
                <li>Investigate and prevent prohibited or illegal activities</li>
                <li>Maintain data security and system integrity</li>
              </ul>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                3.5 Analytics and Research
              </h3>
              <ul className="ml-6 list-disc space-y-2 text-slate-700">
                <li>Conduct research and analytics to understand user behavior</li>
                <li>Generate aggregated, de-identified statistics and insights</li>
                <li>Measure the effectiveness of our Services and marketing campaigns</li>
              </ul>
            </section>

            {/* How We Share Information */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                4. How We Share Your Information
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We may share your information in the following circumstances:
              </p>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                4.1 Service Providers
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We share information with third-party service providers who perform services on our behalf, including:
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-6">
                <li>Cloud hosting and infrastructure providers (Vercel, AWS, etc.)</li>
                <li>Payment processors (Stripe, etc.)</li>
                <li>Communication services (Twilio, Resend, etc.)</li>
                <li>Analytics providers (Vercel Analytics, etc.)</li>
                <li>Authentication services (Clerk, etc.)</li>
                <li>AI and machine learning providers (Anthropic, OpenAI, etc.)</li>
              </ul>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                4.2 Business Transfers
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We may share or transfer information in connection with a merger, acquisition, reorganization, sale of assets, or bankruptcy.
              </p>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                4.3 Legal Requirements
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We may disclose information when required by law or to:
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-6">
                <li>Comply with legal processes, court orders, or government requests</li>
                <li>Enforce our Terms of Service or other agreements</li>
                <li>Protect our rights, property, or safety, or that of our users or the public</li>
                <li>Detect, prevent, or address fraud, security, or technical issues</li>
              </ul>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                4.4 With Your Consent
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We may share information with third parties when you explicitly consent to such sharing, such as when you connect third-party integrations.
              </p>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                4.5 Aggregated and De-identified Data
              </h3>
              <p className="text-slate-700 leading-relaxed">
                We may share aggregated, anonymized, or de-identified information that cannot reasonably be used to identify you.
              </p>
            </section>

            {/* Data Retention */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                5. Data Retention
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We retain your information for as long as necessary to provide the Services, comply with legal obligations, resolve disputes, and enforce our agreements. Retention periods vary based on:
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-4">
                <li>The type of information collected</li>
                <li>The purpose for which it was collected</li>
                <li>Legal, regulatory, or operational requirements</li>
                <li>Your account status and activity</li>
              </ul>
              <p className="text-slate-700 leading-relaxed">
                When information is no longer necessary, we will securely delete or anonymize it. Some information may be retained in backup systems for a limited period for disaster recovery purposes.
              </p>
            </section>

            {/* Data Security */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                6. Data Security
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We implement reasonable administrative, technical, and physical security measures to protect your information from unauthorized access, disclosure, alteration, and destruction. These measures include:
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication and access controls</li>
                <li>Regular security assessments and monitoring</li>
                <li>Employee training on data protection practices</li>
                <li>Incident response and breach notification procedures</li>
              </ul>
              <p className="text-slate-700 leading-relaxed">
                However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee its absolute security. You are responsible for maintaining the confidentiality of your account credentials.
              </p>
            </section>

            {/* Your Rights */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                7. Your Rights and Choices
              </h2>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                7.1 Access and Portability
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                You have the right to request access to the personal information we hold about you and receive a copy of your data in a portable format.
              </p>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                7.2 Correction and Updating
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                You can update your account information at any time through your account settings. You may also request that we correct inaccurate or incomplete information.
              </p>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                7.3 Deletion
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                You have the right to request deletion of your personal information, subject to certain exceptions (e.g., legal obligations, fraud prevention, security purposes). You can delete your account through account settings or by contacting us.
              </p>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                7.4 Opt-Out of Marketing
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                You can opt out of receiving marketing communications by clicking the "unsubscribe" link in our emails or adjusting your communication preferences in your account settings. Note that you cannot opt out of essential service-related communications.
              </p>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                7.5 Cookie Preferences
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                You can manage cookie preferences through your browser settings. Note that disabling certain cookies may limit functionality.
              </p>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                7.6 Do Not Track
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                Some browsers support "Do Not Track" signals. We currently do not respond to Do Not Track signals, as there is no industry standard for how to interpret them.
              </p>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                7.7 Exercising Your Rights
              </h3>
              <p className="text-slate-700 leading-relaxed">
                To exercise any of these rights, please contact us at privacy@wellsonyx.com. We will respond to your request within a reasonable timeframe as required by applicable law.
              </p>
            </section>

            {/* Cookies */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                8. Cookies and Tracking Technologies
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We use cookies and similar tracking technologies to collect and track information about your use of the Services. Types of technologies we use include:
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-4">
                <li><strong>Essential Cookies:</strong> Necessary for the Services to function properly (e.g., authentication, security)</li>
                <li><strong>Functional Cookies:</strong> Enable enhanced functionality and personalization (e.g., preferences, settings)</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how users interact with the Services (e.g., Vercel Analytics)</li>
                <li><strong>Advertising Cookies:</strong> Used to deliver relevant advertisements (if applicable)</li>
              </ul>
              <p className="text-slate-700 leading-relaxed">
                You can control cookies through your browser settings. However, disabling cookies may affect your ability to use certain features of the Services.
              </p>
            </section>

            {/* Third-Party Links */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                9. Third-Party Services and Links
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                Our Services may contain links to third-party websites, services, or integrations. We are not responsible for the privacy practices or content of these third parties. We encourage you to review the privacy policies of any third-party services you access.
              </p>
              <p className="text-slate-700 leading-relaxed">
                When you connect third-party integrations (e.g., Notion, Slack), those services may have access to certain information as necessary to provide the integration. Please review their privacy policies to understand how they handle your data.
              </p>
            </section>

            {/* Children's Privacy */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                10. Children's Privacy
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                Our Services are not intended for children under the age of 18. We do not knowingly collect personal information from children under 18. If we become aware that we have collected personal information from a child under 18, we will take steps to delete such information.
              </p>
              <p className="text-slate-700 leading-relaxed">
                If you believe we have collected information from a child under 18, please contact us at privacy@wellsonyx.com.
              </p>
            </section>

            {/* International Data Transfers */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                11. International Data Transfers
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                Your information may be transferred to and processed in countries other than your country of residence, including the United States. These countries may have data protection laws that differ from those in your country.
              </p>
              <p className="text-slate-700 leading-relaxed">
                When we transfer information internationally, we implement appropriate safeguards to protect your information in accordance with this Privacy Policy and applicable data protection laws.
              </p>
            </section>

            {/* GDPR Rights */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                12. Additional Rights for European Users (GDPR)
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, you have additional rights under the General Data Protection Regulation (GDPR):
              </p>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                12.1 Legal Basis for Processing
              </h3>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We process your personal data based on the following legal grounds:
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-6">
                <li><strong>Contractual Necessity:</strong> To provide the Services you've requested</li>
                <li><strong>Legitimate Interests:</strong> To improve our Services, prevent fraud, and ensure security</li>
                <li><strong>Consent:</strong> When you've given explicit consent (e.g., marketing communications)</li>
                <li><strong>Legal Obligations:</strong> To comply with applicable laws and regulations</li>
              </ul>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                12.2 Additional Rights
              </h3>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-6">
                <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
                <li><strong>Right to Restrict Processing:</strong> Request restriction of processing in certain circumstances</li>
                <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time (without affecting prior processing)</li>
                <li><strong>Right to Lodge a Complaint:</strong> File a complaint with your local data protection authority</li>
              </ul>

              <h3 className="mb-3 text-xl font-semibold text-slate-900">
                12.3 Data Protection Officer
              </h3>
              <p className="text-slate-700 leading-relaxed">
                For GDPR-related inquiries, you may contact our Data Protection Officer at privacy@wellsonyx.com.
              </p>
            </section>

            {/* CCPA Rights */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                13. Additional Rights for California Users (CCPA)
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                If you are a California resident, you have specific rights under the California Consumer Privacy Act (CCPA):
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-4">
                <li><strong>Right to Know:</strong> Request information about the categories and specific pieces of personal information we collect, use, and disclose</li>
                <li><strong>Right to Delete:</strong> Request deletion of your personal information</li>
                <li><strong>Right to Opt-Out:</strong> Opt out of the "sale" of personal information (Note: We do not sell personal information)</li>
                <li><strong>Right to Non-Discrimination:</strong> You will not be discriminated against for exercising your CCPA rights</li>
              </ul>
              <p className="text-slate-700 leading-relaxed">
                To exercise these rights, contact us at privacy@wellsonyx.com or call us at the number provided on our website. We will verify your identity before processing your request.
              </p>
            </section>

            {/* Changes to Policy */}
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                14. Changes to This Privacy Policy
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of material changes by:
              </p>
              <ul className="ml-6 list-disc space-y-2 text-slate-700 mb-4">
                <li>Posting the updated Privacy Policy on our website</li>
                <li>Updating the "Last Updated" date at the top of this policy</li>
                <li>Sending you an email notification (for material changes)</li>
              </ul>
              <p className="text-slate-700 leading-relaxed">
                Your continued use of the Services after such changes constitutes acceptance of the updated Privacy Policy. We encourage you to review this Privacy Policy periodically.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                15. Contact Us
              </h2>
              <p className="mb-4 text-slate-700 leading-relaxed">
                If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="rounded-lg bg-slate-50 p-6 text-slate-700">
                <p className="font-semibold mb-2">Wells Onyx, LLC</p>
                <p className="mb-1">Email: privacy@wellsonyx.com</p>
                <p className="mb-1">Legal Inquiries: legal@wellsonyx.com</p>
                <p>Website: https://wellsonyx.com</p>
              </div>
            </section>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-12 flex justify-center gap-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center text-slate-600 hover:text-slate-900 transition-colors"
          >
            ← Back to Home
          </Link>
          <Link
            href="/terms"
            className="inline-flex items-center text-slate-600 hover:text-slate-900 transition-colors"
          >
            View Terms of Service →
          </Link>
        </div>
      </div>
    </div>
  );
}
