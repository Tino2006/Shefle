"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";

interface Watchlist {
  id: string;
  query: string;
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

interface CheckResult {
  success: boolean;
  checked_at: string;
  total_matches: number;
  new_hits: number;
  existing_hits: number;
}

export default function MonitorPage() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [hits, setHits] = useState<WatchlistHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<{ [key: string]: boolean }>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('ALL');
  const [reviewingHitId, setReviewingHitId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState<string>("");
  
  // Form state
  const [newQuery, setNewQuery] = useState("");
  const [newThreshold, setNewThreshold] = useState(0.6);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, [reviewStatusFilter]); // Reload when filter changes

  const loadData = async () => {
    setLoading(true);
    try {
      // Build hits URL with filter
      const hitsUrl = reviewStatusFilter === 'ALL' 
        ? '/api/watchlists/hits'
        : `/api/watchlists/hits?review_status=${reviewStatusFilter}`;

      const [watchlistsRes, hitsRes] = await Promise.all([
        fetch('/api/watchlists'),
        fetch(hitsUrl),
      ]);

      if (watchlistsRes.ok) {
        const watchlistsData = await watchlistsRes.json();
        setWatchlists(watchlistsData.watchlists || []);
      }

      if (hitsRes.ok) {
        const hitsData = await hitsRes.json();
        setHits(hitsData.hits || []);
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
        alert(
          `Check complete!\n\n` +
          `Total matches: ${result.total_matches}\n` +
          `New alerts: ${result.new_hits}\n` +
          `Existing alerts: ${result.existing_hits}`
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
          min_similarity: newThreshold,
          status_filter: 'ACTIVE,PENDING',
        }),
      });

      if (response.ok) {
        setNewQuery("");
        setNewThreshold(0.6);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-red-800 hover:text-red-900 font-semibold text-sm mb-2 inline-block">
                ← Back to Home
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Brand Monitor</h1>
              <p className="text-gray-600 mt-1">Track similar trademarks to your brands</p>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-6 py-3 text-white text-base font-semibold bg-red-800 rounded-lg hover:bg-red-900 transition-colors"
            >
              {showCreateForm ? 'Cancel' : '+ Create Monitor'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Monitor</h2>
            <form onSubmit={handleCreateWatchlist} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Name to Monitor
                </label>
                <input
                  type="text"
                  value={newQuery}
                  onChange={(e) => setNewQuery(e.target.value)}
                  placeholder="Enter brand name..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Similarity Threshold: {(newThreshold * 100).toFixed(0)}%
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0.3"
                    max="1.0"
                    step="0.05"
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewThreshold(0.8)}
                      className={`px-3 py-1 text-xs rounded ${newThreshold === 0.8 ? 'bg-red-800 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      High (80%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewThreshold(0.6)}
                      className={`px-3 py-1 text-xs rounded ${newThreshold === 0.6 ? 'bg-red-800 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      Medium (60%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewThreshold(0.4)}
                      className={`px-3 py-1 text-xs rounded ${newThreshold === 0.4 ? 'bg-red-800 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      Low (40%)
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Higher thresholds = fewer but more relevant alerts
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating || !newQuery.trim()}
                  className="px-6 py-2 text-white font-semibold bg-red-800 rounded-lg hover:bg-red-900 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create Monitor'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewQuery("");
                    setNewThreshold(0.6);
                  }}
                  className="px-6 py-2 text-gray-700 font-semibold bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
                          <h3 className="text-lg font-bold text-gray-900 mb-1">
                            {watchlist.query}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span>Threshold: {(watchlist.min_similarity * 100).toFixed(0)}%</span>
                            <span>•</span>
                            <span>Status: {watchlist.status_filter}</span>
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
                    <div
                      key={hit.id}
                      className="bg-white border border-gray-200 rounded-lg p-5"
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
                              placeholder="Add a note (optional)..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-800/20"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReviewAction(hit.id, 'REVIEWED')}
                                className="flex-1 px-3 py-2 text-xs font-semibold text-green-800 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors"
                              >
                                ✓ Reviewed
                              </button>
                              <button
                                onClick={() => handleReviewAction(hit.id, 'DISMISSED')}
                                className="flex-1 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                              >
                                ✗ Dismiss
                              </button>
                              <button
                                onClick={() => handleReviewAction(hit.id, 'ESCALATED')}
                                className="flex-1 px-3 py-2 text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 transition-colors"
                              >
                                ⚠ Escalate
                              </button>
                              <button
                                onClick={() => {
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
                              onClick={() => setReviewingHitId(hit.id)}
                              className="w-full px-4 py-2 text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              Review This Alert
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <button
                              onClick={() => {
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
