"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";

interface TrademarkResult {
  serial_number: string;
  registration_number: string | null;
  mark_text: string | null;
  status_norm: string | null;
  owner_name: string | null;
  filing_date: string | null;
  classes: number[];
  sim_trgm?: number; // Trigram score (for reference)
  sim_final?: number; // Token-based score (for display)
  similarity_score: number; // Legacy/fallback (uses sim_final)
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
}

interface SearchResponse {
  query: string;
  count: number;
  results: TrademarkResult[];
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get('query') || '');
  const [results, setResults] = useState<TrademarkResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  useEffect(() => {
    const queryParam = searchParams.get('query');
    if (queryParam) {
      setQuery(queryParam);
      performSearch(queryParam);
    }
  }, [searchParams]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setError('Please enter at least 2 characters');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchPerformed(true);

    try {
      const response = await fetch(`/api/trademarks/search?query=${encodeURIComponent(searchQuery)}&limit=50`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Search failed');
      }

      const data: SearchResponse = await response.json();
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while searching');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?query=${encodeURIComponent(query.trim())}`);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'LOW': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'VERY_LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-700 bg-green-50';
      case 'PENDING': return 'text-blue-700 bg-blue-50';
      case 'DEAD': return 'text-gray-700 bg-gray-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-red-800 hover:text-red-900 font-semibold">
              ← Back
            </Link>
            <form onSubmit={handleSearch} className="flex-1 flex gap-3">
              <div className="relative flex-1 max-w-2xl">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <SearchIcon size={20} />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search trademarks..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                />
              </div>
              <button
                type="submit"
                disabled={loading || query.trim().length < 2}
                className="px-8 py-3 text-white text-base font-semibold bg-red-800 rounded-lg hover:bg-red-900 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {!loading && searchPerformed && !error && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {results.length > 0 ? `Found ${results.length} similar trademarks` : 'No results found'}
            </h2>
            {results.length > 0 && (
              <p className="text-gray-600 mt-1">
                Showing results for "{searchParams.get('query')}"
              </p>
            )}
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800"></div>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-4">
            {results.map((result, index) => (
              <div
                key={`${result.serial_number}-${index}`}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">
                        {result.mark_text || 'N/A'}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(result.risk_level)}`}>
                        {result.risk_level.replace('_', ' ')}
                      </span>
                      <span className={`px-3 py-1 rounded text-xs font-medium ${getStatusColor(result.status_norm)}`}>
                        {result.status_norm || 'Unknown'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                      <div>
                        <span className="text-gray-500">Serial Number:</span>
                        <span className="ml-2 font-medium text-gray-900">{result.serial_number}</span>
                      </div>
                      {result.registration_number && (
                        <div>
                          <span className="text-gray-500">Registration:</span>
                          <span className="ml-2 font-medium text-gray-900">{result.registration_number}</span>
                        </div>
                      )}
                      {result.owner_name && (
                        <div>
                          <span className="text-gray-500">Owner:</span>
                          <span className="ml-2 font-medium text-gray-900">{result.owner_name}</span>
                        </div>
                      )}
                      {result.filing_date && (
                        <div>
                          <span className="text-gray-500">Filing Date:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {new Date(result.filing_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {result.classes.length > 0 && (
                      <div className="mt-4">
                        <span className="text-gray-500 text-sm">Classes:</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {result.classes.map((cls) => (
                            <span
                              key={cls}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium"
                            >
                              {cls}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-gray-500">Similarity</div>
                    <div className="text-3xl font-bold text-red-800">
                      {(result.similarity_score * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && searchPerformed && results.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="text-gray-400 mb-4">
              <SearchIcon size={64} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No trademarks found</h3>
            <p className="text-gray-600">
              Try adjusting your search query or using different keywords
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
