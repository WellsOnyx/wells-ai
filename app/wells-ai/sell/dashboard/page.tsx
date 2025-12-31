'use client';

/**
 * Supplier Opportunity Dashboard
 * /wells-ai/sell/dashboard
 *
 * Dashboard for suppliers to manage their opportunities, deals, and GRAIN payments
 */

import { useState, useEffect } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  Package,
  Clock,
  Check,
  X,
  Eye,
  MessageSquare,
  Zap,
  Building2,
  MapPin,
  Award,
  Filter,
  Search,
  Bell,
  ChevronDown,
  Coins,
  Star,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Timer
} from 'lucide-react';
import Link from 'next/link';

// Types
interface Opportunity {
  id: string;
  buyerName: string;
  buyerCompany: string;
  category: string;
  description: string;
  quantity: number;
  estimatedValue: number;
  urgency: 'standard' | 'urgent' | 'critical';
  location: string;
  postedAt: string;
  matchScore: number;
  matchReasons: string[];
  status: 'new' | 'interested' | 'intro_requested' | 'quoting' | 'declined';
  requiredCertifications?: string[];
}

interface ActiveDeal {
  id: string;
  buyerCompany: string;
  description: string;
  value: number;
  stage: 'intro' | 'quoting' | 'negotiating' | 'closing' | 'won' | 'lost';
  lastActivity: string;
  nextStep: string;
}

interface Payment {
  id: string;
  dealId: string;
  buyerCompany: string;
  amount: number;
  type: 'grain' | 'traditional';
  status: 'pending' | 'completed' | 'failed';
  paidAt: string;
}

interface DashboardStats {
  newOpportunities: number;
  activeDeals: number;
  wonThisMonth: number;
  totalRevenue: number;
  grainEarned: number;
  responseRate: number;
}

// Mock Data
const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp-1',
    buyerName: 'Sarah Chen',
    buyerCompany: 'TechFlow Industries',
    category: 'electronics',
    description: 'Looking for electronic components for IoT manufacturing line - sensors, microcontrollers, and power supplies',
    quantity: 5000,
    estimatedValue: 75000,
    urgency: 'urgent',
    location: 'San Francisco, CA',
    postedAt: '2024-01-15T10:30:00Z',
    matchScore: 94,
    matchReasons: [
      'Matches your Electronics category',
      'You have ISO 9001 certification they require',
      'Your lead time fits their urgent timeline',
      'You serve the West Coast region'
    ],
    status: 'new',
    requiredCertifications: ['ISO 9001', 'RoHS Compliant']
  },
  {
    id: 'opp-2',
    buyerName: 'Mike Johnson',
    buyerCompany: 'Midwest Manufacturing Co.',
    category: 'industrial',
    description: 'Need industrial motors and bearings for production facility expansion',
    quantity: 200,
    estimatedValue: 45000,
    urgency: 'standard',
    location: 'Chicago, IL',
    postedAt: '2024-01-14T14:20:00Z',
    matchScore: 87,
    matchReasons: [
      'Matches your Industrial Equipment category',
      'Within your Midwest service area',
      'Your MOQ works for their quantity'
    ],
    status: 'new'
  },
  {
    id: 'opp-3',
    buyerName: 'Lisa Park',
    buyerCompany: 'HealthTech Solutions',
    category: 'medical',
    description: 'Medical-grade sensors and monitoring equipment for new patient monitoring system',
    quantity: 1000,
    estimatedValue: 120000,
    urgency: 'critical',
    location: 'Boston, MA',
    postedAt: '2024-01-15T08:15:00Z',
    matchScore: 91,
    matchReasons: [
      'Matches your Medical & Healthcare category',
      'You have FDA Approved certification',
      'Your capacity can handle this order size'
    ],
    status: 'interested',
    requiredCertifications: ['FDA Approved', 'ISO 13485']
  }
];

const MOCK_ACTIVE_DEALS: ActiveDeal[] = [
  {
    id: 'deal-1',
    buyerCompany: 'AutoParts Plus',
    description: 'Automotive sensor package - 2,500 units',
    value: 62500,
    stage: 'negotiating',
    lastActivity: '2024-01-14T16:00:00Z',
    nextStep: 'Waiting for buyer counter-offer'
  },
  {
    id: 'deal-2',
    buyerCompany: 'GreenEnergy Corp',
    description: 'Industrial control systems',
    value: 89000,
    stage: 'quoting',
    lastActivity: '2024-01-13T11:30:00Z',
    nextStep: 'Submit final quote by Friday'
  }
];

const MOCK_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    dealId: 'deal-x1',
    buyerCompany: 'TechStart Inc.',
    amount: 34500,
    type: 'grain',
    status: 'completed',
    paidAt: '2024-01-10T09:00:00Z'
  },
  {
    id: 'pay-2',
    dealId: 'deal-x2',
    buyerCompany: 'Industrial Systems LLC',
    amount: 28750,
    type: 'grain',
    status: 'completed',
    paidAt: '2024-01-05T14:30:00Z'
  },
  {
    id: 'pay-3',
    dealId: 'deal-x3',
    buyerCompany: 'MedDevice Co.',
    amount: 67000,
    type: 'grain',
    status: 'pending',
    paidAt: '2024-01-15T10:00:00Z'
  }
];

const MOCK_STATS: DashboardStats = {
  newOpportunities: 3,
  activeDeals: 2,
  wonThisMonth: 4,
  totalRevenue: 245000,
  grainEarned: 198250,
  responseRate: 92
};

export default function SupplierDashboardPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(MOCK_OPPORTUNITIES);
  const [activeDeals] = useState<ActiveDeal[]>(MOCK_ACTIVE_DEALS);
  const [payments] = useState<Payment[]>(MOCK_PAYMENTS);
  const [stats] = useState<DashboardStats>(MOCK_STATS);
  const [selectedTab, setSelectedTab] = useState<'opportunities' | 'deals' | 'payments'>('opportunities');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedOpp, setExpandedOpp] = useState<string | null>(null);

  const handleExpressInterest = async (oppId: string) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setOpportunities(prev =>
      prev.map(opp =>
        opp.id === oppId ? { ...opp, status: 'interested' } : opp
      )
    );
    setIsLoading(false);
  };

  const handleDecline = async (oppId: string) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setOpportunities(prev =>
      prev.map(opp =>
        opp.id === oppId ? { ...opp, status: 'declined' } : opp
      )
    );
    setIsLoading(false);
  };

  const handleRequestDetails = async (oppId: string) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setOpportunities(prev =>
      prev.map(opp =>
        opp.id === oppId ? { ...opp, status: 'intro_requested' } : opp
      )
    );
    setIsLoading(false);
  };

  const filteredOpportunities = opportunities.filter(opp => {
    if (filterUrgency === 'all') return true;
    return opp.urgency === filterUrgency;
  });

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'urgent': return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
      default: return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'won': return 'text-green-400 bg-green-500/20';
      case 'lost': return 'text-red-400 bg-red-500/20';
      case 'closing': return 'text-amber-400 bg-amber-500/20';
      default: return 'text-blue-400 bg-blue-500/20';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/wells-ai/sell" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <div>
                  <span className="text-xl font-bold text-white">Wells AI</span>
                  <span className="text-sm text-gray-400 ml-2">Supplier Portal</span>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <Bell className="w-5 h-5 text-gray-400" />
                {stats.newOpportunities > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-xs text-black font-bold flex items-center justify-center">
                    {stats.newOpportunities}
                  </span>
                )}
              </button>
              <Link
                href="/wells-ai/sell"
                className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors text-sm"
              >
                Edit Profile
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Banner */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Good morning!
          </h1>
          <p className="text-gray-400">
            You have {stats.newOpportunities} new opportunities waiting for you.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{stats.newOpportunities}</p>
            <p className="text-sm text-gray-400">New Opportunities</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{stats.activeDeals}</p>
            <p className="text-sm text-gray-400">Active Deals</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{stats.wonThisMonth}</p>
            <p className="text-sm text-gray-400">Won This Month</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-sm text-gray-400">Total Revenue</p>
          </div>

          <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/20 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/30 flex items-center justify-center">
                <Coins className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(stats.grainEarned)}</p>
            <p className="text-sm text-amber-400/70">GRAIN Earned</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{stats.responseRate}%</p>
            <p className="text-sm text-gray-400">Response Rate</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
          {[
            { id: 'opportunities', label: 'Opportunities', count: filteredOpportunities.filter(o => o.status === 'new').length },
            { id: 'deals', label: 'Active Deals', count: activeDeals.length },
            { id: 'payments', label: 'Payments', count: payments.filter(p => p.status === 'pending').length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${
                selectedTab === tab.id
                  ? 'bg-amber-500 text-black'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  selectedTab === tab.id
                    ? 'bg-black/20 text-black'
                    : 'bg-white/10 text-gray-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Opportunities Tab */}
        {selectedTab === 'opportunities' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={filterUrgency}
                  onChange={(e) => setFilterUrgency(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="all" className="bg-gray-900">All Urgency</option>
                  <option value="critical" className="bg-gray-900">Critical</option>
                  <option value="urgent" className="bg-gray-900">Urgent</option>
                  <option value="standard" className="bg-gray-900">Standard</option>
                </select>
              </div>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-sm">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {/* Opportunity Cards */}
            <div className="space-y-4">
              {filteredOpportunities.map((opp) => (
                <div
                  key={opp.id}
                  className={`bg-white/5 backdrop-blur-xl border rounded-2xl overflow-hidden transition-all ${
                    expandedOpp === opp.id ? 'border-amber-500/50' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Card Header */}
                  <div
                    className="p-6 cursor-pointer"
                    onClick={() => setExpandedOpp(expandedOpp === opp.id ? null : opp.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getUrgencyColor(opp.urgency)}`}>
                            {opp.urgency === 'critical' && <AlertCircle className="w-3 h-3 inline mr-1" />}
                            {opp.urgency.charAt(0).toUpperCase() + opp.urgency.slice(1)}
                          </span>
                          <span className="text-sm text-gray-400">{formatDate(opp.postedAt)}</span>
                          {opp.status === 'interested' && (
                            <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">
                              Interest Expressed
                            </span>
                          )}
                          {opp.status === 'intro_requested' && (
                            <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs">
                              Intro Requested
                            </span>
                          )}
                          {opp.status === 'declined' && (
                            <span className="px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs">
                              Declined
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">{opp.buyerCompany}</h3>
                        <p className="text-gray-400 line-clamp-2">{opp.description}</p>
                      </div>

                      {/* Match Score */}
                      <div className="flex flex-col items-center ml-6">
                        <div className="relative w-16 h-16">
                          <svg className="w-16 h-16 -rotate-90">
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              fill="none"
                              stroke="rgba(255,255,255,0.1)"
                              strokeWidth="4"
                            />
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              fill="none"
                              stroke={opp.matchScore >= 90 ? '#22c55e' : opp.matchScore >= 80 ? '#f59e0b' : '#3b82f6'}
                              strokeWidth="4"
                              strokeDasharray={`${opp.matchScore * 1.76} 176`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold text-white">{opp.matchScore}</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 mt-1">Match</span>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-6 mt-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-white font-medium">{formatCurrency(opp.estimatedValue)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <Package className="w-4 h-4" />
                        <span>{opp.quantity.toLocaleString()} units</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span>{opp.location}</span>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-gray-400 ml-auto transition-transform ${expandedOpp === opp.id ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedOpp === opp.id && (
                    <div className="px-6 pb-6 border-t border-white/10 pt-6 space-y-6 animate-slide-up">
                      {/* Match Reasons */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                          <Star className="w-4 h-4 text-amber-500" />
                          Why you matched
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {opp.matchReasons.map((reason, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                              {reason}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Required Certifications */}
                      {opp.requiredCertifications && opp.requiredCertifications.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                            <Award className="w-4 h-4 text-blue-500" />
                            Required Certifications
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {opp.requiredCertifications.map((cert) => (
                              <span key={cert} className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm">
                                {cert}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Buyer Info */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-purple-500" />
                          Buyer Contact
                        </h4>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold">
                            {opp.buyerName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-white font-medium">{opp.buyerName}</p>
                            <p className="text-sm text-gray-400">{opp.buyerCompany}</p>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {opp.status === 'new' && (
                        <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExpressInterest(opp.id);
                            }}
                            disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:scale-105 transition-transform disabled:opacity-50"
                          >
                            <Zap className="w-5 h-5" />
                            Express Interest
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestDetails(opp.id);
                            }}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                          >
                            <Eye className="w-5 h-5" />
                            Request Details
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDecline(opp.id);
                            }}
                            disabled={isLoading}
                            className="p-3 rounded-xl bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      )}

                      {opp.status === 'interested' && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                          <div>
                            <p className="text-green-400 font-medium">Interest Expressed</p>
                            <p className="text-sm text-gray-400">The buyer will be notified. We'll facilitate an intro if they're interested.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {filteredOpportunities.length === 0 && (
                <div className="text-center py-16">
                  <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No opportunities found</h3>
                  <p className="text-gray-400">Check back soon or adjust your filters</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Deals Tab */}
        {selectedTab === 'deals' && (
          <div className="space-y-4">
            {activeDeals.map((deal) => (
              <div
                key={deal.id}
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{deal.buyerCompany}</h3>
                    <p className="text-gray-400">{deal.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">{formatCurrency(deal.value)}</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStageColor(deal.stage)}`}>
                      {deal.stage.charAt(0).toUpperCase() + deal.stage.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    Last activity: {formatDate(deal.lastActivity)}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Timer className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-400">{deal.nextStep}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-black font-medium hover:bg-amber-400 transition-colors">
                    <MessageSquare className="w-4 h-4" />
                    Continue Negotiation
                  </button>
                  <button className="px-4 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
                    View Details
                  </button>
                </div>
              </div>
            ))}

            {activeDeals.length === 0 && (
              <div className="text-center py-16">
                <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No active deals</h3>
                <p className="text-gray-400">Express interest in opportunities to start deals</p>
              </div>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {selectedTab === 'payments' && (
          <div className="space-y-6">
            {/* GRAIN Benefits Banner */}
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-amber-500/10 border border-amber-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <Coins className="w-7 h-7 text-black" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">GRAIN Payments</h3>
                  <p className="text-amber-400/80">
                    You've earned {formatCurrency(stats.grainEarned)} via instant GRAIN payments
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-amber-400">${(stats.grainEarned * 0.03).toLocaleString()}</p>
                  <p className="text-sm text-gray-400">Saved in card fees</p>
                </div>
              </div>
            </div>

            {/* Payment History */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <h3 className="font-semibold text-white">Payment History</h3>
              </div>
              <div className="divide-y divide-white/5">
                {payments.map((payment) => (
                  <div key={payment.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        payment.type === 'grain'
                          ? 'bg-amber-500/20'
                          : 'bg-gray-500/20'
                      }`}>
                        {payment.type === 'grain' ? (
                          <Coins className="w-5 h-5 text-amber-500" />
                        ) : (
                          <DollarSign className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{payment.buyerCompany}</p>
                        <p className="text-sm text-gray-400">{formatDate(payment.paidAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {payment.status === 'pending' ? (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      ) : payment.status === 'completed' ? (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm">
                          <XCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                      <p className="text-lg font-semibold text-white w-28 text-right">
                        {formatCurrency(payment.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Quick Action FAB */}
      <div className="fixed bottom-6 right-6">
        <Link
          href="/wells-ai/sell"
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold shadow-lg shadow-amber-500/25 hover:scale-105 transition-transform"
        >
          <Sparkles className="w-5 h-5" />
          Update Profile
        </Link>
      </div>
    </div>
  );
}
