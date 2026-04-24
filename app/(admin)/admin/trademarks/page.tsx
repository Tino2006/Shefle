"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { AdminPortfolioTrademarkRow } from "@/lib/types/database";

export default function AdminPortfolioTrademarks() {
  const router = useRouter();
  const [trademarks, setTrademarks] = useState<AdminPortfolioTrademarkRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [idToAction, setIdToAction] = useState<string | null>(null);

  useEffect(() => {
    fetchTrademarks();
  }, [filter]);

  const fetchTrademarks = async () => {
    try {
      const response = await fetch(`/api/admin/portfolio-trademarks?status=${filter}`);
      if (response.status === 503) {
        const data = await response.json();
        toast.error(data.message || "Run database migration for trademark approvals");
        setTrademarks([]);
        return;
      }
      if (!response.ok) {
        router.push("/login");
        return;
      }
      const data = await response.json();
      setTrademarks(data.trademarks || []);
    } catch {
      toast.error("Failed to load trademarks");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (trademarkId: string) => {
    try {
      const response = await fetch(`/api/admin/portfolio-trademarks/${trademarkId}/approve`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to approve");

      toast.success("Trademark approved");
      fetchTrademarks();
      setShowApproveModal(false);
      setIdToAction(null);
    } catch {
      toast.error("Failed to approve trademark");
    }
  };

  const handleReject = async (trademarkId: string) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      const response = await fetch(`/api/admin/portfolio-trademarks/${trademarkId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });

      if (!response.ok) throw new Error("Failed to reject");

      toast.success("Trademark rejected");
      fetchTrademarks();
      setShowRejectModal(false);
      setIdToAction(null);
      setRejectReason("");
    } catch {
      toast.error("Failed to reject trademark");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  const ownerLabel = (tm: AdminPortfolioTrademarkRow) => {
    const parts = [tm.owner_first_name, tm.owner_last_name].filter(Boolean);
    if (parts.length === 0) return "User";
    return parts.join(" ");
  };

  const isImageFileUrl = (url: string) => /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Portfolio Trademarks</h2>
        <p className="text-gray-600">Review trademarks submitted from user portfolios before they can be used for monitoring</p>
      </div>

      <div className="mb-6 flex gap-2 flex-wrap">
        {["pending", "approved", "rejected"].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === status
                ? "bg-red-800 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:border-red-200"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {trademarks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No {filter} portfolio trademarks</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {trademarks.map((tm) => (
            <div
              key={tm.id}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {tm.mark_name || `#${tm.registration_number}`}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(tm.approval_status)}`}>
                      {tm.approval_status}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">
                    Submitted by <span className="font-medium text-gray-900">{ownerLabel(tm)}</span>
                    <span className="text-gray-400"> · </span>
                    <span className="font-mono text-xs">{tm.user_id}</span>
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-gray-500">Registration #</p>
                      <p className="font-medium">{tm.registration_number}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Country</p>
                      <p className="font-medium">{tm.country}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Classes</p>
                      <p className="font-medium">
                        {(tm.niche_classes && tm.niche_classes.length > 0 ? tm.niche_classes : [tm.niche_class]).join(", ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Registered</p>
                      <p className="font-medium">{new Date(tm.registration_date).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {tm.logo_url && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <a
                        href={tm.logo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        View certificate / file
                      </a>
                      {tm.logo_url && isImageFileUrl(tm.logo_url) && (
                        <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                          <img src={tm.logo_url} alt="" className="w-full h-full object-contain p-1" />
                        </div>
                      )}
                    </div>
                  )}

                  {tm.approval_status === "rejected" && tm.rejection_reason && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">
                        <strong>Rejection reason:</strong> {tm.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 sm:ml-4 sm:flex-col sm:items-end">
                  {tm.approval_status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIdToAction(tm.id);
                          setShowApproveModal(true);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIdToAction(tm.id);
                          setShowRejectModal(true);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {tm.approval_status === "rejected" && (
                    <button
                      type="button"
                      onClick={() => {
                        setIdToAction(tm.id);
                        setShowApproveModal(true);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                    >
                      Approve
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                Submitted {new Date(tm.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {showApproveModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/20">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Approve trademark</h3>
            <p className="text-gray-600 mb-6">
              This mark will be available in the user&apos;s portfolio for monitoring once approved.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowApproveModal(false);
                  setIdToAction(null);
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => idToAction && handleApprove(idToAction)}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/20">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Reject trademark</h3>
            <p className="text-gray-600 mb-4">The applicant will see this reason on their portfolio.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 resize-none mb-6"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setIdToAction(null);
                  setRejectReason("");
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => idToAction && handleReject(idToAction)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
