// Global state management using Zustand

import { create } from 'zustand';
import { User, ChatMessage, Supplier, Deal, UserTier } from '../types';
import { MOCK_USER } from '../mock/data';

interface AppState {
  // User state
  user: User;
  setUser: (user: User) => void;
  upgradeUser: (tier: UserTier) => void;
  decrementSearches: () => void;

  // Chat state
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;

  // UI state
  showUpgradeModal: boolean;
  setShowUpgradeModal: (show: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Search state
  searchResults: Supplier[];
  setSearchResults: (results: Supplier[]) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  // User state
  user: MOCK_USER,
  setUser: (user) => set({ user }),
  upgradeUser: (tier) => set((state) => ({
    user: {
      ...state.user,
      tier,
      searchesRemaining: tier === 'pro' ? -1 : state.user.searchesRemaining,
      maxSearches: tier === 'pro' ? -1 : 10,
    },
  })),
  decrementSearches: () => set((state) => ({
    user: {
      ...state.user,
      searchesRemaining: state.user.tier === 'pro' ? -1 : Math.max(0, state.user.searchesRemaining - 1),
    },
  })),

  // Chat state
  messages: [],
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  clearMessages: () => set({ messages: [] }),

  // UI state
  showUpgradeModal: false,
  setShowUpgradeModal: (show) => set({ showUpgradeModal: show }),
  activeTab: 'chat',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Search state
  searchResults: [],
  setSearchResults: (results) => set({ searchResults: results }),

  // Loading states
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
