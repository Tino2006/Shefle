"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface PortfolioTrademark {
  id: string;
  registration_number: string;
  country: string;
  niche_class: number;
  registration_date: string;
  logo_url: string | null;
  mark_name: string | null;
  created_at: string;
}

export default function PortfolioPage() {
  const [trademarks, setTrademarks] = useState<PortfolioTrademark[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<{ [key: string]: boolean }>({});

  const [regNumber, setRegNumber] = useState("");
  const [country, setCountry] = useState("");
  const [nicheClass, setNicheClass] = useState<number>(1);
  const [regDate, setRegDate] = useState("");
  const [markName, setMarkName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTrademarks();
  }, []);

  const loadTrademarks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portfolio");
      if (res.ok) {
        const data = await res.json();
        setTrademarks(data.trademarks || []);
      }
    } catch (error) {
      console.error("Error loading portfolio:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a PNG, JPG, or WEBP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert("Image must be under 8MB.");
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setRegNumber("");
    setCountry("");
    setNicheClass(1);
    setRegDate("");
    setMarkName("");
    clearLogo();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNumber.trim() || !country.trim() || !regDate) {
      alert("Please fill in all required fields.");
      return;
    }

    setCreating(true);
    try {
      let logoUrl: string | null = null;

      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        formData.append("fileType", "portfolio-logo");

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          alert(`Logo upload failed: ${err.error || "Unknown error"}`);
          setCreating(false);
          return;
        }

        const uploadData = await uploadRes.json();
        logoUrl = uploadData.fileUrl;
      }

      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_number: regNumber.trim(),
          country: country.trim(),
          niche_class: nicheClass,
          registration_date: regDate,
          logo_url: logoUrl,
          mark_name: markName.trim() || null,
        }),
      });

      if (res.ok) {
        resetForm();
        setShowCreateForm(false);
        loadTrademarks();
      } else {
        const error = await res.json();
        alert(`Failed to create trademark: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error creating trademark:", error);
      alert("Error creating trademark");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this trademark? Any monitors linked to it will be unlinked.")) {
      return;
    }

    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadTrademarks();
      } else {
        alert("Failed to delete trademark");
      }
    } catch (error) {
      console.error("Error deleting trademark:", error);
      alert("Error deleting trademark");
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
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
            &larr; Back to Home
          </Link>

          <div className="mt-3 flex flex-col gap-4 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Trademark Portfolio
              </h1>
              <p className="mt-1 text-sm text-gray-600 sm:text-base">
                Register your trademarks to monitor them for infringements
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="w-full shrink-0 rounded-lg bg-red-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-900 sm:w-auto sm:px-6 sm:py-3 sm:text-base"
            >
              {showCreateForm ? "Cancel" : "+ Add Trademark"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 sm:mb-8 sm:p-6">
            <h2 className="mb-3 text-lg font-bold text-gray-900 sm:mb-4 sm:text-xl">
              Add New Trademark
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Registration Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    placeholder="e.g. 1234567"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-red-800 focus:outline-none focus:ring-2 focus:ring-red-800/20"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Mark Name <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={markName}
                    onChange={(e) => setMarkName(e.target.value)}
                    placeholder="e.g. My Brand"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-red-800 focus:outline-none focus:ring-2 focus:ring-red-800/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. United States"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:border-red-800 focus:outline-none focus:ring-2 focus:ring-red-800/20"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Niche Class (1-45) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={45}
                    value={nicheClass}
                    onChange={(e) => setNicheClass(parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-red-800 focus:outline-none focus:ring-2 focus:ring-red-800/20"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Registration Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={regDate}
                    onChange={(e) => setRegDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-red-800 focus:outline-none focus:ring-2 focus:ring-red-800/20"
                    required
                  />
                </div>
              </div>

              {/* Logo Upload */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Logo <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                {logoPreview ? (
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={clearLogo}
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
                      <svg
                        className="mx-auto h-8 w-8 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
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
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:gap-3 sm:pt-2">
                <button
                  type="submit"
                  disabled={creating || !regNumber.trim() || !country.trim() || !regDate}
                  className="w-full rounded-lg bg-red-800 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-gray-400 sm:w-auto sm:px-6 sm:py-2"
                >
                  {creating ? "Adding..." : "Add Trademark"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto sm:px-6 sm:py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Trademarks List */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800"></div>
          </div>
        ) : trademarks.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="text-gray-400 mb-3">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">No trademarks in your portfolio</p>
            <p className="text-sm text-gray-500 mt-1">
              Add your registered trademarks to start monitoring them
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 text-red-800 hover:text-red-900 font-semibold"
            >
              Add your first trademark
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trademarks.map((tm) => (
              <div
                key={tm.id}
                className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {tm.logo_url ? (
                    <div className="w-16 h-16 shrink-0 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                      <img
                        src={tm.logo_url}
                        alt={tm.mark_name || tm.registration_number}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 shrink-0 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
                      <svg
                        className="h-8 w-8 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 truncate">
                      {tm.mark_name || `#${tm.registration_number}`}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Reg. #{tm.registration_number}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Country</span>
                    <p className="font-medium text-gray-900">{tm.country}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Niche Class</span>
                    <p className="font-medium text-gray-900">Class {tm.niche_class}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Registered</span>
                    <p className="font-medium text-gray-900">
                      {new Date(tm.registration_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href="/monitor"
                    className="flex-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-800 transition-colors hover:bg-red-100"
                  >
                    Monitor
                  </Link>
                  <button
                    onClick={() => handleDelete(tm.id)}
                    disabled={deleting[tm.id]}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting[tm.id] ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
