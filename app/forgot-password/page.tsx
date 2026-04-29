"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

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
        if (response.status === 429) {
          const retryAfterSeconds =
            typeof data.retryAfterSeconds === "number" &&
            data.retryAfterSeconds > 0
              ? data.retryAfterSeconds
              : 60;

          setCooldownSeconds(retryAfterSeconds);
          throw new Error(
            `Too many attempts. Please wait ${retryAfterSeconds}s before retrying.`,
          );
        }

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
                fill
                priority
                alt="Shefle"
                className="object-contain mix-blend-multiply"
                src="/Images/Shefle-Logo.png"
              />
            </div>
            <p className="text-sm text-gray-600">Secure access to Shefle</p>
          </div>

          {/* Success Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Check your email
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                We've sent a password reset link to {email}
              </p>
              <Link
                className="text-sm text-red-800 hover:text-red-900 font-medium transition-colors"
                href="/login"
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
              fill
              priority
              alt="Shefle"
              className="object-contain mix-blend-multiply"
              src="/Images/Shefle-Logo.png"
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

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div>
              <label
                className="block text-sm font-medium text-gray-700 mb-1.5"
                htmlFor="email"
              >
                Email address
              </label>
              <input
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-colors"
                id="email"
                placeholder="you@company.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Submit Button */}
            <button
              className="w-full py-2.5 text-white text-sm font-semibold bg-red-800 rounded-md hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-800 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || cooldownSeconds > 0}
              type="submit"
            >
              {isLoading
                ? "Sending..."
                : cooldownSeconds > 0
                  ? `Try again in ${cooldownSeconds}s`
                  : "Send reset link"}
            </button>

            {/* Back to Login */}
            <div className="text-center">
              <Link
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                href="/login"
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
