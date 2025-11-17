// Mock data for prototype

import { Supplier, RFQ, Deal, User, TierLimits } from '../types';

export const TIER_LIMITS: TierLimits = {
  free: {
    searchesPerMonth: 10,
    rfqsPerMonth: 2,
    dealsLimit: 5,
    features: ['Basic Search', 'AI Chat (Limited)', '2 RFQs/month', 'Basic Pipeline'],
  },
  pro: {
    searchesPerMonth: -1, // unlimited
    rfqsPerMonth: -1,
    dealsLimit: -1,
    features: ['Unlimited Searches', 'Advanced AI Chat', 'Unlimited RFQs', 'Full Pipeline', 'API Access', 'Priority Support'],
  },
};

export const MOCK_USER: User = {
  id: '1',
  email: 'demo@wellsonyx.com',
  name: 'Demo User',
  tier: 'free',
  searchesRemaining: 7,
  maxSearches: 10,
};

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: '1',
    name: 'Precision Manufacturing Co.',
    category: 'CNC Machining',
    description: 'High-precision CNC machining for aerospace and medical devices',
    location: 'California, USA',
    certifications: ['ISO 9001', 'AS9100', 'FDA Registered'],
    rating: 4.8,
    responseTime: '< 2 hours',
    minOrder: '$5,000',
    capabilities: ['5-axis CNC', 'Titanium machining', 'Quality inspection'],
    verified: true,
  },
  {
    id: '2',
    name: 'Global Logistics Partners',
    category: 'Logistics & Shipping',
    description: 'End-to-end supply chain solutions with global reach',
    location: 'Singapore',
    certifications: ['ISO 28000', 'C-TPAT'],
    rating: 4.6,
    responseTime: '< 4 hours',
    minOrder: '$2,000',
    capabilities: ['Air freight', 'Ocean freight', 'Customs clearance', 'Warehousing'],
    verified: true,
  },
  {
    id: '3',
    name: 'EcoPackaging Solutions',
    category: 'Packaging',
    description: 'Sustainable packaging materials and custom designs',
    location: 'Oregon, USA',
    certifications: ['FSC Certified', 'Cradle to Cradle'],
    rating: 4.9,
    responseTime: '< 1 hour',
    minOrder: '$1,000',
    capabilities: ['Custom design', 'Biodegradable materials', 'Rapid prototyping'],
    verified: true,
  },
  {
    id: '4',
    name: 'TechComponents Ltd',
    category: 'Electronics',
    description: 'PCB manufacturing and electronic component assembly',
    location: 'Shenzhen, China',
    certifications: ['ISO 9001', 'IPC-A-610', 'RoHS'],
    rating: 4.5,
    responseTime: '< 6 hours',
    minOrder: '$3,000',
    capabilities: ['PCB assembly', 'SMT', 'Testing', 'Component sourcing'],
    verified: false,
  },
  {
    id: '5',
    name: 'Industrial Metals Group',
    category: 'Raw Materials',
    description: 'Premium metals and alloys for manufacturing',
    location: 'Texas, USA',
    certifications: ['ISO 9001', 'ASTM Certified'],
    rating: 4.7,
    responseTime: '< 3 hours',
    minOrder: '$10,000',
    capabilities: ['Steel', 'Aluminum', 'Specialty alloys', 'Custom cutting'],
    verified: true,
  },
];

export const MOCK_RFQS: RFQ[] = [
  {
    id: '1',
    title: 'Custom aluminum parts for drone assembly',
    category: 'CNC Machining',
    description: 'Need 500 precision-machined aluminum parts for commercial drones',
    quantity: 500,
    budget: '$25,000',
    deadline: '2024-02-15',
    status: 'active',
    responses: 12,
    createdAt: '2024-01-10',
  },
  {
    id: '2',
    title: 'Sustainable packaging for consumer products',
    category: 'Packaging',
    description: 'Biodegradable packaging solution for new product line launch',
    quantity: 10000,
    budget: '$15,000',
    deadline: '2024-02-01',
    status: 'active',
    responses: 8,
    createdAt: '2024-01-08',
  },
];

export const MOCK_DEALS: Deal[] = [
  {
    id: '1',
    title: 'Precision Parts Contract',
    supplier: 'Precision Manufacturing Co.',
    value: '$125,000',
    stage: 'negotiation',
    probability: 75,
    nextAction: 'Review final proposal',
    dueDate: '2024-01-25',
  },
  {
    id: '2',
    title: 'Packaging Supply Agreement',
    supplier: 'EcoPackaging Solutions',
    value: '$45,000',
    stage: 'proposal',
    probability: 60,
    nextAction: 'Schedule demo call',
    dueDate: '2024-01-20',
  },
  {
    id: '3',
    title: 'Logistics Partnership',
    supplier: 'Global Logistics Partners',
    value: '$200,000',
    stage: 'qualified',
    probability: 40,
    nextAction: 'Send RFQ',
    dueDate: '2024-02-01',
  },
];

export const MOCK_CATEGORIES = [
  'CNC Machining',
  'Logistics & Shipping',
  'Packaging',
  'Electronics',
  'Raw Materials',
  'Injection Molding',
  'Assembly',
  'Quality Control',
  'Consulting',
];

export const MOCK_CERTIFICATIONS = [
  'ISO 9001',
  'AS9100',
  'ISO 14001',
  'ISO 28000',
  'FSC Certified',
  'FDA Registered',
  'RoHS',
  'C-TPAT',
];
