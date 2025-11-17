import { h } from 'preact';
import { useState } from 'preact/hooks';
import { SearchFilters } from '../types';
import { MOCK_CATEGORIES, MOCK_CERTIFICATIONS } from '../mock/data';

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  isLoading: boolean;
}

/**
 * Search bar with advanced filters
 */
export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});

  const handleSearch = () => {
    onSearch(query, filters);
  };

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div className="bg-white border-b border-gray-200 p-4 space-y-3">
      {/* Search input */}
      <div className="flex items-center space-x-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search suppliers..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-3 rounded-xl border ios-button ${
            showFilters ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-700 border-gray-300'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="px-4 py-3 bg-primary-500 text-white rounded-xl font-medium ios-button disabled:opacity-50 text-sm"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="space-y-3 pt-2 border-t border-gray-200 animate-slide-up">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.category || ''}
              onChange={(e) => updateFilter('category', (e.target as HTMLSelectElement).value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Categories</option>
              {MOCK_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={filters.location || ''}
              onChange={(e) => updateFilter('location', (e.target as HTMLInputElement).value || undefined)}
              placeholder="e.g., California, USA"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.verified || false}
                onChange={(e) => updateFilter('verified', (e.target as HTMLInputElement).checked || undefined)}
                className="rounded text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Verified only</span>
            </label>

            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Min Rating</label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={filters.minRating || ''}
                onChange={(e) => updateFilter('minRating', parseFloat((e.target as HTMLInputElement).value) || undefined)}
                placeholder="4.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
