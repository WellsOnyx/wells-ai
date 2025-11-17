// Core type definitions for Wells AI Mini App

export type UserTier = 'free' | 'pro';

export interface User {
  id: string;
  email: string;
  name: string;
  tier: UserTier;
  searchesRemaining: number;
  maxSearches: number;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  certifications: string[];
  rating: number;
  responseTime: string;
  minOrder: string;
  capabilities: string[];
  verified: boolean;
}

export interface RFQ {
  id: string;
  title: string;
  category: string;
  description: string;
  quantity: number;
  budget: string;
  deadline: string;
  status: 'draft' | 'active' | 'closed';
  responses: number;
  createdAt: string;
}

export interface Deal {
  id: string;
  title: string;
  supplier: string;
  value: string;
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed';
  probability: number;
  nextAction: string;
  dueDate: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestions?: string[];
}

export interface SearchFilters {
  category?: string;
  location?: string;
  certifications?: string[];
  minRating?: number;
  verified?: boolean;
}

export interface TierLimits {
  free: {
    searchesPerMonth: number;
    rfqsPerMonth: number;
    dealsLimit: number;
    features: string[];
  };
  pro: {
    searchesPerMonth: number;
    rfqsPerMonth: number;
    dealsLimit: number;
    features: string[];
  };
}
