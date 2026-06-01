"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { isValidPhoneNumber } from "libphonenumber-js";

import { getCountryOptions, normalizeCountryForSelect } from "@/lib/countries";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function ProfilePage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    company: "",
  });

  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const countryOptions = useMemo(() => getCountryOptions(), []);

  const [referralInfo, setReferralInfo] = useState<{
    code: string | null;
    referralCount: number;
    referredUsers: { id: string; email: string | null; created_at: string }[];
  } | null>(null);

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Get current user
        const userResponse = await fetch("/api/auth/me");

        if (!userResponse.ok) {
          router.push("/login");

          return;
        }
        const userData = await userResponse.json();

        setUser(userData.user);

        // Get profile data
        const profileResponse = await fetch("/api/profile");

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const profile = profileData.profile;

          setFormData({
            firstName: profile.first_name || "",
            lastName: profile.last_name || "",
            email: userData.user.email || "",
            phone: profile.phone || "",
            country: normalizeCountryForSelect(profile.country),
            company: profile.company_name || "",
          });

          if (profileData.referral) {
            setReferralInfo(profileData.referral);
          }
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    if (name === "phone") {
      // Allow only digits, +, spaces, dashes, and parentheses
      const cleaned = value.replace(/[^\d+\-\s()]/g, "");

      setFormData({ ...formData, phone: cleaned });

      // Clear inline error as user types; we'll re-validate on submit
      if (phoneError) setPhoneError(null);

      return;
    }

    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone (allow empty; reject anything else that doesn't parse)
    const phone = formData.phone.trim();

    if (phone !== "" && !isValidPhoneNumber(phone)) {
      setPhoneError(
        "Please enter a valid phone number in international format (e.g. +1 415 555 0132).",
      );
      toast.error("Invalid phone number");

      return;
    }
    setPhoneError(null);

    setIsSaving(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          companyName: formData.company,
          phone: formData.phone,
          country: formData.country,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords don't match");

      return;
    }

    // Validate password length
    if (passwordForm.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");

      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      toast.success("Password changed successfully");
      setShowPasswordModal(false);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast.error(error.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto mb-4" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white lg:bg-gradient-to-br lg:from-gray-50 lg:via-white lg:to-gray-50">
      {/* Container */}
      <div className="mx-auto max-w-[1280px] px-4 py-8 lg:px-16 lg:pt-12 lg:pb-20">
        {/* Page Header */}
        <motion.div
          animate={fadeInUp.animate}
          className="mb-8 lg:mb-12"
          initial={fadeInUp.initial}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h1 className="text-3xl lg:text-[2.75rem] lg:leading-tight font-bold text-red-800 mb-3">
            Profile Overview
          </h1>
          <p className="text-base lg:text-lg text-gray-600">
            Manage your personal information, preferences, and account settings.
          </p>
        </motion.div>

        {/* Two-Column Grid Layout on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-10">
          {/* Left Column - Profile Form Card */}
          <motion.div
            animate={fadeInUp.animate}
            className="bg-white lg:rounded-2xl lg:shadow-lg lg:border lg:border-gray-100 lg:p-10 transition-shadow duration-300"
            initial={fadeInUp.initial}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <form className="space-y-8" onSubmit={handleSubmit}>
              {/* Personal Information Section */}
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">
                    Personal Information
                  </h2>
                  <p className="text-sm text-gray-500">
                    Update your basic profile details
                  </p>
                </div>

                {/* Name Fields - Two Column on All Screens */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="firstName"
                    >
                      First Name
                    </label>
                    <input
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                      id="firstName"
                      name="firstName"
                      placeholder="Enter first name"
                      type="text"
                      value={formData.firstName}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="lastName"
                    >
                      Last Name
                    </label>
                    <input
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                      id="lastName"
                      name="lastName"
                      placeholder="Enter last name"
                      type="text"
                      value={formData.lastName}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Company Name - Full Width */}
                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-gray-700"
                    htmlFor="company"
                  >
                    Company Name{" "}
                    <span className="text-gray-400 font-normal">
                      (optional)
                    </span>
                  </label>
                  <input
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                    id="company"
                    name="company"
                    placeholder="Enter company name"
                    type="text"
                    value={formData.company}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="space-y-5 pt-6 border-t border-gray-100">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">
                    Contact Information
                  </h2>
                  <p className="text-sm text-gray-500">
                    Keep your contact details up to date
                  </p>
                </div>

                {/* Email - Full Width */}
                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-gray-700"
                    htmlFor="email"
                  >
                    Email Address
                  </label>
                  <input
                    disabled
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300 cursor-not-allowed"
                    id="email"
                    name="email"
                    placeholder="your.email@example.com"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Email cannot be changed
                  </p>
                </div>

                {/* Phone & Country - Two Column */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="phone"
                    >
                      Phone Number
                    </label>
                    <input
                      aria-describedby={
                        phoneError ? "phone-error" : "phone-help"
                      }
                      aria-invalid={phoneError ? true : undefined}
                      className={`w-full px-4 py-3 border rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:shadow-sm hover:border-gray-300 ${
                        phoneError
                          ? "border-red-500 focus:ring-red-500/20 focus:border-red-600"
                          : "border-gray-200 focus:ring-red-800/20 focus:border-red-800"
                      }`}
                      id="phone"
                      inputMode="tel"
                      name="phone"
                      placeholder="+1 415 555 0132"
                      type="tel"
                      value={formData.phone}
                      onBlur={() => {
                        const phone = formData.phone.trim();

                        if (phone !== "" && !isValidPhoneNumber(phone)) {
                          setPhoneError(
                            "Please enter a valid phone number in international format (e.g. +1 415 555 0132).",
                          );
                        } else {
                          setPhoneError(null);
                        }
                      }}
                      onChange={handleChange}
                    />
                    {phoneError ? (
                      <p
                        className="text-xs text-red-600 mt-1"
                        id="phone-error"
                      >
                        {phoneError}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1" id="phone-help">
                        Include country code, e.g. +1 415 555 0132.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="country"
                    >
                      Country
                    </label>
                    <select
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                    >
                      <option value="">Select country</option>
                      {formData.country &&
                        !countryOptions.some(
                          (c) => c.code === formData.country,
                        ) && (
                          <option value={formData.country}>
                            {formData.country}
                          </option>
                        )}
                      {countryOptions.map(({ code, name }) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-8 border-t border-gray-100">
                <button
                  className="px-6 py-3 text-gray-700 text-base font-medium bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 transition-all duration-200"
                  type="button"
                  onClick={() => router.push("/")}
                >
                  Cancel
                </button>
                <motion.button
                  className="px-8 py-3.5 text-white text-base font-semibold bg-red-800 rounded-xl hover:bg-red-900 active:bg-red-950 transition-all duration-200 shadow-md hover:shadow-lg min-w-[180px] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSaving}
                  type="submit"
                  whileHover={
                    !prefersReducedMotion ? { y: -3, scale: 1.01 } : {}
                  }
                  whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </motion.button>
              </div>
            </form>
          </motion.div>

          {/* Right Column - Additional Settings Cards */}
          <div className="space-y-6 lg:mt-0 mt-8">
            {/* Account Security Header */}
            <motion.div
              animate={fadeInUp.animate}
              className="mb-6"
              initial={fadeInUp.initial}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Account Settings
              </h2>
              <p className="text-sm text-gray-500">
                Manage security and preferences
              </p>
            </motion.div>

            {/* Referrals (tracking only) */}
            {referralInfo && (
              <motion.div
                animate={fadeInUp.animate}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm"
                initial={fadeInUp.initial}
                transition={{ duration: 0.6, delay: 0.32 }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-red-800"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      Referrals
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Share your code so others can join. Referral tracking only
                      (no rewards in this version).
                    </p>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          Your code
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="text-base font-mono font-semibold text-gray-900 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                            {referralInfo.code ?? "—"}
                          </code>
                          {referralInfo.code ? (
                            <button
                              className="text-sm font-medium text-red-800 hover:text-red-900 transition-colors"
                              type="button"
                              onClick={() => {
                                const origin =
                                  typeof window !== "undefined"
                                    ? window.location.origin
                                    : "";
                                const link = `${origin}/signup?ref=${encodeURIComponent(referralInfo.code!)}`;

                                void navigator.clipboard
                                  .writeText(link)
                                  .then(() => {
                                    toast.success("Referral link copied");
                                  });
                              }}
                            >
                              Copy link
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold text-gray-900">
                          {referralInfo.referralCount}
                        </span>{" "}
                        {referralInfo.referralCount === 1
                          ? "user has"
                          : "users have"}{" "}
                        signed up with your code
                      </p>
                      {referralInfo.referredUsers.length > 0 && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Referred users
                          </p>
                          <ul className="space-y-2 max-h-40 overflow-y-auto">
                            {referralInfo.referredUsers.map((u) => (
                              <li
                                key={u.id}
                                className="flex justify-between gap-3 text-sm text-gray-700"
                              >
                                <span className="truncate">
                                  {u.email ?? u.id.slice(0, 8) + "…"}
                                </span>
                                <span className="text-gray-500 shrink-0">
                                  {new Date(u.created_at).toLocaleDateString()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Password Card */}
            <motion.div
              animate={fadeInUp.animate}
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
              initial={fadeInUp.initial}
              transition={{ duration: 0.6, delay: 0.35 }}
              whileHover={!prefersReducedMotion ? { y: -4, scale: 1.02 } : {}}
              onClick={() => setShowPasswordModal(true)}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-red-800"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Password
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Update your password to keep your account secure
                  </p>
                  <button
                    className="text-sm font-medium text-red-800 hover:text-red-900 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPasswordModal(true);
                    }}
                  >
                    Change password →
                  </button>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowPasswordModal(false)}
        >
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-red-800"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Change Password
                </h2>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setShowPasswordModal(false)}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </button>
            </div>

            {/* Password Change Form */}
            <form className="space-y-5" onSubmit={handlePasswordChange}>
              {/* Current Password */}
              <div className="space-y-2">
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="currentPassword"
                >
                  Current Password
                </label>
                <input
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                  id="currentPassword"
                  placeholder="Enter current password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value,
                    })
                  }
                />
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="newPassword"
                >
                  New Password
                </label>
                <input
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                  id="newPassword"
                  minLength={8}
                  placeholder="Enter new password (min. 8 characters)"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                />
              </div>

              {/* Confirm New Password */}
              <div className="space-y-2">
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="confirmPassword"
                >
                  Confirm New Password
                </label>
                <input
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                  id="confirmPassword"
                  minLength={8}
                  placeholder="Confirm new password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                <button
                  className="flex-1 px-6 py-3 text-gray-700 text-base font-medium bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 transition-all duration-200"
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 px-6 py-3 text-white text-base font-semibold bg-red-800 rounded-xl hover:bg-red-900 active:bg-red-950 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isChangingPassword}
                  type="submit"
                >
                  {isChangingPassword ? "Changing..." : "Change Password"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
