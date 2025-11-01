import Link from 'next/link'

export default function SecurityPage() {
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
              <div className="text-[10px] text-[#575757] tracking-[0.15em] uppercase">Security</div>
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

      {/* Hero Section */}
      <section className="py-24 px-6 bg-[#183b6d]/5">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl md:text-7xl font-serif text-[#183b6d] mb-6">
            Security
          </h1>
          <p className="text-xl text-[#575757] leading-relaxed">
            Trust is our foundation. Security is our commitment.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto prose prose-lg">
          <div className="bg-[#183b6d]/5 border-2 border-[#9ea1a7]/20 rounded-sm p-6 mb-12 not-prose">
            <p className="text-[#575757]">
              Wells AI handles sensitive business data and facilitates enterprise transactions. We take our security
              responsibilities seriously and implement industry-leading practices to protect your information.
            </p>
          </div>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">Data Encryption</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">Encryption in Transit</h3>
          <p className="text-[#575757]">
            All data transmitted to and from Wells AI is encrypted using:
          </p>
          <ul className="text-[#575757]">
            <li><strong>TLS 1.3:</strong> Industry-standard encryption protocol for all HTTPS connections</li>
            <li><strong>Perfect Forward Secrecy:</strong> Each session uses unique encryption keys</li>
            <li><strong>Certificate Pinning:</strong> Protection against man-in-the-middle attacks</li>
          </ul>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">Encryption at Rest</h3>
          <p className="text-[#575757]">
            All stored data is encrypted using:
          </p>
          <ul className="text-[#575757]">
            <li><strong>AES-256:</strong> Military-grade encryption for all database records</li>
            <li><strong>Encrypted Backups:</strong> All backups are encrypted before storage</li>
            <li><strong>Secure Key Management:</strong> Encryption keys stored in dedicated key management systems</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">Infrastructure Security</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">Cloud Infrastructure</h3>
          <p className="text-[#575757]">
            Our platform is hosted on Vercel, which provides:
          </p>
          <ul className="text-[#575757]">
            <li><strong>SOC 2 Type II Certified:</strong> Independently audited security controls</li>
            <li><strong>Global CDN:</strong> DDoS protection and edge caching</li>
            <li><strong>Automated Scaling:</strong> Protection against availability threats</li>
            <li><strong>Zero-Downtime Deployments:</strong> Continuous availability</li>
          </ul>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">Database Security</h3>
          <p className="text-[#575757]">
            Our databases are protected through:
          </p>
          <ul className="text-[#575757]">
            <li><strong>Private Networks:</strong> Databases not exposed to public internet</li>
            <li><strong>IP Allowlisting:</strong> Only authorized services can access databases</li>
            <li><strong>Automated Backups:</strong> Daily encrypted backups with 30-day retention</li>
            <li><strong>Point-in-Time Recovery:</strong> Ability to restore to any point in time</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">Access Control</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">Authentication</h3>
          <p className="text-[#575757]">
            User authentication is managed by Clerk, providing:
          </p>
          <ul className="text-[#575757]">
            <li><strong>Multi-Factor Authentication (MFA):</strong> Optional 2FA for enhanced security</li>
            <li><strong>SSO Support:</strong> Integration with enterprise identity providers</li>
            <li><strong>Passwordless Login:</strong> Magic links and social authentication</li>
            <li><strong>Session Management:</strong> Automatic session expiration and refresh</li>
          </ul>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">Authorization</h3>
          <p className="text-[#575757]">
            Access to resources is controlled through:
          </p>
          <ul className="text-[#575757]">
            <li><strong>Role-Based Access Control (RBAC):</strong> Granular permissions per role</li>
            <li><strong>Organization Isolation:</strong> Complete data separation between organizations</li>
            <li><strong>API Key Management:</strong> Secure generation and rotation of API keys</li>
            <li><strong>Audit Logs:</strong> Complete tracking of all access and changes</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">Application Security</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">Code Security</h3>
          <p className="text-[#575757]">
            Our development practices include:
          </p>
          <ul className="text-[#575757]">
            <li><strong>Security Code Reviews:</strong> All code reviewed before deployment</li>
            <li><strong>Dependency Scanning:</strong> Automated scanning for vulnerable dependencies</li>
            <li><strong>Static Analysis:</strong> Automated detection of security issues in code</li>
            <li><strong>Secret Scanning:</strong> Prevention of secrets in source code</li>
          </ul>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">Vulnerability Management</h3>
          <p className="text-[#575757]">
            We proactively identify and remediate vulnerabilities:
          </p>
          <ul className="text-[#575757]">
            <li><strong>Regular Penetration Testing:</strong> Quarterly security assessments</li>
            <li><strong>Bug Bounty Program:</strong> Rewarding security researchers (coming Q1 2026)</li>
            <li><strong>Automated Scanning:</strong> Continuous monitoring for known vulnerabilities</li>
            <li><strong>Rapid Patching:</strong> Critical vulnerabilities patched within 24 hours</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">Payment Security</h2>
          <p className="text-[#575757]">
            All payment processing is handled by Stripe:
          </p>
          <ul className="text-[#575757]">
            <li><strong>PCI DSS Level 1:</strong> Highest level of payment security certification</li>
            <li><strong>No Card Storage:</strong> We never store credit card information</li>
            <li><strong>Tokenization:</strong> Secure token-based payment processing</li>
            <li><strong>Fraud Detection:</strong> Advanced ML-based fraud prevention</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">AI & Data Security</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">Claude (Anthropic)</h3>
          <p className="text-[#575757]">
            Our AI features use Anthropic's Claude:
          </p>
          <ul className="text-[#575757]">
            <li><strong>Zero Retention:</strong> Anthropic does not train on your data</li>
            <li><strong>SOC 2 Type II:</strong> Independently audited AI infrastructure</li>
            <li><strong>Encrypted Processing:</strong> All AI processing encrypted end-to-end</li>
            <li><strong>Data Isolation:</strong> Your prompts and data never shared with other users</li>
          </ul>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">Vector Database</h3>
          <p className="text-[#575757]">
            Document embeddings and semantic search:
          </p>
          <ul className="text-[#575757]">
            <li><strong>Encrypted Storage:</strong> All vectors encrypted at rest</li>
            <li><strong>Access Controls:</strong> Per-organization vector isolation</li>
            <li><strong>Secure Embeddings:</strong> No personal data in embedding model training</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">Monitoring & Incident Response</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">24/7 Monitoring</h3>
          <p className="text-[#575757]">
            Our systems are continuously monitored:
          </p>
          <ul className="text-[#575757]">
            <li><strong>Real-Time Alerts:</strong> Immediate notification of security events</li>
            <li><strong>Anomaly Detection:</strong> ML-based detection of unusual activity</li>
            <li><strong>Performance Monitoring:</strong> Tracking for availability and performance</li>
            <li><strong>Error Tracking:</strong> Comprehensive error logging and analysis (Sentry)</li>
          </ul>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">Incident Response</h3>
          <p className="text-[#575757]">
            We have established procedures for security incidents:
          </p>
          <ul className="text-[#575757]">
            <li><strong>Incident Response Team:</strong> Dedicated team available 24/7</li>
            <li><strong>Response Plan:</strong> Documented procedures for all incident types</li>
            <li><strong>User Notification:</strong> Prompt notification if your data is affected</li>
            <li><strong>Post-Incident Review:</strong> Analysis and improvements after each incident</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">Compliance & Certifications</h2>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">Current Compliance</h3>
          <ul className="text-[#575757]">
            <li><strong>GDPR:</strong> Compliant with EU data protection regulations</li>
            <li><strong>CCPA:</strong> Compliant with California privacy laws</li>
            <li><strong>Infrastructure SOC 2:</strong> Via Vercel, Clerk, Anthropic, and Stripe</li>
          </ul>

          <h3 className="text-2xl font-serif text-[#183b6d] mt-8">Upcoming Certifications (2026)</h3>
          <ul className="text-[#575757]">
            <li><strong>SOC 2 Type II:</strong> Independent audit scheduled for Q2 2026</li>
            <li><strong>ISO 27001:</strong> Information security management certification</li>
            <li><strong>HIPAA:</strong> For healthcare-related transactions (if applicable)</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">Employee Security</h2>
          <p className="text-[#575757]">
            Our team follows strict security practices:
          </p>
          <ul className="text-[#575757]">
            <li><strong>Background Checks:</strong> All employees undergo background verification</li>
            <li><strong>Security Training:</strong> Regular security awareness training</li>
            <li><strong>Least Privilege:</strong> Employees have minimum necessary access</li>
            <li><strong>Device Security:</strong> Encrypted devices with security software</li>
            <li><strong>Confidentiality Agreements:</strong> Legal obligations to protect data</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">Third-Party Security</h2>
          <p className="text-[#575757]">
            All third-party services are carefully vetted:
          </p>
          <ul className="text-[#575757]">
            <li><strong>Vendor Assessment:</strong> Security review before integration</li>
            <li><strong>Data Processing Agreements:</strong> Legal protections for data shared</li>
            <li><strong>Regular Reviews:</strong> Ongoing assessment of vendor security</li>
            <li><strong>Minimal Data Sharing:</strong> Only necessary data shared with vendors</li>
          </ul>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">Responsible Disclosure</h2>
          <p className="text-[#575757]">
            If you discover a security vulnerability, we encourage responsible disclosure:
          </p>
          <div className="bg-[#183b6d]/5 p-6 rounded-sm not-prose mt-4">
            <p className="text-[#575757] mb-4">
              <strong>Security Contact:</strong> <a href="mailto:security@wellsai.com" className="text-[#dba63f] hover:text-[#c89430]">security@wellsai.com</a>
            </p>
            <p className="text-[#575757] text-sm mb-2">Please include:</p>
            <ul className="text-[#575757] text-sm space-y-1 ml-4">
              <li>• Description of the vulnerability</li>
              <li>• Steps to reproduce</li>
              <li>• Potential impact</li>
              <li>• Your contact information</li>
            </ul>
            <p className="text-[#575757] text-sm mt-4">
              We commit to acknowledging receipt within 24 hours and providing regular updates on our investigation.
            </p>
          </div>

          <h2 className="text-3xl font-serif text-[#183b6d] mt-12">Questions?</h2>
          <p className="text-[#575757]">
            For security questions or concerns, contact us at:
          </p>
          <div className="bg-[#183b6d]/5 p-6 rounded-sm not-prose mt-4">
            <p className="text-[#575757] mb-2">
              <strong>Security Team:</strong> <a href="mailto:security@wellsai.com" className="text-[#dba63f] hover:text-[#c89430]">security@wellsai.com</a>
            </p>
            <p className="text-[#575757] mb-2">
              <strong>General Contact:</strong> <a href="mailto:hello@wellsai.com" className="text-[#dba63f] hover:text-[#c89430]">hello@wellsai.com</a>
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
                href="/legal/privacy"
                className="text-[#dba63f] hover:text-[#c89430] font-medium"
              >
                Privacy Policy →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
