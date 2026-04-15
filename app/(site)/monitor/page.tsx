"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import toast from "react-hot-toast";

interface PortfolioTrademark {
  id: string;
  registration_number: string;
  country: string;
  niche_class: number;
  niche_classes?: number[];
  registration_date: string;
  logo_url: string | null;
  mark_name: string | null;
}

interface Watchlist {
  id: string;
  query: string;
  has_image: boolean;
  min_similarity: number;
  status_filter: string;
  class_filter: number[] | null;
  portfolio_trademark_id: string | null;
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
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<{ [key: string]: boolean }>({});
  const [deleting, setDeleting] = useState<{ [key: string]: boolean }>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('ALL');
  
  // Portfolio trademarks for the create form
  const [portfolioTrademarks, setPortfolioTrademarks] = useState<PortfolioTrademark[]>([]);

  // Form state
  const [selectedTrademarkId, setSelectedTrademarkId] = useState<string>("");
  const [newThreshold, setNewThreshold] = useState(0.6);
  const [creating, setCreating] = useState(false);
  const isImageFileUrl = (url: string) => /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url);

  useEffect(() => {
    loadData();
  }, [reviewStatusFilter]); // Reload when filter changes

  const loadData = async () => {
    setLoading(true);
    try {
      const hitsUrl = reviewStatusFilter === 'ALL' 
        ? '/api/watchlists/hits'
        : `/api/watchlists/hits?review_status=${reviewStatusFilter}`;

      const [watchlistsRes, hitsRes, visualHitsRes, portfolioRes] = await Promise.all([
        fetch('/api/watchlists'),
        fetch(hitsUrl),
        fetch('/api/watchlists/visual-hits'),
        fetch('/api/portfolio'),
      ]);

      if (watchlistsRes.ok) {
        const watchlistsData = await watchlistsRes.json();
        const fetchedWatchlists: Watchlist[] = watchlistsData.watchlists || [];
        setWatchlists(fetchedWatchlists);
        setSelectedWatchlistId((prev) => {
          if (prev && fetchedWatchlists.some((w) => w.id === prev)) return prev;
          return fetchedWatchlists[0]?.id || null;
        });
      }

      if (hitsRes.ok) {
        const hitsData = await hitsRes.json();
        setHits(hitsData.hits || []);
      }

      if (visualHitsRes.ok) {
        const visualHitsData = await visualHitsRes.json();
        setVisualHits(visualHitsData.hits || []);
      }

      if (portfolioRes.ok) {
        const portfolioData = await portfolioRes.json();
        setPortfolioTrademarks(portfolioData.trademarks || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckWatchlist = async (watchlistId: string) => {
    setSelectedWatchlistId(watchlistId);
    setChecking(prev => ({ ...prev, [watchlistId]: true }));
    try {
      const response = await fetch(`/api/watchlists/${watchlistId}/check`, {
        method: 'POST',
      });

      if (response.ok) {
        const result: CheckResult = await response.json();
        const visualSummary = result.visual_matches != null
          ? ` | Visual: ${result.visual_matches} (${result.new_visual_hits ?? 0} new)`
          : "";
        toast.success(
          `Check complete. Total: ${result.total_matches} | New: ${result.new_hits} | Existing: ${result.existing_hits}${visualSummary}`,
          { duration: 5000 }
        );
        // Reload data to show updated last_checked_at and new hits
        loadData();
      } else {
        toast.error("Failed to check watchlist");
      }
    } catch (error) {
      console.error('Error checking watchlist:', error);
      toast.error("Error checking watchlist");
    } finally {
      setChecking(prev => ({ ...prev, [watchlistId]: false }));
    }
  };

  const handleDeleteWatchlist = async (watchlistId: string) => {
    const confirmed = confirm('Delete this monitor? Its previous hits will also be removed.');
    if (!confirmed) return;

    setDeleting((prev) => ({ ...prev, [watchlistId]: true }));
    try {
      const response = await fetch(`/api/watchlists/${watchlistId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Monitor deleted');
        if (selectedWatchlistId === watchlistId) {
          setSelectedWatchlistId(null);
        }
        await loadData();
      } else {
        const error = await response.json();
        toast.error(error.message || error.error || 'Failed to delete monitor');
      }
    } catch (error) {
      console.error('Error deleting monitor:', error);
      toast.error('Error deleting monitor');
    } finally {
      setDeleting((prev) => ({ ...prev, [watchlistId]: false }));
    }
  };

  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrademarkId) {
      toast.error("Please select a trademark from your portfolio");
      return;
    }

    const selected = portfolioTrademarks.find(t => t.id === selectedTrademarkId);
    if (!selected) return;

    const queryText = selected.mark_name || `#${selected.registration_number}`;
    const selectedClasses =
      selected.niche_classes && selected.niche_classes.length > 0
        ? selected.niche_classes
        : [selected.niche_class];

    setCreating(true);
    try {
      const response = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          min_similarity: newThreshold,
          status_filter: 'ACTIVE,PENDING',
          class_filter: selectedClasses,
          portfolio_trademark_id: parseInt(selectedTrademarkId),
        }),
      });

      if (response.ok) {
        setSelectedTrademarkId("");
        setNewThreshold(0.6);
        setShowCreateForm(false);
        toast.success("Monitor created successfully");
        loadData();
      } else {
        const error = await response.json();
        if (response.status === 409) {
          toast.error(error.message || 'You already have this monitor');
        } else {
          toast.error(`Failed to create watchlist: ${error.message || "Unknown error"}`);
        }
      }
    } catch (error) {
      console.error('Error creating watchlist:', error);
      toast.error("Error creating watchlist");
    } finally {
      setCreating(false);
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

  const selectedWatchlist = watchlists.find((watchlist) => watchlist.id === selectedWatchlistId) || null;
  const selectedWatchlistHits = selectedWatchlistId
    ? hits.filter((hit) => hit.watchlist_id === selectedWatchlistId)
    : [];
  const selectedWatchlistVisualHits = selectedWatchlistId
    ? visualHits.filter((hit) => hit.watchlist_id === selectedWatchlistId)
    : [];

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

            {portfolioTrademarks.length === 0 ? (
              <div className="text-center py-6">
                <svg className="mx-auto h-10 w-10 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-600 font-medium">No trademarks in your portfolio</p>
                <p className="text-sm text-gray-500 mt-1">
                  You need to add trademarks to your portfolio before creating a monitor.
                </p>
                <Link
                  href="/portfolio"
                  className="mt-4 inline-block rounded-lg bg-red-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-900"
                >
                  Go to Portfolio
                </Link>
              </div>
            ) : (
              <form onSubmit={handleCreateWatchlist} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 sm:mb-2">
                    Select Trademark to Monitor
                  </label>
                  <select
                    value={selectedTrademarkId}
                    onChange={(e) => setSelectedTrademarkId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-red-800 focus:outline-none focus:ring-2 focus:ring-red-800/20 sm:px-4 sm:py-3"
                    required
                  >
                    <option value="">Choose a trademark...</option>
                    {portfolioTrademarks.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.mark_name || `#${tm.registration_number}`} &mdash; {tm.country}, Class {(tm.niche_classes && tm.niche_classes.length > 0 ? tm.niche_classes : [tm.niche_class]).join(", ")}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTrademarkId && (() => {
                  const sel = portfolioTrademarks.find(t => t.id === selectedTrademarkId);
                  if (!sel) return null;
                  return (
                    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      {sel.logo_url && isImageFileUrl(sel.logo_url) ? (
                        <div className="w-14 h-14 shrink-0 rounded-lg border border-gray-200 bg-white overflow-hidden">
                          <img src={sel.logo_url} alt="" className="w-full h-full object-contain p-1" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 shrink-0 rounded-lg border border-gray-200 bg-white flex items-center justify-center">
                          <svg className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                      )}
                      <div className="text-sm">
                        <p className="font-semibold text-gray-900">{sel.mark_name || `#${sel.registration_number}`}</p>
                        <p className="text-gray-500">
                          Reg. #{sel.registration_number} &middot; {sel.country} &middot; Class {(sel.niche_classes && sel.niche_classes.length > 0 ? sel.niche_classes : [sel.niche_class]).join(", ")}
                        </p>
                      </div>
                    </div>
                  );
                })()}

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
                    disabled={creating || !selectedTrademarkId}
                    className="w-full rounded-lg bg-red-800 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-gray-400 sm:w-auto sm:px-6 sm:py-2"
                  >
                    {creating ? 'Creating...' : 'Create Monitor'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setSelectedTrademarkId("");
                      setNewThreshold(0.6);
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto sm:px-6 sm:py-2"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Your Monitors</h2>
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
                <div className="space-y-3">
                  {watchlists.map((watchlist) => {
                    const watchlistHitsCount = hits.filter((h) => h.watchlist_id === watchlist.id).length;
                    const visualHitsCount = visualHits.filter((h) => h.watchlist_id === watchlist.id).length;
                    const isSelected = selectedWatchlistId === watchlist.id;

                    return (
                      <div
                        key={watchlist.id}
                        onClick={() => setSelectedWatchlistId(watchlist.id)}
                        className={`w-full text-left rounded-lg border p-4 transition-all cursor-pointer ${
                          isSelected
                            ? "border-red-300 bg-red-50/40 shadow-sm"
                            : "border-gray-200 bg-white hover:border-red-200 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-gray-900 truncate">{watchlist.query}</h3>
                            <p className="text-xs text-gray-500 mt-1">
                              Threshold {(watchlist.min_similarity * 100).toFixed(0)}% · {watchlist.status_filter}
                            </p>
                            <div className="mt-2 flex items-center gap-2 text-xs">
                              <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-orange-700 font-medium">
                                {watchlistHitsCount} trademark
                              </span>
                              {watchlist.has_image && (
                                <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-blue-700 font-medium">
                                  {visualHitsCount} visual
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-gray-500">
                            {watchlist.last_checked_at
                              ? `Checked ${new Date(watchlist.last_checked_at).toLocaleString()}`
                              : "Not checked yet"}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckWatchlist(watchlist.id);
                            }}
                            className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold ${
                              checking[watchlist.id]
                                ? "bg-gray-100 text-gray-500"
                                : "bg-red-100 text-red-800"
                            }`}
                            disabled={checking[watchlist.id] || deleting[watchlist.id]}
                          >
                            {checking[watchlist.id] ? "Checking..." : "Check now"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWatchlist(watchlist.id);
                            }}
                            className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-800"
                            disabled={deleting[watchlist.id] || checking[watchlist.id]}
                          >
                            {deleting[watchlist.id] ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedWatchlist ? `Similarity Results · ${selectedWatchlist.query}` : "Similarity Results"}
                </h2>
                <select
                  value={reviewStatusFilter}
                  onChange={(e) => setReviewStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                >
                  <option value="ALL">All Alerts</option>
                  <option value="NEW">New Only</option>
                  <option value="REVIEWED">Reviewed</option>
                  <option value="DISMISSED">Dismissed</option>
                  <option value="ESCALATED">Escalated</option>
                </select>
              </div>

              {!selectedWatchlist ? (
                <div className="bg-white border border-gray-200 rounded-lg p-10 text-center text-gray-600">
                  Select a monitor on the left to view its similarities.
                </div>
              ) : selectedWatchlistHits.length === 0 && selectedWatchlistVisualHits.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
                  <p className="text-gray-700 font-medium">No similarities found for this monitor yet.</p>
                  <p className="text-sm text-gray-500 mt-1">Run "Check now" to scan for potential matches.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {selectedWatchlistHits.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                        Trademark Similarities ({selectedWatchlistHits.length})
                      </h3>
                      <div className="space-y-3">
                        {selectedWatchlistHits.map((hit) => (
                          <Link
                            key={hit.id}
                            href={`/monitor/alerts/${hit.id}`}
                            className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-red-200 transition-all"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap mb-2">
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
                                <p className="font-bold text-gray-900">{hit.trademark_mark_text || "N/A"}</p>
                                <p className="text-sm text-gray-600 mt-1">
                                  Serial: {hit.trademark_serial_number}
                                  {hit.trademark_owner_name ? ` · ${hit.trademark_owner_name}` : ""}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                  Detected: {new Date(hit.first_seen_at).toLocaleString()}
                                </p>
                              </div>
                              <div className={`text-2xl font-bold ${getSimilarityColor(hit.similarity_score)}`}>
                                {(hit.similarity_score * 100).toFixed(0)}%
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedWatchlistVisualHits.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                        Visual Similarities ({selectedWatchlistVisualHits.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {selectedWatchlistVisualHits.slice(0, 12).map((match) => (
                          <div
                            key={match.id}
                            className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all"
                          >
                            <div className="relative w-full aspect-square mb-2 bg-gray-100 rounded overflow-hidden">
                              <img
                                src={match.image_url}
                                alt={match.entity_label || "Similar image"}
                                className="w-full h-full object-contain p-2"
                                loading="lazy"
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-500 uppercase">
                                {match.source === "fullMatch" && "Full Match"}
                                {match.source === "partialMatch" && "Partial"}
                                {match.source === "visuallySimilar" && "Similar"}
                              </span>
                              <span className={`text-lg font-bold ${getSimilarityColor(match.similarity_score)}`}>
                                {(match.similarity_score * 100).toFixed(0)}%
                              </span>
                            </div>
                            {match.page_url && (
                              <a
                                href={match.page_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-block text-xs text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                View source
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
