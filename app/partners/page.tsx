'use client';

import Link from 'next/link';
import { ArrowRight, Code, DollarSign, TrendingUp, Shield, Zap, Users, CheckCircle } from 'lucide-react';

export default function PartnersLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
            Embed Treasury Infrastructure.
            <br />
            <span className="text-blue-600">Earn 20% Revenue Share.</span>
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            White-label Wells AI's treasury infrastructure and turn your platform into a fintech powerhouse.
            Your users get seamless payments. You get a new revenue stream.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/partners/apply"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2 text-lg"
            >
              Apply Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/partners/docs"
              className="px-8 py-4 border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:border-slate-400 transition text-lg"
            >
              View API Docs
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">$2B+</div>
            <div className="text-slate-600">Treasury Volume</div>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">99.99%</div>
            <div className="text-slate-600">API Uptime</div>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">&lt;100ms</div>
            <div className="text-slate-600">Average Response</div>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="bg-slate-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-4">Why Partner with Wells AI?</h2>
          <p className="text-slate-400 text-center mb-16 text-lg">
            Built for platforms that want to own the financial experience
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-800 p-8 rounded-xl">
              <DollarSign className="w-12 h-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-semibold mb-3">Earn Revenue</h3>
              <p className="text-slate-400">
                Keep 20% of all transaction fees. Scale your revenue as your users transact.
                Higher volume partners negotiate up to 30%.
              </p>
            </div>

            <div className="bg-slate-800 p-8 rounded-xl">
              <Code className="w-12 h-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-semibold mb-3">Simple Integration</h3>
              <p className="text-slate-400">
                RESTful API with comprehensive docs. Go live in days, not months.
                SDKs for JavaScript, Python, and more.
              </p>
            </div>

            <div className="bg-slate-800 p-8 rounded-xl">
              <Shield className="w-12 h-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-semibold mb-3">Enterprise Security</h3>
              <p className="text-slate-400">
                SOC 2 Type II certified. Bank-grade encryption. Full compliance with financial regulations.
              </p>
            </div>

            <div className="bg-slate-800 p-8 rounded-xl">
              <Zap className="w-12 h-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-semibold mb-3">Lightning Fast</h3>
              <p className="text-slate-400">
                Sub-100ms response times. Real-time settlement. Built on modern infrastructure that scales.
              </p>
            </div>

            <div className="bg-slate-800 p-8 rounded-xl">
              <Users className="w-12 h-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-semibold mb-3">White Label</h3>
              <p className="text-slate-400">
                Your brand, our infrastructure. Users never know about Wells. You own the relationship.
              </p>
            </div>

            <div className="bg-slate-800 p-8 rounded-xl">
              <TrendingUp className="w-12 h-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-semibold mb-3">Growth Partner</h3>
              <p className="text-slate-400">
                Dedicated support team. Technical consulting. We succeed when you succeed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-16 text-slate-900">How It Works</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-slate-900">Apply</h3>
              <p className="text-slate-600">
                Submit your application in 5 minutes. Tell us about your platform and use case.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-slate-900">Integrate</h3>
              <p className="text-slate-600">
                Get instant API credentials. Start building with our comprehensive documentation.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-slate-900">Launch</h3>
              <p className="text-slate-600">
                Go live with treasury features embedded directly in your platform.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">4</span>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-slate-900">Earn</h3>
              <p className="text-slate-600">
                Watch revenue grow as your users transact. Monthly payouts via ACH.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Use Cases */}
      <div className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-4 text-slate-900">Perfect For</h2>
          <p className="text-slate-600 text-center mb-16 text-lg">
            Platforms across industries are embedding treasury infrastructure
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              'Marketplaces (escrow, instant payouts)',
              'Accounting Software (AP/AR automation)',
              'HR Platforms (payroll, expense management)',
              'E-commerce (checkout, vendor payments)',
              'CRM Systems (invoice processing)',
              'Project Management (contractor payments)',
            ].map((useCase) => (
              <div key={useCase} className="flex items-center gap-3 bg-white p-4 rounded-lg border border-slate-200">
                <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                <span className="text-slate-700 font-medium">{useCase}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-4 text-slate-900">Ready to Get Started?</h2>
          <p className="text-xl text-slate-600 mb-8">
            Join the platforms building the future of embedded finance
          </p>
          <Link
            href="/partners/apply"
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-lg"
          >
            Apply for Partnership
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-600">
          <p>Questions? Contact partnerships@wellsonyx.com</p>
        </div>
      </div>
    </div>
  );
}
