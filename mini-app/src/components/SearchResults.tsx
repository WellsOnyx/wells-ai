import { h } from 'preact';
import { Supplier } from '../types';

interface SearchResultsProps {
  suppliers: Supplier[];
  isLoading: boolean;
}

/**
 * Display search results in a card-based layout
 */
export function SearchResults({ suppliers, isLoading }: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Searching suppliers...</p>
        </div>
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
          <p className="text-sm text-gray-600">Try adjusting your search or filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-4 space-y-3">
      {suppliers.map((supplier) => (
        <div
          key={supplier.id}
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-ios-card hover:shadow-ios transition-shadow animate-fade-in"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                {supplier.verified && (
                  <span className="text-primary-500" title="Verified">✓</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{supplier.category}</p>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-yellow-400">★</span>
              <span className="text-sm font-medium text-gray-900">{supplier.rating}</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 mb-3">{supplier.description}</p>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
            <div>
              <span className="text-gray-500">Location:</span>
              <span className="ml-1 text-gray-900">{supplier.location}</span>
            </div>
            <div>
              <span className="text-gray-500">Response:</span>
              <span className="ml-1 text-gray-900">{supplier.responseTime}</span>
            </div>
            <div>
              <span className="text-gray-500">Min Order:</span>
              <span className="ml-1 text-gray-900">{supplier.minOrder}</span>
            </div>
          </div>

          {/* Certifications */}
          <div className="flex flex-wrap gap-1 mb-3">
            {supplier.certifications.map((cert) => (
              <span
                key={cert}
                className="px-2 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium"
              >
                {cert}
              </span>
            ))}
          </div>

          {/* Capabilities */}
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">Capabilities:</p>
            <div className="flex flex-wrap gap-1">
              {supplier.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-2">
            <button className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium ios-button">
              Contact
            </button>
            <button className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium ios-button">
              Save
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
