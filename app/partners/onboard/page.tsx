'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface TargetAccount {
  companyName: string;
  industry: string;
  revenue: string;
  painPoint: string;
  solution: string;
  estimatedDealSize: number;
  contactName?: string;
  contactEmail?: string;
  contactTitle?: string;
}

export default function PartnerOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Partner details (Step 1)
  const [partnerName, setPartnerName] = useState('');
  const [partnerContactEmail, setPartnerContactEmail] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [partnershipType, setPartnershipType] = useState('Technology');

  // Value proposition (Step 2)
  const [valueProposition, setValueProposition] = useState('');
  const [dealSplit, setDealSplit] = useState({ wells: 30, partner: 70 });
  const [outreachStrategy, setOutreachStrategy] = useState('email-sequence');

  // Target accounts (Step 3)
  const [targetAccounts, setTargetAccounts] = useState<TargetAccount[]>([
    {
      companyName: '',
      industry: '',
      revenue: '$10M-50M',
      painPoint: '',
      solution: '',
      estimatedDealSize: 500000,
    }
  ]);

  const addTargetAccount = () => {
    setTargetAccounts([...targetAccounts, {
      companyName: '',
      industry: '',
      revenue: '$10M-50M',
      painPoint: '',
      solution: '',
      estimatedDealSize: 500000,
    }]);
  };

  const updateTargetAccount = (index: number, field: keyof TargetAccount, value: any) => {
    const updated = [...targetAccounts];
    updated[index] = { ...updated[index], [field]: value };
    setTargetAccounts(updated);
  };

  const removeTargetAccount = (index: number) => {
    setTargetAccounts(targetAccounts.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/gtm/co-sell/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerName,
          partnerContactEmail,
          industry,
          website,
          partnershipType,
          valueProposition,
          dealSplit,
          outreachStrategy,
          targetAccounts: targetAccounts.filter(a => a.companyName.trim() !== ''),
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/partners/${data.playbook.id}`);
      } else {
        alert('Error creating playbook: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create playbook');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step >= s ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {s}
                </div>
                {s < 3 && <div className={`w-32 h-1 ${step > s ? 'bg-blue-600' : 'bg-gray-300'}`} />}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <span className={step >= 1 ? 'text-blue-600 font-semibold' : 'text-gray-500'}>Partner Details</span>
            <span className={step >= 2 ? 'text-blue-600 font-semibold' : 'text-gray-500'}>Value Proposition</span>
            <span className={step >= 3 ? 'text-blue-600 font-semibold' : 'text-gray-500'}>Target Accounts</span>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Onboard Strategic Partner
          </h1>
          <p className="text-gray-600 mb-8">
            Build a co-sell playbook and start generating pipeline in 5 minutes
          </p>

          {/* Step 1: Partner Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Partner Name *
                </label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="e.g., IBM, SAP, Plaid"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Partner Contact Email *
                </label>
                <input
                  type="email"
                  value={partnerContactEmail}
                  onChange={(e) => setPartnerContactEmail(e.target.value)}
                  placeholder="partner@company.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  We'll CC them on all co-sell outreach
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industry
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select industry...</option>
                  <option value="Technology">Technology</option>
                  <option value="Financial Services">Financial Services</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Retail">Retail</option>
                  <option value="Professional Services">Professional Services</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://partner.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Partnership Type
                </label>
                <select
                  value={partnershipType}
                  onChange={(e) => setPartnershipType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Technology">Technology</option>
                  <option value="Channel">Channel</option>
                  <option value="Reseller">Reseller</option>
                  <option value="Referral">Referral</option>
                </select>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!partnerName || !partnerContactEmail}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next: Value Proposition
              </button>
            </div>
          )}

          {/* Step 2: Value Proposition */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Value Proposition
                </label>
                <textarea
                  value={valueProposition}
                  onChange={(e) => setValueProposition(e.target.value)}
                  placeholder="How does Wells + Partner solve the customer's problem? Leave blank for AI-generated value prop."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Tip: Focus on outcomes, not features. "Reduce costs by 70%" not "AI-powered platform"
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deal Split
                </label>
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="text-sm text-gray-600">Wells %</label>
                    <input
                      type="number"
                      value={dealSplit.wells}
                      onChange={(e) => setDealSplit({ wells: parseInt(e.target.value), partner: 100 - parseInt(e.target.value) })}
                      min="0"
                      max="100"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm text-gray-600">Partner %</label>
                    <input
                      type="number"
                      value={dealSplit.partner}
                      disabled
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Outreach Strategy
                </label>
                <select
                  value={outreachStrategy}
                  onChange={(e) => setOutreachStrategy(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="email-sequence">7-Touch Email Sequence</option>
                  <option value="linkedin">LinkedIn + Email</option>
                  <option value="cold-call">Cold Call + Email</option>
                </select>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
                >
                  Next: Target Accounts
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Target Accounts */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Add 5-20 target accounts. Wells AI will generate personalized outreach for each.
                </p>
              </div>

              {targetAccounts.map((account, index) => (
                <div key={index} className="border border-gray-300 rounded-lg p-6 space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Account #{index + 1}</h3>
                    {targetAccounts.length > 1 && (
                      <button
                        onClick={() => removeTargetAccount(index)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                      <input
                        type="text"
                        value={account.companyName}
                        onChange={(e) => updateTargetAccount(index, 'companyName', e.target.value)}
                        placeholder="Acme Corp"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                      <input
                        type="text"
                        value={account.industry}
                        onChange={(e) => updateTargetAccount(index, 'industry', e.target.value)}
                        placeholder="Manufacturing"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pain Point *</label>
                    <textarea
                      value={account.painPoint}
                      onChange={(e) => updateTargetAccount(index, 'painPoint', e.target.value)}
                      placeholder="What problem are they facing?"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Solution *</label>
                    <textarea
                      value={account.solution}
                      onChange={(e) => updateTargetAccount(index, 'solution', e.target.value)}
                      placeholder="How does Wells + Partner solve it?"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Deal Size</label>
                      <input
                        type="number"
                        value={account.estimatedDealSize}
                        onChange={(e) => updateTargetAccount(index, 'estimatedDealSize', parseInt(e.target.value))}
                        placeholder="500000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">${(account.estimatedDealSize / 1000).toFixed(0)}K</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                      <input
                        type="email"
                        value={account.contactEmail || ''}
                        onChange={(e) => updateTargetAccount(index, 'contactEmail', e.target.value)}
                        placeholder="buyer@acmecorp.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addTargetAccount}
                className="w-full border-2 border-dashed border-gray-300 py-4 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 font-medium"
              >
                + Add Target Account
              </button>

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || targetAccounts.filter(a => a.companyName.trim() !== '').length === 0}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating Playbook...' : 'Create Co-Sell Playbook'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Expected Results */}
        <div className="mt-8 bg-gray-800 text-white rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">What Happens Next?</h3>
          <div className="space-y-3">
            <div className="flex items-start">
              <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                <span className="text-sm font-bold">1</span>
              </div>
              <div>
                <p className="font-semibold">AI Generates Personalized Outreach</p>
                <p className="text-gray-300 text-sm">7-touch email sequence customized for each target account</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                <span className="text-sm font-bold">2</span>
              </div>
              <div>
                <p className="font-semibold">Review & Approve</p>
                <p className="text-gray-300 text-sm">You approve each email before it goes out (or set to auto-send)</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                <span className="text-sm font-bold">3</span>
              </div>
              <div>
                <p className="font-semibold">Track Pipeline</p>
                <p className="text-gray-300 text-sm">See opens, replies, meetings booked, and deals won in real-time</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                <span className="text-sm font-bold">4</span>
              </div>
              <div>
                <p className="font-semibold">Close Deals</p>
                <p className="text-gray-300 text-sm">Average 15% conversion rate → Wells gets {dealSplit.wells}%, Partner gets {dealSplit.partner}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
