"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { generateCandidateQueries } from "@/lib/queryGeneration";

interface TrademarkResult {
  serial_number: string;
  owner_country?: string | null;
  registration_number: string | null;
  mark_text: string | null;
  status_norm: string | null;
  owner_name: string | null;
  filing_date: string | null;
  classes: number[];
  sim_trgm?: number;
  sim_final?: number;
  similarity_score: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
  matched_candidate?: string;
}

interface SearchResponse {
  query: string;
  count: number;
  results: TrademarkResult[];
}

interface MultiSearchResponse {
  candidates: string[];
  count: number;
  results: TrademarkResult[];
}

interface VisualMatch {
  url: string;
  pageUrl?: string;
  entityLabel?: string;
  source: 'fullMatch' | 'partialMatch' | 'visuallySimilar';
  similarityScore: number;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get('query') || '');
  const [results, setResults] = useState<TrademarkResult[]>([]);
  const [visualMatches, setVisualMatches] = useState<VisualMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingVisual, setLoadingVisual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [isMultiSearch, setIsMultiSearch] = useState(false);

  useEffect(() => {
    const queryParam = searchParams.get('query');
    const mode = searchParams.get('mode');
    const normalized = searchParams.get('normalized');
    const hasImageData = searchParams.get('hasImageData') === 'true';

    if (queryParam) {
      setQuery(queryParam);
      
      // Check if this is a multi-stage search from OCR
      if (mode === 'multi' && normalized) {
        setIsMultiSearch(true);
        performMultiSearch(normalized);
      } else {
        setIsMultiSearch(false);
        performSearch(queryParam);
      }

      // If we have image data from Vision upload, also run visual similarity
      if (hasImageData) {
        const imageData = sessionStorage.getItem('uploadedImageData');
        const visionData = sessionStorage.getItem('visionData');
        
        if (imageData && visionData) {
          performVisualSimilarity(imageData, visionData);
          
          // Clean up after reading (optional - keeps data for back/forward navigation)
          // sessionStorage.removeItem('uploadedImageData');
          // sessionStorage.removeItem('visionData');
        }
      }
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
      setCandidates([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while searching');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const performMultiSearch = async (normalizedText: string) => {
    if (!normalizedText || normalizedText.trim().length < 2) {
      setError('Please enter at least 2 characters');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchPerformed(true);

    try {
      const response = await fetch('/api/trademarks/multi-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          normalizedText,
          limit: 25,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Search failed');
      }

      const data: MultiSearchResponse = await response.json();
      setResults(data.results);
      setCandidates(data.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while searching');
      setResults([]);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  const performVisualSimilarity = async (imageBase64: string, visionDataJson: string) => {
    setLoadingVisual(true);

    try {
      const visionData = JSON.parse(visionDataJson);
      
      // Build candidate list from Vision image matches
      interface ImageMatch {
        url: string;
        pageUrl?: string;
      }
      
      const candidates: Array<{
        url: string;
        pageUrl?: string;
        entityLabel?: string;
        source: 'fullMatch' | 'partialMatch' | 'visuallySimilar';
      }> = [];

      visionData.imageMatches.fullMatching?.forEach((img: ImageMatch) => {
        candidates.push({ ...img, source: 'fullMatch' });
      });

      visionData.imageMatches.partialMatching?.forEach((img: ImageMatch) => {
        candidates.push({ ...img, source: 'partialMatch' });
      });

      visionData.imageMatches.visuallySimilar?.forEach((img: ImageMatch) => {
        candidates.push({ ...img, source: 'visuallySimilar' });
      });

      if (candidates.length === 0) {
        console.log('[Visual Similarity] No candidate images from Vision');
        setLoadingVisual(false);
        return;
      }

      console.log(`[Visual Similarity] Processing ${candidates.length} candidate images`);

      const response = await fetch('/api/logo-similarity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          candidates: candidates.slice(0, 20),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Visual similarity failed');
      }

      const data = await response.json();
      console.log(`[Visual Similarity] Found ${data.count} visual matches`);
      
      // Filter to only show matches with similarity >= 0.6 (60%)
      const filteredMatches = data.results.filter((m: VisualMatch) => m.similarityScore >= 0.6);
      setVisualMatches(filteredMatches);
    } catch (err) {
      console.error('[Visual Similarity] Error:', err);
    } finally {
      setLoadingVisual(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?query=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleCandidateClick = (candidate: string) => {
    const normalized = searchParams.get('normalized');
    if (normalized) {
      router.push(`/search?query=${encodeURIComponent(candidate)}&mode=multi&normalized=${encodeURIComponent(normalized)}`);
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

  const getSimilarityColor = (score: number) => {
    if (score >= 0.8) return "text-red-700";
    if (score >= 0.6) return "text-amber-700";
    if (score >= 0.4) return "text-gray-600";
    return "text-gray-400";
  };

  const getCountryLabel = (country?: string | null) => {
    const value = country?.trim();
    if (!value) return "Unknown country";
    const code = value.toUpperCase();

    const countryCodeMap: Record<string, string> = {
      US: "United States",
      CA: "Canada",
      GB: "United Kingdom",
      UK: "United Kingdom",
      KR: "South Korea",
      KP: "North Korea",
      JP: "Japan",
      CN: "China",
      TW: "Taiwan",
      HK: "Hong Kong",
      SG: "Singapore",
      IN: "India",
      AU: "Australia",
      NZ: "New Zealand",
      DE: "Germany",
      FR: "France",
      IT: "Italy",
      ES: "Spain",
      PT: "Portugal",
      NL: "Netherlands",
      BE: "Belgium",
      CH: "Switzerland",
      AT: "Austria",
      SE: "Sweden",
      NO: "Norway",
      DK: "Denmark",
      FI: "Finland",
      IE: "Ireland",
      PL: "Poland",
      CZ: "Czech Republic",
      RO: "Romania",
      BG: "Bulgaria",
      GR: "Greece",
      TR: "Turkey",
      AE: "United Arab Emirates",
      SA: "Saudi Arabia",
      QA: "Qatar",
      KW: "Kuwait",
      IL: "Israel",
      ZA: "South Africa",
      BR: "Brazil",
      MX: "Mexico",
      AR: "Argentina",
      CL: "Chile",
      CO: "Colombia",
      PE: "Peru",
      EU: "European Union",
      MC: "Monaco",
      LU: "Luxembourg",
      LI: "Liechtenstein",
      IS: "Iceland",
    };

    const fullName = countryCodeMap[code];
    if (fullName) {
      return `${fullName} (${code})`;
    }

    return value;
  };

  const compareByCountryThenSimilarity = (a: TrademarkResult, b: TrademarkResult) => {
    const countryCmp = getCountryLabel(a.owner_country).localeCompare(getCountryLabel(b.owner_country));
    if (countryCmp !== 0) return countryCmp;
    return b.similarity_score - a.similarity_score;
  };

  const groupedResults = useMemo(() => {
    return {
      HIGH: [...results].filter((r) => r.risk_level === "HIGH").sort(compareByCountryThenSimilarity),
      MEDIUM: [...results].filter((r) => r.risk_level === "MEDIUM").sort(compareByCountryThenSimilarity),
      LOW: [...results].filter((r) => r.risk_level === "LOW").sort(compareByCountryThenSimilarity),
    };
  }, [results]);

  const riskGroups: Array<{ key: "HIGH" | "MEDIUM" | "LOW"; label: string }> = [
    { key: "HIGH", label: "HIGH similarity" },
    { key: "MEDIUM", label: "MEDIUM similarity" },
    { key: "LOW", label: "LOW similarity" },
  ];

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

        {/* Candidate chips for multi-search mode */}
        {isMultiSearch && candidates.length > 0 && !loading && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-900 text-sm font-medium mb-3">
              Search variations (click to try different options):
            </p>
            <div className="flex flex-wrap gap-2">
              {candidates.map((candidate, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCandidateClick(candidate)}
                  className={`px-4 py-2 border rounded-lg font-medium text-sm transition-colors ${
                    searchParams.get('query') === candidate
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-900 border-blue-300 hover:bg-blue-100 hover:border-blue-400'
                  }`}
                >
                  {candidate}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && searchPerformed && !error && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {results.length > 0 || visualMatches.length > 0
                ? `Search Results`
                : 'No results found'}
            </h2>
            {(results.length > 0 || visualMatches.length > 0) && (
              <p className="text-gray-600 mt-1">
                Showing results for &quot;{searchParams.get("query")}&quot;
                {isMultiSearch && " (multi-stage search)"}
              </p>
            )}
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800"></div>
          </div>
        )}

        {/* Visual Similarity Matches Section */}
        {(visualMatches.length > 0 || loadingVisual) && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Visual Matches {visualMatches.length > 0 && `(${visualMatches.length})`}
              </h3>
              {loadingVisual && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              )}
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Images found on the web that are visually similar to your uploaded logo (ranked by CLIP embedding similarity)
            </p>
            
            {loadingVisual && visualMatches.length === 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-blue-800 font-medium">Analyzing visual similarity...</p>
                <p className="text-blue-600 text-sm mt-1">This may take 10-30 seconds</p>
              </div>
            )}
            
            {visualMatches.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visualMatches.slice(0, 12).map((match, index) => (
                  <div
                    key={index}
                    className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all hover:border-blue-300"
                  >
                    <div className="relative w-full aspect-square mb-3 bg-gray-100 rounded overflow-hidden">
                      <img
                        src={match.url}
                        alt={match.entityLabel || 'Similar logo'}
                        className="w-full h-full object-contain p-2"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400 text-sm">Image unavailable</div>';
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500 uppercase">
                          {match.source === 'fullMatch' && 'Full Match'}
                          {match.source === 'partialMatch' && 'Partial'}
                          {match.source === 'visuallySimilar' && 'Similar'}
                        </span>
                        <span className={`text-xl font-bold ${getSimilarityColor(match.similarityScore)}`}>
                          {(match.similarityScore * 100).toFixed(0)}%
                        </span>
                      </div>
                      {match.entityLabel && (
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {match.entityLabel}
                        </p>
                      )}
                      {match.pageUrl && (
                        <a
                          href={match.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 truncate block hover:underline"
                        >
                          View source →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Trademark Database Matches Section */}
        {!loading && results.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Trademark Database Matches ({results.length})
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Registered trademarks with similar text/names (ranked by text similarity)
            </p>
            <div className="space-y-8">
              {riskGroups.map((group) => {
                const groupItems = groupedResults[group.key];
                if (groupItems.length === 0) return null;

                return (
                  <div key={group.key}>
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">
                      {group.label} ({groupItems.length})
                    </h4>
                    <div className="space-y-4">
                      {groupItems.map((result, index) => (
                        <div
                          key={`${result.serial_number}-${group.key}-${index}`}
                          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h3 className="text-xl font-bold text-gray-900">
                                  {result.mark_text || 'N/A'}
                                </h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(result.risk_level)}`}>
                                  {result.risk_level.replace('_', ' ')}
                                </span>
                                <span className={`px-3 py-1 rounded text-xs font-medium ${getStatusColor(result.status_norm)}`}>
                                  {result.status_norm || 'Unknown'}
                                </span>
                                {isMultiSearch && result.matched_candidate && (
                                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium border border-purple-200">
                                    matched: {result.matched_candidate}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                                <div>
                                  <span className="text-gray-500">Country:</span>
                                  <span className="ml-2 font-medium text-gray-900">
                                    {getCountryLabel(result.owner_country)}
                                  </span>
                                </div>
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
                              <div className="text-sm text-gray-500">Estimated similarity</div>
                              <div className="mt-1 flex items-baseline justify-end gap-2">
                                <span
                                  className={`text-3xl font-semibold tracking-tight ${getSimilarityColor(result.similarity_score)}`}
                                >
                                  {(result.similarity_score * 100).toFixed(0)}%
                                </span>
                                <span className="text-sm text-gray-500">similar</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !loadingVisual && searchPerformed && results.length === 0 && visualMatches.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="text-gray-400 mb-4">
              <SearchIcon size={64} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No matches found</h3>
            <p className="text-gray-600">
              Try adjusting your search query or using different keywords
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
