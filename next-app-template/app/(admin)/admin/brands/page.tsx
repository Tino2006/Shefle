"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { Brand } from "@/lib/types/database";

export default function AdminBrands() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [filter, setFilter] = useState<string>("pending");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [brandToAction, setBrandToAction] = useState<string | null>(null);

  useEffect(() => {
    fetchBrands();
  }, [filter]);

  const fetchBrands = async () => {
    try {
      const response = await fetch(`/api/admin/brands?status=${filter}`);
      if (!response.ok) {
        router.push("/login");
        return;
      }
      const data = await response.json();
      setBrands(data.brands);
    } catch (error) {
      toast.error("Failed to load brands");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (brandId: string) => {
    try {
      const response = await fetch(`/api/admin/brands/${brandId}/approve`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to approve");

      toast.success("Brand approved successfully");
      fetchBrands();
      setSelectedBrand(null);
      setShowApproveModal(false);
      setBrandToAction(null);
    } catch (error) {
      toast.error("Failed to approve brand");
    }
  };

  const handleReject = async (brandId: string) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      const response = await fetch(`/api/admin/brands/${brandId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });

      if (!response.ok) throw new Error("Failed to reject");

      toast.success("Brand rejected");
      fetchBrands();
      setSelectedBrand(null);
      setShowRejectModal(false);
      setBrandToAction(null);
      setRejectReason("");
    } catch (error) {
      toast.error("Failed to reject brand");
    }
  };

  const openApproveModal = (brandId: string) => {
    setBrandToAction(brandId);
    setShowApproveModal(true);
  };

  const openRejectModal = (brandId: string) => {
    setBrandToAction(brandId);
    setShowRejectModal(true);
  };

  const closeApproveModal = () => {
    setShowApproveModal(false);
    setBrandToAction(null);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setBrandToAction(null);
    setRejectReason("");
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return styles[status as keyof typeof styles] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Brand Registrations</h2>
        <p className="text-gray-600">Review and manage brand registration applications</p>
      </div>

      {/* Filters */}
        <div className="mb-6 flex gap-2">
          {["pending", "approved", "rejected"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                filter === status
                  ? "bg-red-800 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-red-200"
              }`}
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Brands Grid */}
        {brands.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No {filter} brand registrations</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {brand.registration_type === "company"
                          ? brand.company_name
                          : brand.name}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(brand.status)}`}
                      >
                        {brand.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                      <div>
                        <p className="text-gray-500">Type</p>
                        <p className="font-medium capitalize">{brand.registration_type}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Email</p>
                        <p className="font-medium">{brand.email}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Phone</p>
                        <p className="font-medium">{brand.phone}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Country</p>
                        <p className="font-medium">{brand.country}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-3">
                      <a
                        href={brand.poa_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        📄 POA Document
                      </a>
                      <a
                        href={brand.logo_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        🏷️ Logo
                      </a>
                      {brand.business_license_url && (
                        <a
                          href={brand.business_license_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          📋 Business License
                        </a>
                      )}
                    </div>
                  </div>

                  {brand.status === "pending" && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => openApproveModal(brand.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => openRejectModal(brand.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                {brand.status === "rejected" && brand.rejection_reason && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      <strong>Rejection Reason:</strong> {brand.rejection_reason}
                    </p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                  Submitted on {new Date(brand.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Approve Brand Registration</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to approve this brand registration? The applicant will be notified of the approval.
            </p>

            <div className="flex gap-3">
              <button
                onClick={closeApproveModal}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => brandToAction && handleApprove(brandToAction)}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Reject Brand Registration</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting this brand registration. The applicant will see this message.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all resize-none mb-6"
            />

            <div className="flex gap-3">
              <button
                onClick={closeRejectModal}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => brandToAction && handleReject(brandToAction)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
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
