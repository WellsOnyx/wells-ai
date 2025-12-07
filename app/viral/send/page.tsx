'use client';

import { useState } from 'react';
import { useSendPayment, useFormatCurrency, useCopyToClipboard } from '@/lib/viral/hooks';

export default function SendViralPaymentPage() {
  const { sendPayment, loading, error } = useSendPayment();
  const { formatUSD, formatUSDC } = useFormatCurrency();
  const { copy, copied } = useCopyToClipboard();

  const [step, setStep] = useState<'form' | 'preview' | 'success'>('form');
  const [currency, setCurrency] = useState<'USD' | 'USDC'>('USD');

  // Form state
  const [formData, setFormData] = useState({
    sender_id: 'user_demo_123', // TODO: Get from auth context
    recipient_email: '',
    recipient_phone: '',
    recipient_company: '',
    amount: '',
    memo: '',
    invoice_id: '',
  });

  // Success state
  const [paymentResult, setPaymentResult] = useState<any>(null);

  const amount = parseFloat(formData.amount) || 0;
  const wellsFee = amount * 0.01;
  const referrerBonus = amount * 0.001;
  const totalAmount = amount + wellsFee;

  const hasRecipient =
    formData.recipient_email || formData.recipient_phone || formData.recipient_company;

  const canPreview = hasRecipient && amount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'form') {
      setStep('preview');
    } else if (step === 'preview') {
      const result = await sendPayment({
        sender_id: formData.sender_id,
        recipient_email: formData.recipient_email || undefined,
        recipient_phone: formData.recipient_phone || undefined,
        recipient_company: formData.recipient_company || undefined,
        amount,
        memo: formData.memo || undefined,
        invoice_id: formData.invoice_id || undefined,
      });

      if (result.success) {
        setPaymentResult(result);
        setStep('success');
      }
    }
  };

  const handleReset = () => {
    setStep('form');
    setFormData({
      sender_id: formData.sender_id,
      recipient_email: '',
      recipient_phone: '',
      recipient_company: '',
      amount: '',
      memo: '',
      invoice_id: '',
    });
    setPaymentResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Send Viral Payment
          </h1>
          <p className="text-gray-400 text-lg">
            Pay anyone, anywhere. They get a wallet automatically.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  step === 'form'
                    ? 'bg-blue-500 text-white'
                    : 'bg-green-500 text-white'
                }`}
              >
                {step === 'form' ? '1' : '✓'}
              </div>
              <span className="ml-2 text-sm font-medium">Details</span>
            </div>
            <div className="flex-1 h-1 mx-4 bg-gray-700">
              <div
                className={`h-full transition-all duration-300 ${
                  step === 'preview' || step === 'success'
                    ? 'bg-blue-500 w-full'
                    : 'bg-gray-700 w-0'
                }`}
              />
            </div>
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  step === 'preview'
                    ? 'bg-blue-500 text-white'
                    : step === 'success'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {step === 'success' ? '✓' : '2'}
              </div>
              <span className="ml-2 text-sm font-medium">Preview</span>
            </div>
            <div className="flex-1 h-1 mx-4 bg-gray-700">
              <div
                className={`h-full transition-all duration-300 ${
                  step === 'success' ? 'bg-blue-500 w-full' : 'bg-gray-700 w-0'
                }`}
              />
            </div>
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  step === 'success' ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
                }`}
              >
                {step === 'success' ? '✓' : '3'}
              </div>
              <span className="ml-2 text-sm font-medium">Success</span>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Form Step */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            {/* Recipient Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Send To</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.recipient_email}
                    onChange={(e) =>
                      setFormData({ ...formData, recipient_email: e.target.value })
                    }
                    placeholder="recipient@example.com"
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-gray-500"
                  />
                </div>

                <div className="flex items-center">
                  <div className="flex-1 h-px bg-gray-700" />
                  <span className="px-4 text-gray-500 text-sm">OR</span>
                  <div className="flex-1 h-px bg-gray-700" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.recipient_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, recipient_phone: e.target.value })
                    }
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-gray-500"
                  />
                </div>

                <div className="flex items-center">
                  <div className="flex-1 h-px bg-gray-700" />
                  <span className="px-4 text-gray-500 text-sm">OR</span>
                  <div className="flex-1 h-px bg-gray-700" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    value={formData.recipient_company}
                    onChange={(e) =>
                      setFormData({ ...formData, recipient_company: e.target.value })
                    }
                    placeholder="Acme Inc."
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* Amount Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Amount</h2>
              <div className="relative">
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrency('USD')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      currency === 'USD'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    USD
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('USDC')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      currency === 'USDC'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    USDC
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-4 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-gray-500 text-2xl font-semibold pr-36"
                  required
                />
              </div>
            </div>

            {/* Optional Fields */}
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Memo (Optional)
                </label>
                <input
                  type="text"
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  placeholder="Payment for services..."
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Invoice Reference (Optional)
                </label>
                <input
                  type="text"
                  value={formData.invoice_id}
                  onChange={(e) => setFormData({ ...formData, invoice_id: e.target.value })}
                  placeholder="INV-001"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-gray-500"
                />
              </div>
            </div>

            {/* Continue Button */}
            <button
              type="submit"
              disabled={!canPreview}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-500 disabled:hover:to-purple-600"
            >
              Preview Payment
            </button>
          </form>
        )}

        {/* Preview Step */}
        {step === 'preview' && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            <h2 className="text-2xl font-semibold mb-6">Review Payment</h2>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Recipient</span>
                <span className="font-medium">
                  {formData.recipient_email ||
                    formData.recipient_phone ||
                    formData.recipient_company}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Payment Amount</span>
                <span className="font-medium text-2xl">{formatUSD(amount)}</span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Wells Fee (1%)</span>
                <span className="font-medium text-yellow-400">{formatUSD(wellsFee)}</span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Your Referrer Bonus (0.1%)</span>
                <span className="font-medium text-green-400">
                  +{formatUSD(referrerBonus)}
                </span>
              </div>

              <div className="flex justify-between items-center py-4 bg-gray-900/50 rounded-lg px-4">
                <span className="text-gray-200 font-semibold text-lg">Total</span>
                <span className="font-bold text-3xl">{formatUSD(totalAmount)}</span>
              </div>

              {formData.memo && (
                <div className="py-3 border-t border-gray-700">
                  <span className="text-gray-400 text-sm">Memo</span>
                  <p className="text-white mt-1">{formData.memo}</p>
                </div>
              )}
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <p className="text-blue-300 text-sm">
                <strong>Viral Payment:</strong> Recipient will automatically get a Wells wallet
                and receive this payment instantly. They can claim it with one click!
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="flex-1 bg-gray-700 text-white py-4 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && paymentResult && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-3xl font-bold mb-2">Payment Sent!</h2>
              <p className="text-gray-400">
                {formatUSD(paymentResult.payment.amount)} sent successfully
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <label className="block text-sm text-gray-400 mb-2">Claim Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={paymentResult.payment.claim_url}
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm"
                  />
                  <button
                    onClick={() => copy(paymentResult.payment.claim_url)}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-4">
                <label className="block text-sm text-gray-400 mb-2">Referral Code</label>
                <div className="font-mono text-xl text-green-400">
                  {paymentResult.payment.referral_code}
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-4">
                <label className="block text-sm text-gray-400 mb-2">Payment ID</label>
                <div className="font-mono text-sm text-gray-300">
                  {paymentResult.payment.id}
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-4">
                <label className="block text-sm text-gray-400 mb-2">Expires</label>
                <div className="text-white">
                  {new Date(paymentResult.payment.expires_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-purple-300 mb-2">Viral Growth Active!</h3>
              <p className="text-purple-200 text-sm">
                When they claim this payment, you'll earn{' '}
                <strong>{formatUSD(referrerBonus)}</strong> in referrer bonuses. Plus, if they
                send payments, you earn 0.1% on those too!
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all"
              >
                Send Another Payment
              </button>
              <a
                href="/viral/history"
                className="flex-1 bg-gray-700 text-white py-4 rounded-lg font-semibold hover:bg-gray-600 transition-colors text-center"
              >
                View History
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
