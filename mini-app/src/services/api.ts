// Mock API client for Wells AI backend
// In production, this would make actual HTTP requests

import { ChatMessage, Supplier, RFQ, Deal, SearchFilters } from '../types';
import { MOCK_SUPPLIERS, MOCK_RFQS, MOCK_DEALS } from '../mock/data';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class APIClient {
  private baseURL = 'https://api.wellsonyx.com';

  // Chat API
  async sendChatMessage(message: string, conversationId?: string): Promise<ChatMessage> {
    await delay(800);

    // Mock AI response based on keywords
    let response = "I can help you find the perfect supplier. What are you looking for?";
    let suggestions: string[] = [];

    if (message.toLowerCase().includes('cnc') || message.toLowerCase().includes('machining')) {
      response = "I found several excellent CNC machining suppliers. Precision Manufacturing Co. has top ratings for aerospace parts. Would you like to see their details?";
      suggestions = ['Show Precision Manufacturing', 'Compare prices', 'Request quote'];
    } else if (message.toLowerCase().includes('packaging')) {
      response = "For sustainable packaging, I recommend EcoPackaging Solutions. They're FSC certified and offer rapid prototyping. Would you like to connect with them?";
      suggestions = ['View EcoPackaging', 'See alternatives', 'Start RFQ'];
    } else if (message.toLowerCase().includes('logistics')) {
      response = "Global Logistics Partners offers comprehensive supply chain solutions with < 4 hour response time. They're C-TPAT certified. Interested in learning more?";
      suggestions = ['Contact supplier', 'View capabilities', 'Get pricing'];
    }

    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
      suggestions,
    };
  }

  // Search API
  async searchSuppliers(query: string, filters?: SearchFilters): Promise<Supplier[]> {
    await delay(500);

    let results = [...MOCK_SUPPLIERS];

    // Apply filters
    if (filters?.category) {
      results = results.filter(s => s.category === filters.category);
    }
    if (filters?.location) {
      results = results.filter(s => s.location.includes(filters.location));
    }
    if (filters?.verified !== undefined) {
      results = results.filter(s => s.verified === filters.verified);
    }
    if (filters?.minRating) {
      results = results.filter(s => s.rating >= filters.minRating);
    }
    if (filters?.certifications && filters.certifications.length > 0) {
      results = results.filter(s =>
        filters.certifications!.some(cert => s.certifications.includes(cert))
      );
    }

    // Apply text search
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(s =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.category.toLowerCase().includes(lowerQuery) ||
        s.description.toLowerCase().includes(lowerQuery) ||
        s.capabilities.some(cap => cap.toLowerCase().includes(lowerQuery))
      );
    }

    return results;
  }

  // RFQ API
  async createRFQ(rfqData: Partial<RFQ>): Promise<RFQ> {
    await delay(600);

    const newRFQ: RFQ = {
      id: Date.now().toString(),
      title: rfqData.title || '',
      category: rfqData.category || '',
      description: rfqData.description || '',
      quantity: rfqData.quantity || 0,
      budget: rfqData.budget || '',
      deadline: rfqData.deadline || '',
      status: 'draft',
      responses: 0,
      createdAt: new Date().toISOString(),
    };

    return newRFQ;
  }

  async getRFQs(): Promise<RFQ[]> {
    await delay(400);
    return MOCK_RFQS;
  }

  // Deals API
  async getDeals(): Promise<Deal[]> {
    await delay(450);
    return MOCK_DEALS;
  }

  async updateDealStage(dealId: string, stage: Deal['stage']): Promise<Deal> {
    await delay(300);
    const deal = MOCK_DEALS.find(d => d.id === dealId);
    if (!deal) throw new Error('Deal not found');
    return { ...deal, stage };
  }
}

export const apiClient = new APIClient();
