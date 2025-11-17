import { h } from 'preact';
import { useStore } from '../hooks/useStore';

interface LayoutProps {
  children: any;
}

/**
 * Main layout component with iOS-style tab bar navigation
 */
export function Layout({ children }: LayoutProps) {
  const { activeTab, setActiveTab, user } = useStore();

  const tabs = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'rfq', label: 'RFQs', icon: '📋' },
    { id: 'deals', label: 'Deals', icon: '🤝' },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="safe-area-top bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">W</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Wells AI</h1>
              <p className="text-xs text-gray-500">Intelligent Procurement</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {user.tier === 'free' && (
              <div className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                {user.searchesRemaining}/{user.maxSearches} searches
              </div>
            )}
            <div className={`text-xs px-2 py-1 rounded-full ${
              user.tier === 'pro'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {user.tier.toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      {/* Tab bar navigation */}
      <nav className="safe-area-bottom bg-white border-t border-gray-200 shadow-lg">
        <div className="flex items-center justify-around py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center space-y-1 px-4 py-2 rounded-lg ios-button ${
                activeTab === tab.id
                  ? 'text-primary-600'
                  : 'text-gray-400'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
