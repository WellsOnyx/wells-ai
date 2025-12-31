'use client';

/**
 * Supplier Profile Intake Page
 * /wells-ai/sell
 *
 * "What do you sell?" profile builder with glassmorphic UI
 * Easy 2-minute onboarding for suppliers to join Wells AI marketplace
 */

import { useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  Package,
  Award,
  MapPin,
  Clock,
  DollarSign,
  Zap,
  Shield,
  TrendingUp,
  Loader2,
  Sparkles,
  CheckCircle2,
  Coins
} from 'lucide-react';
import Link from 'next/link';

// Product/Service Categories
const CATEGORIES = [
  { id: 'technology', name: 'Technology & Software', icon: '💻' },
  { id: 'industrial', name: 'Industrial Equipment', icon: '🏭' },
  { id: 'electronics', name: 'Electronics & Components', icon: '🔌' },
  { id: 'manufacturing', name: 'Manufacturing & Fabrication', icon: '⚙️' },
  { id: 'food_beverage', name: 'Food & Beverage', icon: '🍽️' },
  { id: 'office_supplies', name: 'Office Supplies', icon: '📎' },
  { id: 'packaging', name: 'Packaging & Shipping', icon: '📦' },
  { id: 'chemicals', name: 'Chemicals & Raw Materials', icon: '🧪' },
  { id: 'medical', name: 'Medical & Healthcare', icon: '🏥' },
  { id: 'construction', name: 'Construction & Building', icon: '🏗️' },
  { id: 'automotive', name: 'Automotive Parts', icon: '🚗' },
  { id: 'professional_services', name: 'Professional Services', icon: '💼' },
];

const SUBCATEGORIES: Record<string, string[]> = {
  technology: ['SaaS', 'Hardware', 'IT Services', 'Cloud Infrastructure', 'Cybersecurity', 'Data Analytics'],
  industrial: ['Motors', 'Pumps', 'Valves', 'Conveyors', 'Safety Equipment', 'Maintenance Tools'],
  electronics: ['Semiconductors', 'Circuit Boards', 'Sensors', 'Connectors', 'Power Supplies', 'Displays'],
  manufacturing: ['CNC Machining', '3D Printing', 'Injection Molding', 'Sheet Metal', 'Assembly', 'Welding'],
  food_beverage: ['Produce', 'Meat & Protein', 'Dairy', 'Beverages', 'Dry Goods', 'Specialty Foods'],
  office_supplies: ['Furniture', 'Paper Products', 'Tech Accessories', 'Cleaning Supplies', 'Breakroom'],
  packaging: ['Boxes', 'Labels', 'Tape', 'Pallets', 'Custom Packaging', 'Sustainable Options'],
  chemicals: ['Industrial Chemicals', 'Specialty Chemicals', 'Lubricants', 'Solvents', 'Adhesives'],
  medical: ['Medical Devices', 'Lab Equipment', 'PPE', 'Diagnostics', 'Pharmaceuticals'],
  construction: ['Building Materials', 'Tools', 'HVAC', 'Electrical', 'Plumbing', 'Safety Gear'],
  automotive: ['OEM Parts', 'Aftermarket', 'Fleet Supplies', 'Lubricants', 'Tools', 'Accessories'],
  professional_services: ['Consulting', 'Legal', 'Accounting', 'Marketing', 'Staffing', 'Training'],
};

const CERTIFICATIONS = [
  'ISO 9001', 'ISO 14001', 'ISO 27001', 'SOC 2',
  'FDA Approved', 'USDA Organic', 'UL Listed', 'CE Marked',
  'IATF 16949', 'AS9100', 'HIPAA Compliant', 'PCI DSS',
  'Fair Trade', 'B Corp', 'Minority-Owned (MBE)', 'Woman-Owned (WBE)',
  'Veteran-Owned', 'Small Business', 'HUBZone', 'Other'
];

const US_REGIONS = [
  'Northeast (NY, NJ, PA, CT, MA, etc.)',
  'Southeast (FL, GA, NC, SC, VA, etc.)',
  'Midwest (IL, OH, MI, IN, WI, etc.)',
  'Southwest (TX, AZ, NM, OK, etc.)',
  'West Coast (CA, WA, OR)',
  'Mountain (CO, UT, NV, etc.)',
  'National (All US)',
  'International'
];

interface SupplierProfile {
  // Company Info
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;

  // What they sell
  categories: string[];
  subcategories: string[];
  productDescription: string;

  // Capabilities
  certifications: string[];
  monthlyCapacity: string;
  leadTimeDays: number;
  minimumOrderValue: number;

  // Service Areas
  serviceAreas: string[];
  canDropShip: boolean;
  canWhiteLabel: boolean;

  // Payment Preferences
  acceptsGrain: boolean;
  paymentTerms: string;
}

export default function SupplierProfileIntakePage() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);

  const [profile, setProfile] = useState<SupplierProfile>({
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    categories: [],
    subcategories: [],
    productDescription: '',
    certifications: [],
    monthlyCapacity: '',
    leadTimeDays: 7,
    minimumOrderValue: 500,
    serviceAreas: [],
    canDropShip: false,
    canWhiteLabel: false,
    acceptsGrain: true,
    paymentTerms: 'NET30',
  });

  const totalSteps = 5;

  const updateProfile = (updates: Partial<SupplierProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  };

  const toggleArrayItem = (field: keyof SupplierProfile, item: string) => {
    const current = profile[field] as string[];
    const updated = current.includes(item)
      ? current.filter(i => i !== item)
      : [...current, item];
    updateProfile({ [field]: updated });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/wells-ai/sell/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create profile');
      }

      setSupplierId(data.supplierId);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return profile.companyName && profile.contactEmail && profile.contactName;
      case 2:
        return profile.categories.length > 0;
      case 3:
        return profile.monthlyCapacity && profile.leadTimeDays > 0;
      case 4:
        return profile.serviceAreas.length > 0;
      case 5:
        return true;
      default:
        return false;
    }
  };

  // Success State
  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          {/* Success Animation */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-green-500/20 blur-3xl" />
            <div className="relative w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4">
            You're All Set!
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Welcome to Wells AI, {profile.companyName}. Your supplier profile is live and ready to receive opportunities.
          </p>

          {/* GRAIN Benefits Highlight */}
          <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/30 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Coins className="w-6 h-6 text-amber-500" />
              <span className="text-lg font-semibold text-amber-400">GRAIN Payment Enabled</span>
            </div>
            <p className="text-gray-300">
              You'll receive instant payment via GRAIN when deals close. No waiting 30-60 days, no 2-3% card fees.
            </p>
          </div>

          {/* Next Steps */}
          <div className="space-y-4 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-500 font-bold">1</span>
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Check your email</p>
                <p className="text-sm text-gray-400">We sent a confirmation to {profile.contactEmail}</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-500 font-bold">2</span>
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Watch for opportunities</p>
                <p className="text-sm text-gray-400">We'll match you with buyers looking for what you sell</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-500 font-bold">3</span>
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Express interest & win deals</p>
                <p className="text-sm text-gray-400">Connect with verified buyers and close deals with GRAIN</p>
              </div>
            </div>
          </div>

          <Link
            href="/wells-ai/sell/dashboard"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black px-8 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-transform"
          >
            Go to Supplier Dashboard
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <span className="text-xl font-bold text-white">Wells AI</span>
          </Link>
          <div className="text-sm text-gray-400">
            Step {step} of {totalSteps}
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="sticky top-[65px] z-40 bg-black/50 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div
                  className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                    s <= step
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                      : 'bg-white/10'
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span className={step >= 1 ? 'text-amber-500' : ''}>Company</span>
            <span className={step >= 2 ? 'text-amber-500' : ''}>Products</span>
            <span className={step >= 3 ? 'text-amber-500' : ''}>Capabilities</span>
            <span className={step >= 4 ? 'text-amber-500' : ''}>Coverage</span>
            <span className={step >= 5 ? 'text-amber-500' : ''}>Payment</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Step 1: Company Information */}
        {step === 1 && (
          <div className="space-y-8 animate-slide-up">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 mb-6">
                <Building2 className="w-8 h-8 text-amber-500" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">
                Tell us about your company
              </h1>
              <p className="text-xl text-gray-400">
                Let's start with the basics so buyers can find you
              </p>
            </div>

            {/* Glassmorphic Form Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={profile.companyName}
                  onChange={(e) => updateProfile({ companyName: e.target.value })}
                  placeholder="Acme Industrial Supply"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    value={profile.contactName}
                    onChange={(e) => updateProfile({ contactName: e.target.value })}
                    placeholder="John Smith"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Contact Email *
                  </label>
                  <input
                    type="email"
                    value={profile.contactEmail}
                    onChange={(e) => updateProfile({ contactEmail: e.target.value })}
                    placeholder="sales@acme.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={profile.contactPhone}
                    onChange={(e) => updateProfile({ contactPhone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={profile.website}
                    onChange={(e) => updateProfile({ website: e.target.value })}
                    placeholder="https://acme.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: What You Sell */}
        {step === 2 && (
          <div className="space-y-8 animate-slide-up">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 mb-6">
                <Package className="w-8 h-8 text-amber-500" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">
                What do you sell?
              </h1>
              <p className="text-xl text-gray-400">
                Select your categories so we can match you with the right buyers
              </p>
            </div>

            {/* Categories */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <h2 className="text-lg font-semibold text-white mb-4">Product Categories *</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleArrayItem('categories', cat.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                      profile.categories.includes(cat.id)
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="text-sm font-medium text-left">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Subcategories */}
            {profile.categories.length > 0 && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                <h2 className="text-lg font-semibold text-white mb-4">Subcategories</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.categories.flatMap(cat =>
                    SUBCATEGORIES[cat]?.map(sub => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => toggleArrayItem('subcategories', sub)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          profile.subcategories.includes(sub)
                            ? 'bg-amber-500 text-black'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        {sub}
                      </button>
                    )) || []
                  )}
                </div>
              </div>
            )}

            {/* Product Description */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <h2 className="text-lg font-semibold text-white mb-4">Describe what you offer</h2>
              <textarea
                value={profile.productDescription}
                onChange={(e) => updateProfile({ productDescription: e.target.value })}
                placeholder="Tell us about your products or services. What makes you unique? What are your specialties?"
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 3: Capabilities */}
        {step === 3 && (
          <div className="space-y-8 animate-slide-up">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 mb-6">
                <Award className="w-8 h-8 text-amber-500" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">
                Your capabilities
              </h1>
              <p className="text-xl text-gray-400">
                Help buyers understand your capacity and qualifications
              </p>
            </div>

            {/* Capacity & Lead Time */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Monthly Capacity *
                  </label>
                  <select
                    value={profile.monthlyCapacity}
                    onChange={(e) => updateProfile({ monthlyCapacity: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  >
                    <option value="" className="bg-gray-900">Select capacity...</option>
                    <option value="small" className="bg-gray-900">Small (under $50K/month)</option>
                    <option value="medium" className="bg-gray-900">Medium ($50K - $250K/month)</option>
                    <option value="large" className="bg-gray-900">Large ($250K - $1M/month)</option>
                    <option value="enterprise" className="bg-gray-900">Enterprise ($1M+/month)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Standard Lead Time (days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={profile.leadTimeDays}
                    onChange={(e) => updateProfile({ leadTimeDays: parseInt(e.target.value) || 7 })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Minimum Order Value
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    min="0"
                    value={profile.minimumOrderValue}
                    onChange={(e) => updateProfile({ minimumOrderValue: parseInt(e.target.value) || 0 })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-8 text-white focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Certifications */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <h2 className="text-lg font-semibold text-white mb-4">
                <Shield className="w-5 h-5 inline mr-2 text-amber-500" />
                Certifications
              </h2>
              <div className="flex flex-wrap gap-2">
                {CERTIFICATIONS.map((cert) => (
                  <button
                    key={cert}
                    type="button"
                    onClick={() => toggleArrayItem('certifications', cert)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      profile.certifications.includes(cert)
                        ? 'bg-amber-500 text-black'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    {cert}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Capabilities */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <h2 className="text-lg font-semibold text-white mb-4">Additional Capabilities</h2>
              <div className="space-y-4">
                <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                  <input
                    type="checkbox"
                    checked={profile.canDropShip}
                    onChange={(e) => updateProfile({ canDropShip: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 text-amber-500 focus:ring-amber-500/20"
                  />
                  <div>
                    <p className="text-white font-medium">Drop Shipping</p>
                    <p className="text-sm text-gray-400">Can ship directly to buyer's customers</p>
                  </div>
                </label>
                <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                  <input
                    type="checkbox"
                    checked={profile.canWhiteLabel}
                    onChange={(e) => updateProfile({ canWhiteLabel: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 text-amber-500 focus:ring-amber-500/20"
                  />
                  <div>
                    <p className="text-white font-medium">White Label</p>
                    <p className="text-sm text-gray-400">Can provide products under buyer's brand</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Service Areas */}
        {step === 4 && (
          <div className="space-y-8 animate-slide-up">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 mb-6">
                <MapPin className="w-8 h-8 text-amber-500" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">
                Where do you serve?
              </h1>
              <p className="text-xl text-gray-400">
                Select the regions where you can fulfill orders
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <h2 className="text-lg font-semibold text-white mb-4">Service Areas *</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {US_REGIONS.map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => toggleArrayItem('serviceAreas', region)}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                      profile.serviceAreas.includes(region)
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <MapPin className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">{region}</span>
                    {profile.serviceAreas.includes(region) && (
                      <Check className="w-5 h-5 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Payment Preferences */}
        {step === 5 && (
          <div className="space-y-8 animate-slide-up">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 mb-6">
                <Coins className="w-8 h-8 text-amber-500" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">
                Payment preferences
              </h1>
              <p className="text-xl text-gray-400">
                How do you want to get paid?
              </p>
            </div>

            {/* GRAIN Benefits */}
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-amber-500/10 border border-amber-500/30 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Accept GRAIN Payments</h2>
                  <p className="text-amber-400/80">Recommended for instant payment</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-black/40 rounded-xl p-4">
                  <Zap className="w-8 h-8 text-amber-500 mb-2" />
                  <h3 className="text-white font-semibold mb-1">Instant Payment</h3>
                  <p className="text-sm text-gray-400">Get paid the moment the deal closes</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4">
                  <DollarSign className="w-8 h-8 text-green-500 mb-2" />
                  <h3 className="text-white font-semibold mb-1">Zero Fees</h3>
                  <p className="text-sm text-gray-400">No 2-3% card processing fees</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4">
                  <Shield className="w-8 h-8 text-blue-500 mb-2" />
                  <h3 className="text-white font-semibold mb-1">Verified Buyers</h3>
                  <p className="text-sm text-gray-400">All buyers have funds on deposit</p>
                </div>
              </div>

              <label className="flex items-center gap-4 cursor-pointer">
                <div className={`w-12 h-7 rounded-full transition-all relative ${
                  profile.acceptsGrain ? 'bg-amber-500' : 'bg-white/20'
                }`}>
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
                    profile.acceptsGrain ? 'left-6' : 'left-1'
                  }`} />
                </div>
                <span className="text-white font-medium">
                  Yes, I want to accept GRAIN payments
                </span>
              </label>
              <button
                type="button"
                onClick={() => updateProfile({ acceptsGrain: !profile.acceptsGrain })}
                className="opacity-0 absolute"
                aria-label="Toggle GRAIN acceptance"
              />
            </div>

            {/* Standard Payment Terms */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <h2 className="text-lg font-semibold text-white mb-4">Standard Payment Terms</h2>
              <p className="text-sm text-gray-400 mb-4">
                For orders not using GRAIN, what are your standard terms?
              </p>
              <div className="flex flex-wrap gap-3">
                {['NET15', 'NET30', 'NET45', 'NET60', 'Due on Receipt'].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => updateProfile({ paymentTerms: term })}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      profile.paymentTerms === term
                        ? 'bg-amber-500 text-black'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <h2 className="text-lg font-semibold text-white mb-4">Profile Summary</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Company:</span>
                  <span className="text-white ml-2">{profile.companyName}</span>
                </div>
                <div>
                  <span className="text-gray-400">Contact:</span>
                  <span className="text-white ml-2">{profile.contactName}</span>
                </div>
                <div>
                  <span className="text-gray-400">Categories:</span>
                  <span className="text-white ml-2">{profile.categories.length} selected</span>
                </div>
                <div>
                  <span className="text-gray-400">Lead Time:</span>
                  <span className="text-white ml-2">{profile.leadTimeDays} days</span>
                </div>
                <div>
                  <span className="text-gray-400">Service Areas:</span>
                  <span className="text-white ml-2">{profile.serviceAreas.length} regions</span>
                </div>
                <div>
                  <span className="text-gray-400">GRAIN:</span>
                  <span className={`ml-2 ${profile.acceptsGrain ? 'text-green-400' : 'text-gray-400'}`}>
                    {profile.acceptsGrain ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-12 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              Continue
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:scale-105 transition-transform disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Profile...
                </>
              ) : (
                <>
                  Complete Setup
                  <Check className="w-5 h-5" />
                </>
              )}
            </button>
          )}
        </div>
      </main>

      {/* Value Props Footer */}
      <footer className="border-t border-white/10 bg-black/50 mt-20">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <TrendingUp className="w-8 h-8 text-amber-500 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Free Leads</h3>
              <p className="text-sm text-gray-400">
                We match you with buyers for free. Only pay a small fee when you close deals.
              </p>
            </div>
            <div>
              <Zap className="w-8 h-8 text-amber-500 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Instant Payment</h3>
              <p className="text-sm text-gray-400">
                Get paid via GRAIN instantly when deals close. No more Net 30-60.
              </p>
            </div>
            <div>
              <Shield className="w-8 h-8 text-amber-500 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-2">Verified Buyers</h3>
              <p className="text-sm text-gray-400">
                All buyers have deposits on file. No more chasing payments.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
