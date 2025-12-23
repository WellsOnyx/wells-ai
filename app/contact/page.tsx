'use client'

/**
 * WellsAI Contact Page
 * Contact form, office location, and support info
 */

import { useState } from 'react'
import Link from 'next/link'
import { Mail, MapPin, MessageSquare, Send, Loader2, CheckCircle } from 'lucide-react'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500))

    setIsSubmitted(true)
    setIsSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600&display=swap');
        .font-playfair { font-family: 'Playfair Display', Georgia, serif; }
      `}</style>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-gray-900 dark:text-white font-semibold text-[17px]">
            <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 dark:from-white dark:to-gray-200 rounded-[7px] flex items-center justify-center text-white dark:text-gray-900 text-[13px] font-bold">
              W
            </div>
            WellsAI
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              Home
            </Link>
            <Link
              href="/chat"
              className="px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-16 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
            Enterprise Contact
          </div>
          <h1 className="font-playfair text-[clamp(40px,5vw,56px)] font-medium text-gray-900 dark:text-white mb-6 tracking-tight">
            Let's Talk
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            Ready to transform your procurement? Discuss enterprise pricing and custom integrations.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 dark:bg-gray-950">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Contact Form */}
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Send us a message</h2>

              {isSubmitted ? (
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-8 text-center">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Message Sent!</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Thanks for reaching out. We'll get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => {
                      setIsSubmitted(false)
                      setFormData({ name: '', email: '', company: '', message: '' })
                    }}
                    className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Name
                      </label>
                      <input
                        id="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        placeholder="you@company.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Company (optional)
                    </label>
                    <input
                      id="company"
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      placeholder="Your company"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Message
                    </label>
                    <textarea
                      id="message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                      placeholder="How can we help?"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message
                        <Send className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Contact Info */}
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Get in touch</h2>

              <div className="space-y-6">
                <div className="flex items-start gap-4 p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Email</h3>
                    <a href="mailto:hello@wellsai.io" className="text-blue-600 dark:text-blue-400 hover:underline">
                      hello@wellsai.io
                    </a>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enterprise inquiries within 24 hours</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                  <div className="w-12 h-12 bg-violet-100 dark:bg-violet-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Live Demo</h3>
                    <Link href="/chat" className="text-violet-600 dark:text-violet-400 hover:underline">
                      Deploy Wells now
                    </Link>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">AI agent available 24/7</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Headquarters</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      The ION<br />
                      4201 Main Street<br />
                      Houston, TX 77002
                    </p>
                  </div>
                </div>
              </div>

              {/* Map Placeholder */}
              <div className="mt-8 h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Map coming soon</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ CTA */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="text-2xl font-medium text-gray-900 dark:text-white mb-4">
            Questions about enterprise pricing?
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Explore our success-based pricing model and volume discounts.
          </p>
          <Link
            href="/pricing"
            className="inline-flex px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          >
            View Enterprise Pricing
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-200 dark:border-gray-800 dark:bg-gray-950">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 text-gray-900 dark:text-white font-semibold text-[17px] mb-4">
            <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 dark:from-white dark:to-gray-200 rounded-[7px] flex items-center justify-center text-white dark:text-gray-900 text-[13px] font-bold">
              W
            </div>
            WellsAI
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            © 2025 WellsAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
