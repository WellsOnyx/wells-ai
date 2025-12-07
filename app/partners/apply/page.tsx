'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Check, Copy, CheckCircle } from 'lucide-react';
import { storeApiKey } from '@/lib/partners/auth';

export default function PartnerApplicationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [credentials, setCredentials] = useState<{ api_key: string; webhook_secret: string } | null>(null);
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({});

  const [formData, setFormData] = useState({
    // Step 1: Company Info
    company_name: '',
    platform_name: '',
    domain: '',
    industry: '',

    // Step 2: Contact Info
    contact_name: '',
    contact_email: '',
    contact_phone: '',

    // Step 3: Platform Details
    estimated_monthly_volume: '',
    estimated_monthly_transactions: '',
    use_case: '',
    current_payment_provider: '',

    // Step 4: Revenue Share
    revenue_share_percent: 20,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      revenue_share_percent: parseInt(e.target.value, 10),
    });
  };

  const handleNext = () => {
    setError('');
    setStep(step + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/partners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create partner');
      }

      setCredentials({
        api_key: data.partner.api_key,
        webhook_secret: data.partner.webhook_secret,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [key]: true });
    setTimeout(() => {
      setCopied({ ...copied, [key]: false });
    }, 2000);
  };

  const handleGoToDashboard = () => {
    if (credentials) {
      storeApiKey(credentials.api_key);
      router.push('/partners/dashboard');
    }
  };

  if (success && credentials) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Application Approved!</h1>
            <p className="text-slate-600">
              Your partner account has been created. Save your credentials below.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800 font-medium">
              Important: These credentials will only be shown once. Store them securely.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">API Key</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={credentials.api_key}
                  readOnly
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(credentials.api_key, 'api_key')}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {copied.api_key ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Webhook Secret</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={credentials.webhook_secret}
                  readOnly
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(credentials.webhook_secret, 'webhook_secret')}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {copied.webhook_secret ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <button
              onClick={handleGoToDashboard}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Go to Dashboard
            </button>
            <a
              href="/partners/docs"
              className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:border-slate-400 transition text-center"
            >
              View API Docs
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Partner Application</h1>
          <p className="text-slate-600">Step {step} of 4</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {['Company', 'Contact', 'Platform', 'Revenue'].map((label, idx) => (
              <div
                key={label}
                className={`text-sm font-medium ${
                  idx + 1 <= step ? 'text-blue-600' : 'text-slate-400'
                }`}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
          <form onSubmit={handleSubmit}>
            {/* Step 1: Company Info */}
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Company Information</h2>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Acme Inc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Platform Name *
                  </label>
                  <input
                    type="text"
                    name="platform_name"
                    value={formData.platform_name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="AcmePay"
                  />
                  <p className="mt-1 text-sm text-slate-500">The name users see in your product</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Domain *</label>
                  <input
                    type="text"
                    name="domain"
                    value={formData.domain}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="acme.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Industry *</label>
                  <select
                    name="industry"
                    value={formData.industry}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Industry</option>
                    <option value="marketplace">Marketplace</option>
                    <option value="accounting">Accounting Software</option>
                    <option value="hr">HR/Payroll</option>
                    <option value="ecommerce">E-commerce</option>
                    <option value="crm">CRM</option>
                    <option value="project_management">Project Management</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Contact Info */}
            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Contact Information</h2>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    name="contact_name"
                    value={formData.contact_name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Smith"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                  <input
                    type="email"
                    name="contact_email"
                    value={formData.contact_email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="john@acme.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone *</label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Platform Details */}
            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Platform Details</h2>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Estimated Monthly Volume (USD) *
                  </label>
                  <select
                    name="estimated_monthly_volume"
                    value={formData.estimated_monthly_volume}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Range</option>
                    <option value="0-100k">$0 - $100K</option>
                    <option value="100k-500k">$100K - $500K</option>
                    <option value="500k-1m">$500K - $1M</option>
                    <option value="1m-5m">$1M - $5M</option>
                    <option value="5m-10m">$5M - $10M</option>
                    <option value="10m+">$10M+</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Estimated Monthly Transactions *
                  </label>
                  <select
                    name="estimated_monthly_transactions"
                    value={formData.estimated_monthly_transactions}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Range</option>
                    <option value="0-100">0 - 100</option>
                    <option value="100-1000">100 - 1,000</option>
                    <option value="1000-10000">1,000 - 10,000</option>
                    <option value="10000-100000">10,000 - 100,000</option>
                    <option value="100000+">100,000+</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Use Case *</label>
                  <textarea
                    name="use_case"
                    value={formData.use_case}
                    onChange={handleChange}
                    required
                    rows={4}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe how you'll use Wells treasury infrastructure..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Current Payment Provider
                  </label>
                  <input
                    type="text"
                    name="current_payment_provider"
                    value={formData.current_payment_provider}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Stripe, Plaid, etc. (optional)"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Revenue Share */}
            {step === 4 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Revenue Share</h2>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-4">
                    Your Revenue Share: {formData.revenue_share_percent}%
                  </label>
                  <input
                    type="range"
                    name="revenue_share_percent"
                    min="15"
                    max="30"
                    step="1"
                    value={formData.revenue_share_percent}
                    onChange={handleSliderChange}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #2563eb 0%, #2563eb ${
                        ((formData.revenue_share_percent - 15) / 15) * 100
                      }%, #e2e8f0 ${((formData.revenue_share_percent - 15) / 15) * 100}%, #e2e8f0 100%)`,
                    }}
                  />
                  <div className="flex justify-between text-sm text-slate-500 mt-2">
                    <span>15%</span>
                    <span>30%</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="font-semibold text-slate-900 mb-3">Revenue Breakdown</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Wells Fee (1% of transaction)</span>
                      <span className="font-medium">$10.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Your Share ({formData.revenue_share_percent}%)</span>
                      <span className="font-medium text-green-600">
                        ${(10 * (formData.revenue_share_percent / 100)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Wells Net</span>
                      <span className="font-medium">
                        ${(10 * (1 - formData.revenue_share_percent / 100)).toFixed(2)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-blue-200 text-xs text-slate-500">
                      Example based on $1,000 transaction
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-600">
                  Standard rate is 20%. Higher volume partners can negotiate up to 30%. Final rate is
                  subject to approval based on expected volume.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex gap-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:border-slate-400 transition flex items-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  Next
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
