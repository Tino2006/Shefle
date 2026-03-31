"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";

interface Watchlist {
  id: string;
  query: string;
  has_image: boolean;
  min_similarity: number;
  status_filter: string;
  class_filter: number[] | null;
  last_checked_at: string | null;
  created_at: string;
}

interface WatchlistHit {
  id: string;
  watchlist_id: string;
  watchlist_query: string;
  trademark_serial_number: string;
  trademark_mark_text: string | null;
  trademark_registration_number: string | null;
  trademark_owner_name: string | null;
  trademark_status_norm: string | null;
  trademark_filing_date: string | null;
  similarity_score: number;
  risk_level: string;
  review_status: string;
  reviewed_at: string | null;
  note: string | null;
  first_seen_at: string;
}

interface VisualHit {
  id: string;
  watchlist_id: string;
  watchlist_query: string;
  image_url: string;
  page_url: string | null;
  entity_label: string | null;
  source: string;
  similarity_score: number;
  first_seen_at: string;
}

interface CheckResult {
  success: boolean;
  checked_at: string;
  total_matches: number;
  new_hits: number;
  existing_hits: number;
  visual_matches?: number;
  new_visual_hits?: number;
}

export default function MonitorPage() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [hits, setHits] = useState<WatchlistHit[]>([]);
  const [visualHits, setVisualHits] = useState<VisualHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<{ [key: string]: boolean }>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('ALL');
  const [reviewingHitId, setReviewingHitId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState<string>("");
  
  // Form state
  const [newQuery, setNewQuery] = useState("");
  const [newThreshold, setNewThreshold] = useState(0.6);
  const [newImageBase64, setNewImageBase64] = useState<string | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [reviewStatusFilter]); // Reload when filter changes

  const loadData = async () => {
    setLoading(true);
    try {
      const hitsUrl = reviewStatusFilter === 'ALL' 
        ? '/api/watchlists/hits'
        : `/api/watchlists/hits?review_status=${reviewStatusFilter}`;

      const [watchlistsRes, hitsRes, visualHitsRes] = await Promise.all([
        fetch('/api/watchlists'),
        fetch(hitsUrl),
        fetch('/api/watchlists/visual-hits'),
      ]);

      if (watchlistsRes.ok) {
        const watchlistsData = await watchlistsRes.json();
        setWatchlists(watchlistsData.watchlists || []);
      }

      if (hitsRes.ok) {
        const hitsData = await hitsRes.json();
        setHits(hitsData.hits || []);
      }

      if (visualHitsRes.ok) {
        const visualHitsData = await visualHitsRes.json();
        setVisualHits(visualHitsData.hits || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckWatchlist = async (watchlistId: string) => {
    setChecking(prev => ({ ...prev, [watchlistId]: true }));
    try {
      const response = await fetch(`/api/watchlists/${watchlistId}/check`, {
        method: 'POST',
      });

      if (response.ok) {
        const result: CheckResult = await response.json();
        const visualLine = result.visual_matches != null
          ? `\nVisual matches: ${result.visual_matches} (${result.new_visual_hits ?? 0} new)`
          : '';
        alert(
          `Check complete!\n\n` +
          `Total matches: ${result.total_matches}\n` +
          `New alerts: ${result.new_hits}\n` +
          `Existing alerts: ${result.existing_hits}` +
          visualLine
        );
        // Reload data to show updated last_checked_at and new hits
        loadData();
      } else {
        alert('Failed to check watchlist');
      }
    } catch (error) {
      console.error('Error checking watchlist:', error);
      alert('Error checking watchlist');
    } finally {
      setChecking(prev => ({ ...prev, [watchlistId]: false }));
    }
  };

  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuery.trim() || newQuery.trim().length < 2) {
      alert('Query must be at least 2 characters');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: newQuery.trim(),
          image_base64: newImageBase64,
          min_similarity: newThreshold,
          status_filter: 'ACTIVE,PENDING',
        }),
      });

      if (response.ok) {
        setNewQuery("");
        setNewThreshold(0.6);
        setNewImageBase64(null);
        setNewImagePreview(null);
        setShowCreateForm(false);
        loadData();
      } else {
        const error = await response.json();
        alert(`Failed to create watchlist: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating watchlist:', error);
      alert('Error creating watchlist');
    } finally {
      setCreating(false);
    }
  };

  const handleReviewAction = async (hitId: string, reviewStatus: 'REVIEWED' | 'DISMISSED' | 'ESCALATED') => {
    try {
      const note = reviewingHitId === hitId ? reviewNote : undefined;
      
      const response = await fetch(`/api/watchlists/hits/${hitId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_status: reviewStatus,
          note: note || undefined,
        }),
      });

      if (response.ok) {
        setReviewingHitId(null);
        setReviewNote("");
        loadData();
      } else {
        alert('Failed to update review status');
      }
    } catch (error) {
      console.error('Error updating review:', error);
      alert('Error updating review status');
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

  const getReviewStatusColor = (reviewStatus: string) => {
    switch (reviewStatus) {
      case 'NEW': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'REVIEWED': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'DISMISSED': return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'ESCALATED': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 0.9) return 'text-red-600';
    if (score >= 0.8) return 'text-orange-600';
    if (score >= 0.7) return 'text-yellow-600';
    return 'text-green-600';
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PNG, JPG, or WEBP image.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('Image must be under 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setNewImagePreview(dataUrl);
      const base64 = dataUrl.split(',')[1];
      setNewImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setNewImageBase64(null);
    setNewImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
          <Link
            href="/"
            className="inline-block text-sm font-semibold text-red-800 hover:text-red-900"
          >
            ← Back to Home
          </Link>

          <div className="mt-3 flex flex-col gap-4 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Brand Monitor</h1>
              <p className="mt-1 text-sm text-gray-600 sm:text-base">
                Track similar trademarks to your brands
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="w-full shrink-0 rounded-lg bg-red-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-900 sm:w-auto sm:px-6 sm:py-3 sm:text-base"
            >
              {showCreateForm ? 'Cancel' : '+ Create Monitor'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 sm:mb-8 sm:p-6">
            <h2 className="mb-3 text-lg font-bold text-gray-900 sm:mb-4 sm:text-xl">Create New Monitor</h2>
            <form onSubmit={handleCreateWatchlist} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 sm:mb-2">
                  Brand Name to Monitor
                </label>
                <input
                  type="text"
                  value={newQuery}
                  onChange={(e) => setNewQuery(e.target.value)}
                  placeholder="Enter brand name..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-red-800 focus:outline-none focus:ring-2 focus:ring-red-800/20 sm:px-4 sm:py-3"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 sm:mb-2">
                  Logo Image <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Upload a logo to enable visual similarity monitoring via Google Vision + CLIP
                </p>
                {newImagePreview ? (
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                      <img
                        src={newImagePreview}
                        alt="Logo preview"
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="text-sm text-red-600 hover:text-red-800 font-medium"
                    >
                      Remove image
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 transition-colors hover:border-red-300 hover:bg-red-50/30"
                  >
                    <div className="text-center">
                      <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-1 text-sm text-gray-600">Click to upload logo</p>
                      <p className="text-xs text-gray-400">PNG, JPG, WEBP up to 8MB</p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 sm:mb-2">
                  Similarity Threshold: {(newThreshold * 100).toFixed(0)}%
                </label>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  <input
                    type="range"
                    min="0.3"
                    max="1.0"
                    step="0.05"
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(parseFloat(e.target.value))}
                    className="h-2 w-full min-w-0 flex-1 cursor-pointer accent-red-800"
                  />
                  <div className="grid w-full grid-cols-3 gap-2 md:flex md:w-auto md:shrink-0 md:gap-2">
                    <button
                      type="button"
                      onClick={() => setNewThreshold(0.8)}
                      className={`rounded-md px-2 py-2 text-center text-[11px] font-medium leading-tight sm:px-3 sm:py-1 sm:text-xs ${newThreshold === 0.8 ? 'bg-red-800 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      High (80%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewThreshold(0.6)}
                      className={`rounded-md px-2 py-2 text-center text-[11px] font-medium leading-tight sm:px-3 sm:py-1 sm:text-xs ${newThreshold === 0.6 ? 'bg-red-800 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      Medium (60%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewThreshold(0.4)}
                      className={`rounded-md px-2 py-2 text-center text-[11px] font-medium leading-tight sm:px-3 sm:py-1 sm:text-xs ${newThreshold === 0.4 ? 'bg-red-800 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      Low (40%)
                    </button>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-gray-500 sm:text-sm">
                  Higher thresholds = fewer but more relevant alerts
                </p>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:gap-3 sm:pt-2">
                <button
                  type="submit"
                  disabled={creating || !newQuery.trim()}
                  className="w-full rounded-lg bg-red-800 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-gray-400 sm:w-auto sm:px-6 sm:py-2"
                >
                  {creating ? 'Creating...' : 'Create Monitor'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewQuery("");
                    setNewThreshold(0.6);
                    clearImage();
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto sm:px-6 sm:py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800"></div>
          </div>
        ) : (
          <>
          {/* Visual Matches Section */}
          {visualHits.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Visual Matches ({visualHits.length})</h2>
              <p className="text-sm text-gray-600 mb-4">
                Images found on the web that are visually similar to your monitored logos (ranked by CLIP embedding similarity)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visualHits.slice(0, 12).map((match) => (
                  <div
                    key={match.id}
                    className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all hover:border-blue-300"
                  >
                    <div className="relative w-full aspect-square mb-3 bg-gray-100 rounded overflow-hidden">
                      <img
                        src={match.image_url}
                        alt={match.entity_label || 'Similar image'}
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
                        <span className={`text-xl font-bold ${getSimilarityColor(match.similarity_score)}`}>
                          {(match.similarity_score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Monitor: <span className="font-medium text-gray-700">{match.watchlist_query}</span>
                      </p>
                      {match.entity_label && (
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {match.entity_label}
                        </p>
                      )}
                      {match.page_url && (
                        <a
                          href={match.page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 truncate block hover:underline"
                        >
                          View source &rarr;
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Watched Brands */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Monitors</h2>
              {watchlists.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                  <div className="text-gray-400 mb-2">
                    <SearchIcon size={48} />
                  </div>
                  <p className="text-gray-600">No monitors yet</p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="mt-4 text-red-800 hover:text-red-900 font-semibold"
                  >
                    Create your first monitor
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {watchlists.map((watchlist) => (
                    <div
                      key={watchlist.id}
                      className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-bold text-gray-900">
                              {watchlist.query}
                            </h3>
                            {watchlist.has_image && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Visual
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span>Threshold: {(watchlist.min_similarity * 100).toFixed(0)}%</span>
                            <span>•</span>
                            <span>Status: {watchlist.status_filter}</span>
                            {watchlist.has_image && visualHits.filter(v => v.watchlist_id === watchlist.id).length > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-blue-700">{visualHits.filter(v => v.watchlist_id === watchlist.id).length} visual matches</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {watchlist.last_checked_at && (
                        <p className="text-xs text-gray-500 mb-3">
                          Last checked: {new Date(watchlist.last_checked_at).toLocaleString()}
                        </p>
                      )}

                      <button
                        onClick={() => handleCheckWatchlist(watchlist.id)}
                        disabled={checking[watchlist.id]}
                        className="w-full px-4 py-2 text-red-800 font-semibold bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed"
                      >
                        {checking[watchlist.id] ? 'Checking...' : 'Check Now'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Alerts */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Recent Alerts</h2>
                
                {/* Review Status Filter */}
                <select
                  value={reviewStatusFilter}
                  onChange={(e) => setReviewStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                >
                  <option value="ALL">All Alerts</option>
                  <option value="NEW">New Only</option>
                  <option value="REVIEWED">Reviewed</option>
                  <option value="DISMISSED">Dismissed</option>
                  <option value="ESCALATED">Escalated</option>
                </select>
              </div>

              {hits.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                  <p className="text-gray-600">
                    {reviewStatusFilter === 'ALL' ? 'No alerts yet' : `No ${reviewStatusFilter.toLowerCase()} alerts`}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {reviewStatusFilter === 'ALL' 
                      ? 'Create a monitor and check it to see alerts'
                      : 'Try a different filter'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[800px] overflow-y-auto">
                  {hits.map((hit) => (
                    <Link
                      key={hit.id}
                      href={`/monitor/alerts/${hit.id}`}
                      className="block bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg hover:border-red-200 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getRiskColor(hit.risk_level)}`}>
                              {hit.risk_level.replace('_', ' ')}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(hit.trademark_status_norm)}`}>
                              {hit.trademark_status_norm || 'Unknown'}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getReviewStatusColor(hit.review_status)}`}>
                              {hit.review_status}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {hit.trademark_mark_text || 'N/A'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Similar to: <span className="font-semibold">{hit.watchlist_query}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-red-800">
                            {(hit.similarity_score * 100).toFixed(0)}%
                          </div>
                          <div className="text-xs text-gray-500">match</div>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Serial: {hit.trademark_serial_number}</div>
                        {hit.trademark_owner_name && (
                          <div>Owner: {hit.trademark_owner_name}</div>
                        )}
                        {hit.trademark_filing_date && (
                          <div>Filed: {new Date(hit.trademark_filing_date).toLocaleDateString()}</div>
                        )}
                      </div>

                      {hit.note && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold">Note:</span> {hit.note}
                          </p>
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">
                            Detected: {new Date(hit.first_seen_at).toLocaleString()}
                            {hit.reviewed_at && (
                              <span className="ml-2">
                                • Reviewed: {new Date(hit.reviewed_at).toLocaleString()}
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Review Actions */}
                        {reviewingHitId === hit.id ? (
                          <div className="mt-3 space-y-2">
                            <textarea
                              value={reviewNote}
                              onChange={(e) => setReviewNote(e.target.value)}
                              onClick={(e) => e.preventDefault()}
                              placeholder="Add a note (optional)..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-800/20"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleReviewAction(hit.id, 'REVIEWED');
                                }}
                                className="flex-1 px-3 py-2 text-xs font-semibold text-green-800 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors"
                              >
                                ✓ Reviewed
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleReviewAction(hit.id, 'DISMISSED');
                                }}
                                className="flex-1 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                              >
                                ✗ Dismiss
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleReviewAction(hit.id, 'ESCALATED');
                                }}
                                className="flex-1 px-3 py-2 text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 transition-colors"
                              >
                                ⚠ Escalate
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setReviewingHitId(null);
                                  setReviewNote("");
                                }}
                                className="px-3 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : hit.review_status === 'NEW' ? (
                          <div className="mt-3">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setReviewingHitId(hit.id);
                              }}
                              className="w-full px-4 py-2 text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              Review This Alert
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setReviewingHitId(hit.id);
                                setReviewNote(hit.note || "");
                              }}
                              className="text-xs text-gray-600 hover:text-red-800 underline"
                            >
                              Change Review Status
                            </button>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
