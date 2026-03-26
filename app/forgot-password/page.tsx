"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reset email");
      }

      toast.success("Reset email sent");
      setIsSubmitted(true);
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="w-full min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Brand Mark */}
          <div className="text-center mb-6">
            <div className="relative inline-block w-32 h-10 mb-3">
              <Image
                src="/Images/Shefle-Logo.png"
                alt="Shefle"
                fill
                className="object-contain"
                priority
              />
            </div>
            <p className="text-sm text-gray-600">Secure access to Shefle</p>
          </div>

          {/* Success Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Check your email
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                We've sent a password reset link to {email}
              </p>
              <Link
                href="/login"
                className="text-sm text-red-800 hover:text-red-900 font-medium transition-colors"
              >
                Return to sign in
              </Link>
            </div>
          </div>

          {/* Trust Cue */}
          <p className="text-center text-xs text-gray-400 mt-6">
            Secure access. Your data is protected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Mark */}
        <div className="text-center mb-6">
          <div className="relative inline-block w-32 h-10 mb-3">
            <Image
              src="/Images/Shefle-Logo.png"
              alt="Shefle"
              fill
              className="object-contain"
              priority
            />
          </div>
          <p className="text-sm text-gray-600">Secure access to Shefle</p>
        </div>

        {/* Reset Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-1">
              Reset your password
            </h1>
            <p className="text-sm text-gray-500">
              Enter your email address and we'll send you a reset link
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Email address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-colors"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 text-white text-sm font-semibold bg-red-800 rounded-md hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-800 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Sending..." : "Send reset link"}
            </button>

            {/* Back to Login */}
            <div className="text-center">
              <Link
                href="/login"
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          </form>
        </div>

        {/* Trust Cue */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Secure access. Your data is protected.
        </p>
      </div>
    </div>
  );
}
