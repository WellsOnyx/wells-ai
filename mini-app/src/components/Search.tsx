import { h } from 'preact';
import { useState } from 'preact/hooks';
import { SearchBar } from './SearchBar';
import { SearchResults } from './SearchResults';
import { useStore } from '../hooks/useStore';
import { apiClient } from '../services/api';
import { SearchFilters } from '../types';

/**
 * Search page combining search bar and results
 */
export function Search() {
  const { searchResults, setSearchResults, user, decrementSearches, setShowUpgradeModal } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (query: string, filters: SearchFilters) => {
    // Check tier limits
    if (user.tier === 'free' && user.searchesRemaining <= 0) {
      setShowUpgradeModal(true);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const results = await apiClient.searchSuppliers(query, filters);
      setSearchResults(results);

      // Decrement search count for free tier
      if (user.tier === 'free') {
        decrementSearches();
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <SearchBar onSearch={handleSearch} isLoading={isLoading} />

      <div className="flex-1 overflow-hidden">
        {!hasSearched ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center max-w-sm">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Find Your Perfect Supplier
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Search through thousands of verified suppliers worldwide. Use filters to narrow down your results.
              </p>
              <div className="space-y-2 text-left bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-700">Try searching for:</p>
                <button
                  onClick={() => handleSearch('CNC machining', {})}
                  className="block w-full text-left text-sm px-3 py-2 bg-white rounded-lg text-primary-600 hover:bg-gray-50 ios-button"
                >
                  CNC machining
                </button>
                <button
                  onClick={() => handleSearch('packaging', {})}
                  className="block w-full text-left text-sm px-3 py-2 bg-white rounded-lg text-primary-600 hover:bg-gray-50 ios-button"
                >
                  Sustainable packaging
                </button>
                <button
                  onClick={() => handleSearch('logistics', {})}
                  className="block w-full text-left text-sm px-3 py-2 bg-white rounded-lg text-primary-600 hover:bg-gray-50 ios-button"
                >
                  Global logistics
                </button>
              </div>
            </div>
          </div>
        ) : (
          <SearchResults suppliers={searchResults} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}
