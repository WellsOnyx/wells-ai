'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Mock data
const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing',
  'Education', 'Real Estate', 'Legal', 'Marketing', 'Consulting',
  'E-commerce', 'Media', 'Hospitality', 'Transportation', 'Energy',
  'Agriculture', 'Construction', 'Telecommunications', 'Pharmaceuticals', 'Insurance'
];

const PACKAGES = [
  {
    id: 'basic',
    name: 'Basic',
    price: 2000,
    sops: 1,
    hours: 40,
    features: ['1 SOP Template', '40 hours/month', 'Email support', 'Basic reporting', 'Slack integration']
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 5000,
    sops: 3,
    hours: 120,
    features: ['3 SOP Templates', '120 hours/month', 'Priority support', 'Advanced analytics', 'All integrations', 'Custom workflows']
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 15000,
    sops: 10,
    hours: -1,
    features: ['10 SOP Templates', 'Unlimited hours', '24/7 dedicated support', 'Custom SOPs', 'API access', 'White-label options', 'Dedicated account manager']
  },
  {
    id: 'custom',
    name: 'Custom',
    price: 0,
    sops: -1,
    hours: -1,
    features: ['Tailored solution', 'Custom pricing', 'Flexible terms']
  }
];

const SOP_TEMPLATES = [
  // Chief of Staff
  { id: 'cos-1', category: 'Chief of Staff', name: 'Executive Calendar Management', description: 'Manage executive schedules, coordinate meetings, handle conflicts', hours: 20, frequency: 'Daily' },
  { id: 'cos-2', category: 'Chief of Staff', name: 'Board Meeting Prep', description: 'Prepare materials, agendas, and follow-up actions for board meetings', hours: 15, frequency: 'Monthly' },
  { id: 'cos-3', category: 'Chief of Staff', name: 'Strategic Project Tracking', description: 'Monitor company initiatives, update stakeholders, ensure alignment', hours: 25, frequency: 'Weekly' },
  { id: 'cos-4', category: 'Chief of Staff', name: 'Internal Communications', description: 'Draft memos, all-hands content, and executive communications', hours: 10, frequency: 'Weekly' },
  { id: 'cos-5', category: 'Chief of Staff', name: 'Stakeholder Relations', description: 'Coordinate with investors, partners, and key stakeholders', hours: 15, frequency: 'Bi-weekly' },

  // Technical Ops
  { id: 'tech-1', category: 'Technical Ops', name: 'System Monitoring', description: 'Monitor infrastructure, respond to alerts, maintain uptime', hours: 30, frequency: 'Daily' },
  { id: 'tech-2', category: 'Technical Ops', name: 'DevOps Support', description: 'CI/CD pipeline management, deployment automation', hours: 25, frequency: 'Daily' },
  { id: 'tech-3', category: 'Technical Ops', name: 'Security Audits', description: 'Regular security checks, vulnerability assessments', hours: 20, frequency: 'Weekly' },
  { id: 'tech-4', category: 'Technical Ops', name: 'Database Management', description: 'Backup management, query optimization, maintenance', hours: 15, frequency: 'Weekly' },
  { id: 'tech-5', category: 'Technical Ops', name: 'Documentation Updates', description: 'Keep technical docs current, API documentation', hours: 10, frequency: 'Weekly' },
  { id: 'tech-6', category: 'Technical Ops', name: 'Incident Response', description: 'Handle technical incidents, root cause analysis', hours: 20, frequency: 'As needed' },

  // Paralegal
  { id: 'legal-1', category: 'Paralegal', name: 'Contract Review', description: 'Review vendor contracts, NDAs, and legal agreements', hours: 20, frequency: 'Weekly' },
  { id: 'legal-2', category: 'Paralegal', name: 'Compliance Monitoring', description: 'Track regulatory requirements, filing deadlines', hours: 15, frequency: 'Monthly' },
  { id: 'legal-3', category: 'Paralegal', name: 'Document Management', description: 'Organize legal files, maintain document repository', hours: 10, frequency: 'Weekly' },
  { id: 'legal-4', category: 'Paralegal', name: 'IP Management', description: 'Track trademarks, patents, copyright registrations', hours: 12, frequency: 'Monthly' },
  { id: 'legal-5', category: 'Paralegal', name: 'Legal Research', description: 'Research case law, regulations, and precedents', hours: 15, frequency: 'As needed' },

  // Finance
  { id: 'finance-1', category: 'Finance', name: 'Accounts Payable', description: 'Process invoices, vendor payments, expense tracking', hours: 20, frequency: 'Weekly' },
  { id: 'finance-2', category: 'Finance', name: 'Accounts Receivable', description: 'Invoice customers, track payments, collections', hours: 20, frequency: 'Weekly' },
  { id: 'finance-3', category: 'Finance', name: 'Financial Reporting', description: 'Monthly P&L, cash flow statements, variance analysis', hours: 15, frequency: 'Monthly' },
  { id: 'finance-4', category: 'Finance', name: 'Budget Tracking', description: 'Monitor departmental budgets, spending alerts', hours: 10, frequency: 'Weekly' },
  { id: 'finance-5', category: 'Finance', name: 'Payroll Processing', description: 'Process payroll, benefits administration', hours: 15, frequency: 'Bi-weekly' },
  { id: 'finance-6', category: 'Finance', name: 'Tax Preparation Support', description: 'Organize documents, coordinate with accountants', hours: 20, frequency: 'Quarterly' },

  // Customer Service
  { id: 'cs-1', category: 'Customer Service', name: 'Tier 1 Support', description: 'Handle customer inquiries, basic troubleshooting', hours: 40, frequency: 'Daily' },
  { id: 'cs-2', category: 'Customer Service', name: 'Escalation Management', description: 'Manage escalated issues, customer recovery', hours: 15, frequency: 'Daily' },
  { id: 'cs-3', category: 'Customer Service', name: 'Knowledge Base Management', description: 'Maintain help center, create FAQs', hours: 10, frequency: 'Weekly' },
  { id: 'cs-4', category: 'Customer Service', name: 'Customer Onboarding', description: 'Guide new customers through setup and training', hours: 20, frequency: 'Weekly' },
  { id: 'cs-5', category: 'Customer Service', name: 'Feedback Collection', description: 'Gather customer feedback, satisfaction surveys', hours: 10, frequency: 'Monthly' },
  { id: 'cs-6', category: 'Customer Service', name: 'Churn Prevention', description: 'Identify at-risk customers, retention outreach', hours: 15, frequency: 'Weekly' }
];

const AGENTS = [
  { id: 'agent-1', name: 'Sarah Chen', clients: 3, maxClients: 10, satisfaction: 4.9, responseTime: '2.3 hrs', grain: 45680, expertise: ['Technical Ops', 'Chief of Staff'], avatar: 'SC' },
  { id: 'agent-2', name: 'Marcus Johnson', clients: 5, maxClients: 10, satisfaction: 4.8, responseTime: '3.1 hrs', grain: 38950, expertise: ['Finance', 'Paralegal'], avatar: 'MJ' },
  { id: 'agent-3', name: 'Elena Rodriguez', clients: 4, maxClients: 10, satisfaction: 4.9, responseTime: '1.8 hrs', grain: 52340, expertise: ['Customer Service', 'Chief of Staff'], avatar: 'ER' },
  { id: 'agent-4', name: 'David Park', clients: 6, maxClients: 10, satisfaction: 4.7, responseTime: '2.9 hrs', grain: 41200, expertise: ['Technical Ops', 'Finance'], avatar: 'DP' },
  { id: 'agent-5', name: 'Aisha Patel', clients: 2, maxClients: 10, satisfaction: 5.0, responseTime: '1.5 hrs', grain: 48920, expertise: ['Paralegal', 'Finance'], avatar: 'AP' },
  { id: 'agent-6', name: 'James Wilson', clients: 7, maxClients: 10, satisfaction: 4.6, responseTime: '3.5 hrs', grain: 35780, expertise: ['Customer Service', 'Technical Ops'], avatar: 'JW' },
  { id: 'agent-7', name: 'Priya Sharma', clients: 3, maxClients: 10, satisfaction: 4.8, responseTime: '2.1 hrs', grain: 44560, expertise: ['Chief of Staff', 'Paralegal'], avatar: 'PS' },
  { id: 'agent-8', name: 'Alex Thompson', clients: 4, maxClients: 10, satisfaction: 4.9, responseTime: '2.4 hrs', grain: 47230, expertise: ['Finance', 'Customer Service'], avatar: 'AT' },
  { id: 'agent-9', name: 'Maya Nguyen', clients: 5, maxClients: 10, satisfaction: 4.7, responseTime: '2.8 hrs', grain: 39840, expertise: ['Technical Ops', 'Chief of Staff'], avatar: 'MN' },
  { id: 'agent-10', name: 'Omar Hassan', clients: 2, maxClients: 10, satisfaction: 5.0, responseTime: '1.6 hrs', grain: 51200, expertise: ['Paralegal', 'Customer Service'], avatar: 'OH' },
  { id: 'agent-11', name: 'Sophie Martinez', clients: 6, maxClients: 10, satisfaction: 4.8, responseTime: '2.6 hrs', grain: 42890, expertise: ['Finance', 'Technical Ops'], avatar: 'SM' },
  { id: 'agent-12', name: 'Lucas Kim', clients: 3, maxClients: 10, satisfaction: 4.9, responseTime: '2.0 hrs', grain: 46770, expertise: ['Customer Service', 'Chief of Staff'], avatar: 'LK' },
  { id: 'agent-13', name: 'Isabella Costa', clients: 4, maxClients: 10, satisfaction: 4.8, responseTime: '2.5 hrs', grain: 43650, expertise: ['Chief of Staff', 'Finance'], avatar: 'IC' },
  { id: 'agent-14', name: 'Ryan O\'Brien', clients: 5, maxClients: 10, satisfaction: 4.7, responseTime: '3.0 hrs', grain: 38420, expertise: ['Technical Ops', 'Paralegal'], avatar: 'RO' },
  { id: 'agent-15', name: 'Zara Ahmed', clients: 2, maxClients: 10, satisfaction: 5.0, responseTime: '1.7 hrs', grain: 49580, expertise: ['Customer Service', 'Finance'], avatar: 'ZA' }
];

const INTEGRATIONS = [
  { id: 'slack', name: 'Slack', category: 'Communication', icon: '💬', connected: false },
  { id: 'teams', name: 'Microsoft Teams', category: 'Communication', icon: '👥', connected: false },
  { id: 'gmail', name: 'Gmail', category: 'Email', icon: '📧', connected: false },
  { id: 'outlook', name: 'Outlook', category: 'Email', icon: '📨', connected: false },
  { id: 'jira', name: 'Jira', category: 'Project Management', icon: '📋', connected: false },
  { id: 'linear', name: 'Linear', category: 'Project Management', icon: '📐', connected: false },
  { id: 'asana', name: 'Asana', category: 'Project Management', icon: '✅', connected: false },
  { id: 'salesforce', name: 'Salesforce', category: 'CRM', icon: '☁️', connected: false },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', icon: '🎯', connected: false },
  { id: 'google-cal', name: 'Google Calendar', category: 'Calendar', icon: '📅', connected: false },
  { id: 'outlook-cal', name: 'Outlook Calendar', category: 'Calendar', icon: '🗓️', connected: false },
  { id: 'custom-api', name: 'Custom API', category: 'Custom', icon: '🔌', connected: false }
];

interface ClientData {
  // Step 1
  companyName: string;
  industry: string;
  contactName: string;
  contactEmail: string;
  companySize: string;
  monthlyBudget: string;
  specialRequirements: string;

  // Step 2
  package: string;
  customPrice?: number;

  // Step 3
  selectedSOPs: string[];

  // Step 4
  assignedAgent: string;

  // Step 5
  integrations: string[];

  // Step 6
  termsAccepted: boolean;
}

export default function OnboardClientPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [clientData, setClientData] = useState<ClientData>({
    companyName: '',
    industry: '',
    contactName: '',
    contactEmail: '',
    companySize: '',
    monthlyBudget: '',
    specialRequirements: '',
    package: '',
    selectedSOPs: [],
    assignedAgent: '',
    integrations: [],
    termsAccepted: false
  });

  const totalSteps = 6;
  const progressPercentage = (currentStep / totalSteps) * 100;

  // Validation functions
  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!clientData.companyName) newErrors.companyName = 'Company name is required';
      if (!clientData.industry) newErrors.industry = 'Industry is required';
      if (!clientData.contactName) newErrors.contactName = 'Contact name is required';
      if (!clientData.contactEmail) {
        newErrors.contactEmail = 'Contact email is required';
      } else if (!validateEmail(clientData.contactEmail)) {
        newErrors.contactEmail = 'Invalid email format';
      }
      if (!clientData.companySize) newErrors.companySize = 'Company size is required';
      if (!clientData.monthlyBudget) {
        newErrors.monthlyBudget = 'Monthly budget is required';
      } else {
        const budget = parseFloat(clientData.monthlyBudget);
        if (budget < 2000) newErrors.monthlyBudget = 'Minimum budget is $2,000';
        if (budget > 1000000) newErrors.monthlyBudget = 'Maximum budget is $1,000,000';
      }
    }

    if (step === 2) {
      if (!clientData.package) newErrors.package = 'Please select a package';
    }

    if (step === 3) {
      if (clientData.selectedSOPs.length === 0) {
        newErrors.sops = 'Please select at least one SOP';
      }
      const selectedPackage = PACKAGES.find(p => p.id === clientData.package);
      if (selectedPackage && selectedPackage.sops > 0 && clientData.selectedSOPs.length > selectedPackage.sops) {
        newErrors.sops = `You can select up to ${selectedPackage.sops} SOPs with this package`;
      }
    }

    if (step === 4) {
      if (!clientData.assignedAgent) newErrors.agent = 'Please assign an agent';
      const agent = AGENTS.find(a => a.id === clientData.assignedAgent);
      if (agent && agent.clients >= agent.maxClients) {
        newErrors.agent = 'This agent is at capacity';
      }
    }

    if (step === 6) {
      if (!clientData.termsAccepted) newErrors.terms = 'Please accept the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    // Mock save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    alert('Draft saved successfully!');
  };

  const handleLaunchClient = async () => {
    if (!validateStep(6)) return;

    setIsSaving(true);
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSaving(false);

    // Show success and redirect
    alert(`Client ${clientData.companyName} launched successfully!`);
    router.push('/ai-ops/management');
  };

  const getRecommendedAgent = () => {
    const sopCategories = clientData.selectedSOPs.map(sopId => {
      const sop = SOP_TEMPLATES.find(s => s.id === sopId);
      return sop?.category;
    }).filter(Boolean);

    // Find agent with matching expertise, low workload, and high satisfaction
    return AGENTS
      .filter(agent => agent.clients < agent.maxClients)
      .map(agent => {
        const expertiseMatch = sopCategories.filter(cat =>
          agent.expertise.includes(cat as string)
        ).length;
        const workloadScore = (agent.maxClients - agent.clients) / agent.maxClients;
        const satisfactionScore = agent.satisfaction / 5;
        const score = expertiseMatch * 2 + workloadScore + satisfactionScore;
        return { ...agent, score };
      })
      .sort((a, b) => b.score - a.score)[0];
  };

  const calculateEstimatedBill = () => {
    const pkg = PACKAGES.find(p => p.id === clientData.package);
    if (!pkg) return 0;
    if (pkg.id === 'custom' && clientData.customPrice) return clientData.customPrice;
    return pkg.price;
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep6();
      default:
        return null;
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Client Information</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={clientData.companyName}
            onChange={(e) => setClientData({ ...clientData, companyName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Acme Corporation"
          />
          {errors.companyName && <p className="text-red-500 text-sm mt-1">{errors.companyName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Industry <span className="text-red-500">*</span>
          </label>
          <select
            value={clientData.industry}
            onChange={(e) => setClientData({ ...clientData, industry: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Select industry...</option>
            {INDUSTRIES.map(industry => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>
          {errors.industry && <p className="text-red-500 text-sm mt-1">{errors.industry}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Primary Contact Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={clientData.contactName}
            onChange={(e) => setClientData({ ...clientData, contactName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="John Smith"
          />
          {errors.contactName && <p className="text-red-500 text-sm mt-1">{errors.contactName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contact Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={clientData.contactEmail}
            onChange={(e) => setClientData({ ...clientData, contactEmail: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="john@acme.com"
          />
          {errors.contactEmail && <p className="text-red-500 text-sm mt-1">{errors.contactEmail}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Size <span className="text-red-500">*</span>
          </label>
          <select
            value={clientData.companySize}
            onChange={(e) => setClientData({ ...clientData, companySize: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Select size...</option>
            <option value="1-10">1-10 employees</option>
            <option value="11-50">11-50 employees</option>
            <option value="51-200">51-200 employees</option>
            <option value="201-500">201-500 employees</option>
            <option value="501-1000">501-1000 employees</option>
            <option value="1000+">1000+ employees</option>
          </select>
          {errors.companySize && <p className="text-red-500 text-sm mt-1">{errors.companySize}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Monthly Budget <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-2.5 text-gray-500">$</span>
            <input
              type="number"
              value={clientData.monthlyBudget}
              onChange={(e) => setClientData({ ...clientData, monthlyBudget: e.target.value })}
              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="5000"
              min="2000"
              max="1000000"
            />
          </div>
          {errors.monthlyBudget && <p className="text-red-500 text-sm mt-1">{errors.monthlyBudget}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Special Requirements
        </label>
        <textarea
          value={clientData.specialRequirements}
          onChange={(e) => setClientData({ ...clientData, specialRequirements: e.target.value })}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Any specific needs, preferences, or requirements..."
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Select Package</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PACKAGES.map(pkg => (
          <div
            key={pkg.id}
            onClick={() => setClientData({ ...clientData, package: pkg.id })}
            className={`p-6 border-2 rounded-xl cursor-pointer transition-all ${
              clientData.package === pkg.id
                ? 'border-purple-500 bg-purple-50 shadow-lg'
                : 'border-gray-200 hover:border-purple-300'
            }`}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
            {pkg.id !== 'custom' && (
              <div className="mb-4">
                <span className="text-3xl font-bold text-purple-600">${pkg.price.toLocaleString()}</span>
                <span className="text-gray-500">/mo</span>
              </div>
            )}

            <ul className="space-y-2 mb-4">
              {pkg.features.map((feature, idx) => (
                <li key={idx} className="flex items-start text-sm text-gray-600">
                  <span className="text-green-500 mr-2">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            {pkg.id === 'custom' && clientData.package === 'custom' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input
                    type="number"
                    value={clientData.customPrice || ''}
                    onChange={(e) => setClientData({ ...clientData, customPrice: parseFloat(e.target.value) })}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="10000"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {errors.package && <p className="text-red-500 text-sm">{errors.package}</p>}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Package Comparison</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-blue-200">
                <th className="text-left py-2 px-4">Feature</th>
                {PACKAGES.filter(p => p.id !== 'custom').map(pkg => (
                  <th key={pkg.id} className="text-center py-2 px-4">{pkg.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-blue-100">
                <td className="py-2 px-4">SOPs Included</td>
                {PACKAGES.filter(p => p.id !== 'custom').map(pkg => (
                  <td key={pkg.id} className="text-center py-2 px-4">{pkg.sops === -1 ? 'Unlimited' : pkg.sops}</td>
                ))}
              </tr>
              <tr className="border-b border-blue-100">
                <td className="py-2 px-4">Monthly Hours</td>
                {PACKAGES.filter(p => p.id !== 'custom').map(pkg => (
                  <td key={pkg.id} className="text-center py-2 px-4">{pkg.hours === -1 ? 'Unlimited' : pkg.hours}</td>
                ))}
              </tr>
              <tr className="border-b border-blue-100">
                <td className="py-2 px-4">Support Level</td>
                <td className="text-center py-2 px-4">Email</td>
                <td className="text-center py-2 px-4">Priority</td>
                <td className="text-center py-2 px-4">24/7 Dedicated</td>
              </tr>
              <tr>
                <td className="py-2 px-4">Custom SOPs</td>
                <td className="text-center py-2 px-4">-</td>
                <td className="text-center py-2 px-4">-</td>
                <td className="text-center py-2 px-4">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => {
    const selectedPackage = PACKAGES.find(p => p.id === clientData.package);
    const categories = Array.from(new Set(SOP_TEMPLATES.map(s => s.category)));

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Choose SOPs</h2>
          <div className="text-sm text-gray-600">
            Selected: {clientData.selectedSOPs.length}
            {selectedPackage && selectedPackage.sops > 0 && ` / ${selectedPackage.sops}`}
          </div>
        </div>

        {errors.sops && <p className="text-red-500 text-sm">{errors.sops}</p>}

        <div className="space-y-6">
          {categories.map(category => {
            const categorySOPs = SOP_TEMPLATES.filter(s => s.category === category);

            return (
              <div key={category}>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  {category === 'Chief of Staff' && '👔'}
                  {category === 'Technical Ops' && '⚙️'}
                  {category === 'Paralegal' && '⚖️'}
                  {category === 'Finance' && '💰'}
                  {category === 'Customer Service' && '🎧'}
                  <span className="ml-2">{category}</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categorySOPs.map(sop => {
                    const isSelected = clientData.selectedSOPs.includes(sop.id);
                    const canSelect = selectedPackage && (
                      selectedPackage.sops === -1 ||
                      clientData.selectedSOPs.length < selectedPackage.sops ||
                      isSelected
                    );

                    return (
                      <div
                        key={sop.id}
                        onClick={() => {
                          if (canSelect) {
                            setClientData({
                              ...clientData,
                              selectedSOPs: isSelected
                                ? clientData.selectedSOPs.filter(id => id !== sop.id)
                                : [...clientData.selectedSOPs, sop.id]
                            });
                          }
                        }}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50'
                            : canSelect
                            ? 'border-gray-200 hover:border-purple-300'
                            : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-gray-900 text-sm flex-1">{sop.name}</h4>
                          {isSelected && (
                            <span className="text-purple-500 ml-2">✓</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mb-3">{sop.description}</p>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{sop.hours} hrs/mo</span>
                          <span>{sop.frequency}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-900 mb-2">Custom SOP</h4>
          <p className="text-sm text-purple-700 mb-3">
            Need a custom SOP? Our team can create a tailored workflow for your specific needs.
          </p>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm">
            Request Custom SOP
          </button>
        </div>
      </div>
    );
  };

  const renderStep4 = () => {
    const recommendedAgent = getRecommendedAgent();
    const [expertiseFilter, setExpertiseFilter] = useState<string>('');

    const filteredAgents = expertiseFilter
      ? AGENTS.filter(a => a.expertise.includes(expertiseFilter))
      : AGENTS;

    const availableAgents = filteredAgents.filter(a => a.clients < a.maxClients);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Assign Agent</h2>
          <select
            value={expertiseFilter}
            onChange={(e) => setExpertiseFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Expertise Areas</option>
            <option value="Chief of Staff">Chief of Staff</option>
            <option value="Technical Ops">Technical Ops</option>
            <option value="Paralegal">Paralegal</option>
            <option value="Finance">Finance</option>
            <option value="Customer Service">Customer Service</option>
          </select>
        </div>

        {errors.agent && <p className="text-red-500 text-sm">{errors.agent}</p>}

        {recommendedAgent && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-green-900 mb-1">Recommended Agent</h4>
                <p className="text-sm text-green-700">
                  {recommendedAgent.name} - Best match based on expertise and availability
                </p>
              </div>
              <button
                onClick={() => setClientData({ ...clientData, assignedAgent: recommendedAgent.id })}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Auto-Assign
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableAgents.map(agent => {
            const isSelected = clientData.assignedAgent === agent.id;
            const workloadPercentage = (agent.clients / agent.maxClients) * 100;

            return (
              <div
                key={agent.id}
                onClick={() => setClientData({ ...clientData, assignedAgent: agent.id })}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50 shadow-lg'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold mr-3">
                      {agent.avatar}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{agent.name}</h4>
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="text-yellow-500 mr-1">★</span>
                        {agent.satisfaction}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-purple-500 text-xl">✓</span>
                  )}
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Workload:</span>
                    <span className="font-medium">{agent.clients}/{agent.maxClients} clients</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        workloadPercentage < 50 ? 'bg-green-500' :
                        workloadPercentage < 80 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${workloadPercentage}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Response Time:</span>
                    <span className="font-medium">{agent.responseTime}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>GRAIN Earned:</span>
                    <span className="font-medium">{agent.grain.toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1">Expertise:</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.expertise.map(exp => (
                      <span
                        key={exp}
                        className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
                      >
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {availableAgents.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No agents available with the selected expertise.</p>
            <button
              onClick={() => setExpertiseFilter('')}
              className="mt-4 text-purple-600 hover:underline"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderStep5 = () => {
    const [integrationStates, setIntegrationStates] = useState(
      INTEGRATIONS.reduce((acc, int) => ({ ...acc, [int.id]: int.connected }), {} as Record<string, boolean>)
    );

    const [testingConnection, setTestingConnection] = useState<string | null>(null);

    const handleConnect = async (integrationId: string) => {
      setTestingConnection(integrationId);
      // Mock OAuth flow
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIntegrationStates({ ...integrationStates, [integrationId]: true });
      if (!clientData.integrations.includes(integrationId)) {
        setClientData({
          ...clientData,
          integrations: [...clientData.integrations, integrationId]
        });
      }
      setTestingConnection(null);
    };

    const handleDisconnect = (integrationId: string) => {
      setIntegrationStates({ ...integrationStates, [integrationId]: false });
      setClientData({
        ...clientData,
        integrations: clientData.integrations.filter(id => id !== integrationId)
      });
    };

    const categories = Array.from(new Set(INTEGRATIONS.map(i => i.category)));

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Tech Stack Integration</h2>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Connect your tools to enable seamless workflow automation. You can add more integrations later.
          </p>
        </div>

        <div className="space-y-6">
          {categories.map(category => {
            const categoryIntegrations = INTEGRATIONS.filter(i => i.category === category);

            return (
              <div key={category}>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">{category}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryIntegrations.map(integration => {
                    const isConnected = integrationStates[integration.id];
                    const isTesting = testingConnection === integration.id;

                    return (
                      <div
                        key={integration.id}
                        className={`p-4 border-2 rounded-lg transition-all ${
                          isConnected
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center">
                            <span className="text-3xl mr-3">{integration.icon}</span>
                            <div>
                              <h4 className="font-semibold text-gray-900">{integration.name}</h4>
                              <p className="text-xs text-gray-500">{integration.category}</p>
                            </div>
                          </div>
                          {isConnected && (
                            <span className="text-green-500">✓</span>
                          )}
                        </div>

                        {isConnected ? (
                          <div className="space-y-2">
                            <div className="flex items-center text-sm text-green-700">
                              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                              Connected
                            </div>
                            <button
                              onClick={() => handleDisconnect(integration.id)}
                              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleConnect(integration.id)}
                            disabled={isTesting}
                            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:bg-gray-400"
                          >
                            {isTesting ? 'Connecting...' : 'Connect'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-900 mb-2">Custom API Integration</h4>
          <p className="text-sm text-purple-700 mb-3">
            Need to integrate with a custom system? Our team can help set up API connections.
          </p>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm">
            Request Custom Integration
          </button>
        </div>

        <div className="text-center text-sm text-gray-500">
          {clientData.integrations.length} integration{clientData.integrations.length !== 1 ? 's' : ''} connected
        </div>
      </div>
    );
  };

  const renderStep6 = () => {
    const selectedPackage = PACKAGES.find(p => p.id === clientData.package);
    const selectedAgent = AGENTS.find(a => a.id === clientData.assignedAgent);
    const selectedSOPs = SOP_TEMPLATES.filter(s => clientData.selectedSOPs.includes(s.id));
    const connectedIntegrations = INTEGRATIONS.filter(i => clientData.integrations.includes(i.id));
    const estimatedBill = calculateEstimatedBill();

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Review & Launch</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Client Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">🏢</span>
              Client Information
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Company:</dt>
                <dd className="font-medium text-gray-900">{clientData.companyName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Industry:</dt>
                <dd className="font-medium text-gray-900">{clientData.industry}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Contact:</dt>
                <dd className="font-medium text-gray-900">{clientData.contactName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Email:</dt>
                <dd className="font-medium text-gray-900">{clientData.contactEmail}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Size:</dt>
                <dd className="font-medium text-gray-900">{clientData.companySize}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Budget:</dt>
                <dd className="font-medium text-gray-900">${parseFloat(clientData.monthlyBudget).toLocaleString()}/mo</dd>
              </div>
            </dl>
            {clientData.specialRequirements && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-600 mb-1">Special Requirements:</p>
                <p className="text-sm text-gray-800">{clientData.specialRequirements}</p>
              </div>
            )}
          </div>

          {/* Package */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">📦</span>
              Package
            </h3>
            {selectedPackage && (
              <div>
                <div className="mb-4">
                  <h4 className="text-xl font-bold text-purple-600">{selectedPackage.name}</h4>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ${selectedPackage.id === 'custom' && clientData.customPrice
                      ? clientData.customPrice.toLocaleString()
                      : selectedPackage.price.toLocaleString()}
                    <span className="text-sm text-gray-500">/month</span>
                  </p>
                </div>
                <ul className="space-y-2">
                  {selectedPackage.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start text-sm text-gray-600">
                      <span className="text-green-500 mr-2">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Assigned Agent */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">👤</span>
              Assigned Agent
            </h3>
            {selectedAgent && (
              <div>
                <div className="flex items-center mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4">
                    {selectedAgent.avatar}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-lg">{selectedAgent.name}</h4>
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="text-yellow-500 mr-1">★</span>
                      {selectedAgent.satisfaction} satisfaction
                    </div>
                  </div>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Current Load:</dt>
                    <dd className="font-medium text-gray-900">{selectedAgent.clients}/{selectedAgent.maxClients} clients</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Response Time:</dt>
                    <dd className="font-medium text-gray-900">{selectedAgent.responseTime}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">GRAIN Earned:</dt>
                    <dd className="font-medium text-gray-900">{selectedAgent.grain.toLocaleString()}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <p className="text-xs text-gray-600 mb-2">Expertise:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAgent.expertise.map(exp => (
                      <span key={exp} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected SOPs */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">📋</span>
              Selected SOPs ({selectedSOPs.length})
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {selectedSOPs.map(sop => (
                <div key={sop.id} className="pb-3 border-b border-gray-100 last:border-0">
                  <h4 className="font-medium text-gray-900 text-sm">{sop.name}</h4>
                  <p className="text-xs text-gray-600 mt-1">{sop.description}</p>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>{sop.category}</span>
                    <span>{sop.hours} hrs/mo</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Integrations */}
        {connectedIntegrations.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">🔌</span>
              Connected Integrations ({connectedIntegrations.length})
            </h3>
            <div className="flex flex-wrap gap-3">
              {connectedIntegrations.map(integration => (
                <div key={integration.id} className="flex items-center px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-xl mr-2">{integration.icon}</span>
                  <span className="text-sm font-medium text-gray-900">{integration.name}</span>
                  <span className="ml-2 text-green-500">✓</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Billing Summary */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-900 mb-4">Billing Summary</h3>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-gray-700">
              <span>Monthly Subscription</span>
              <span className="font-medium">${estimatedBill.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Setup Fee</span>
              <span className="font-medium">$0</span>
            </div>
            <div className="border-t border-purple-300 pt-2 mt-2">
              <div className="flex justify-between text-lg font-bold text-purple-900">
                <span>First Bill</span>
                <span>${estimatedBill.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-purple-700">
            Billing starts immediately. First invoice will be sent to {clientData.contactEmail}
          </p>
        </div>

        {/* Terms and Conditions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <label className="flex items-start cursor-pointer">
            <input
              type="checkbox"
              checked={clientData.termsAccepted}
              onChange={(e) => setClientData({ ...clientData, termsAccepted: e.target.checked })}
              className="mt-1 mr-3 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <div>
              <span className="text-sm text-gray-900">
                I agree to the <a href="#" className="text-purple-600 hover:underline">Terms of Service</a> and{' '}
                <a href="#" className="text-purple-600 hover:underline">Privacy Policy</a>
              </span>
              <p className="text-xs text-gray-600 mt-1">
                By checking this box, you confirm that you have authority to bind {clientData.companyName} to these terms and authorize Wells Onyx to begin service delivery.
              </p>
            </div>
          </label>
          {errors.terms && <p className="text-red-500 text-sm mt-2">{errors.terms}</p>}
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 mb-3">What happens next?</h4>
          <ol className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="font-bold mr-2">1.</span>
              <span>Client account will be created and credentials sent to {clientData.contactEmail}</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">2.</span>
              <span>{selectedAgent?.name} will reach out within 24 hours for kickoff call</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">3.</span>
              <span>SOPs will be configured and workflows automated</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">4.</span>
              <span>Service begins immediately upon launch</span>
            </li>
          </ol>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Onboard New Client</h1>
          <p className="text-gray-600">Complete all steps to launch a new AI Ops client</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                    step < currentStep
                      ? 'bg-green-500 text-white'
                      : step === currentStep
                      ? 'bg-purple-600 text-white ring-4 ring-purple-200'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step < currentStep ? '✓' : step}
                </div>
                {step < 6 && (
                  <div
                    className={`w-12 h-1 mx-2 transition-all ${
                      step < currentStep ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Client Info</span>
            <span>Package</span>
            <span>SOPs</span>
            <span>Agent</span>
            <span>Integrations</span>
            <span>Review</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div>
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="px-6 py-3 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>

            {currentStep < totalSteps ? (
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleLaunchClient}
                disabled={isSaving}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50"
              >
                {isSaving ? 'Launching...' : '🚀 Launch Client'}
              </button>
            )}
          </div>
        </div>

        {/* Management-only notice */}
        <div className="mt-6 text-center text-sm text-gray-500">
          🔒 Management only - @wellsonyx.com authentication required
        </div>
      </div>
    </div>
  );
}
