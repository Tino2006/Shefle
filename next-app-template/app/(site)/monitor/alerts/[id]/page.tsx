"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface AlertDetail {
  // Hit info
  id: string;
  watchlist_id: string;
  watchlist_query: string;
  watchlist_min_similarity: number;
  trademark_id: string;
  similarity_score: number;
  risk_level: string;
  review_status: string;
  reviewed_at: string | null;
  note: string | null;
  first_seen_at: string;
  
  // Trademark info
  trademark_serial_number: string;
  trademark_registration_number: string | null;
  trademark_mark_text: string | null;
  trademark_status_raw: string | null;
  trademark_status_norm: string | null;
  trademark_filing_date: string | null;
  trademark_registration_date: string | null;
  trademark_owner_name: string | null;
  trademark_goods_services_text: string | null;
  trademark_office: string;
  
  // Classes
  trademark_classes: number[] | null;
}

export default function AlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const alertId = params.id as string;
  
  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    loadAlert();
  }, [alertId]);

  const loadAlert = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/watchlists/hits/${alertId}`);
      if (response.ok) {
        const data = await response.json();
        setAlert(data.hit);
        setNoteText(data.hit.note || "");
      } else {
        console.error('Failed to load alert');
      }
    } catch (error) {
      console.error('Error loading alert:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (reviewStatus: 'REVIEWED' | 'DISMISSED' | 'ESCALATED') => {
    if (!alert) return;
    
    setUpdating(true);
    try {
      const response = await fetch(`/api/watchlists/hits/${alertId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_status: reviewStatus,
          note: noteText || undefined,
        }),
      });

      if (response.ok) {
        loadAlert();
        setEditingNote(false);
      } else {
        window.alert('Failed to update review status');
      }
    } catch (error) {
      console.error('Error updating review:', error);
      window.alert('Error updating review status');
    } finally {
      setUpdating(false);
    }
  };

  const openUsptoTsdr = () => {
    if (!alert) return;
    const url = `https://tsdr.uspto.gov/#caseNumber=${alert.trademark_serial_number}&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch`;
    window.open(url, '_blank');
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

  // Calculate matching details
  const getMatchingDetails = () => {
    if (!alert) return null;
    
    const queryLower = alert.watchlist_query.toLowerCase();
    const markLower = (alert.trademark_mark_text || '').toLowerCase();
    
    // Simple token analysis
    const queryTokens = queryLower.split(/\s+/).filter(t => t.length > 0);
    const markTokens = markLower.split(/\s+/).filter(t => t.length > 0);
    const sharedTokens = queryTokens.filter(t => markTokens.includes(t));
    
    return {
      queryTokens,
      markTokens,
      sharedTokens,
    };
  };

  const matchDetails = getMatchingDetails();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800"></div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Alert not found</h2>
          <Link href="/monitor" className="text-red-800 hover:text-red-900 font-semibold">
            ← Back to Monitor
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Link href="/monitor" className="text-red-800 hover:text-red-900 font-semibold text-sm mb-2 inline-block">
            ← Back to Monitor
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {alert.trademark_mark_text || 'N/A'}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getRiskColor(alert.risk_level)}`}>
                  {alert.risk_level.replace('_', ' ')} RISK
                </span>
                <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(alert.trademark_status_norm)}`}>
                  {alert.trademark_status_norm || 'Unknown Status'}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getReviewStatusColor(alert.review_status)}`}>
                  {alert.review_status}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-red-800">
                {(alert.similarity_score * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-gray-500">similarity</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Trademark Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Trademark Information</h2>
              
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 text-sm font-medium text-gray-500">Mark Text</div>
                  <div className="col-span-2 text-sm text-gray-900 font-semibold">
                    {alert.trademark_mark_text || 'N/A'}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 text-sm font-medium text-gray-500">Serial Number</div>
                  <div className="col-span-2 text-sm text-gray-900 font-mono">
                    {alert.trademark_serial_number}
                  </div>
                </div>

                {alert.trademark_registration_number && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1 text-sm font-medium text-gray-500">Registration Number</div>
                    <div className="col-span-2 text-sm text-gray-900 font-mono">
                      {alert.trademark_registration_number}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 text-sm font-medium text-gray-500">Owner</div>
                  <div className="col-span-2 text-sm text-gray-900">
                    {alert.trademark_owner_name || 'N/A'}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 text-sm font-medium text-gray-500">Filing Date</div>
                  <div className="col-span-2 text-sm text-gray-900">
                    {alert.trademark_filing_date 
                      ? new Date(alert.trademark_filing_date).toLocaleDateString()
                      : 'N/A'
                    }
                  </div>
                </div>

                {alert.trademark_registration_date && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1 text-sm font-medium text-gray-500">Registration Date</div>
                    <div className="col-span-2 text-sm text-gray-900">
                      {new Date(alert.trademark_registration_date).toLocaleDateString()}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 text-sm font-medium text-gray-500">Status</div>
                  <div className="col-span-2">
                    <div className="text-sm text-gray-900">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(alert.trademark_status_norm)}`}>
                        {alert.trademark_status_norm || 'Unknown'}
                      </span>
                      {alert.trademark_status_raw && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({alert.trademark_status_raw})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {alert.trademark_classes && alert.trademark_classes.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1 text-sm font-medium text-gray-500">Nice Classes</div>
                    <div className="col-span-2">
                      <div className="flex flex-wrap gap-1">
                        {alert.trademark_classes.map(cls => (
                          <span key={cls} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                            {cls}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {alert.trademark_goods_services_text && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-sm font-medium text-gray-500 mb-2">Goods & Services</div>
                  <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                    {alert.trademark_goods_services_text}
                  </div>
                </div>
              )}
            </div>

            {/* Match Analysis */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Why This Matched</h2>
              
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Your Watchlist Query</div>
                  <div className="text-lg font-semibold text-gray-900 bg-blue-50 px-3 py-2 rounded">
                    {alert.watchlist_query}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Matched Trademark</div>
                  <div className="text-lg font-semibold text-gray-900 bg-red-50 px-3 py-2 rounded">
                    {alert.trademark_mark_text || 'N/A'}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-1">Similarity Score</div>
                      <div className="text-2xl font-bold text-red-800">
                        {(alert.similarity_score * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-1">Threshold</div>
                      <div className="text-2xl font-bold text-gray-600">
                        {(alert.watchlist_min_similarity * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {matchDetails && (
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-2">Shared Tokens</div>
                        {matchDetails.sharedTokens.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {matchDetails.sharedTokens.map((token, i) => (
                              <span key={i} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                                {token}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No exact word matches (fuzzy match)</div>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                        <strong>Note:</strong> The similarity score is calculated using trigram analysis, 
                        which compares character sequences to find phonetic and visual similarities even 
                        when words don't match exactly.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Actions</h2>
              
              {/* Note Editor */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Note
                  {editingNote && (
                    <button
                      onClick={() => {
                        setEditingNote(false);
                        setNoteText(alert.note || "");
                      }}
                      className="ml-2 text-xs text-gray-500 hover:text-gray-700"
                    >
                      (cancel)
                    </button>
                  )}
                </label>
                <textarea
                  value={noteText}
                  onChange={(e) => {
                    setNoteText(e.target.value);
                    setEditingNote(true);
                  }}
                  placeholder="Add notes about this alert..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                  rows={3}
                />
              </div>

              {/* Review Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => handleReviewAction('REVIEWED')}
                  disabled={updating}
                  className="w-full px-4 py-3 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {updating ? 'Updating...' : '✓ Mark as Reviewed'}
                </button>
                
                <button
                  onClick={() => handleReviewAction('DISMISSED')}
                  disabled={updating}
                  className="w-full px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {updating ? 'Updating...' : '✗ Dismiss'}
                </button>
                
                <button
                  onClick={() => handleReviewAction('ESCALATED')}
                  disabled={updating}
                  className="w-full px-4 py-3 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {updating ? 'Updating...' : '⚠ Escalate'}
                </button>
              </div>

              {editingNote && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Click any action button to save your note
                </p>
              )}
            </div>

            {/* External Link */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">External Resources</h2>
              
              <button
                onClick={openUsptoTsdr}
                className="w-full px-4 py-3 text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open USPTO TSDR
              </button>
              
              <p className="text-xs text-gray-500 mt-2 text-center">
                View full trademark details on USPTO.gov
              </p>
            </div>

            {/* Timeline */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Timeline</h2>
              
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium text-gray-700">First Detected</div>
                  <div className="text-gray-600">
                    {new Date(alert.first_seen_at).toLocaleString()}
                  </div>
                </div>
                
                {alert.reviewed_at && (
                  <div>
                    <div className="font-medium text-gray-700">Last Reviewed</div>
                    <div className="text-gray-600">
                      {new Date(alert.reviewed_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
