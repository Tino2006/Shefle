"use client";

import type { EmailOtpType } from "@supabase/supabase-js";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import Image from "next/image";

import { createClient } from "@/lib/supabase/client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const code = useMemo(() => searchParams.get("code"), [searchParams]);
  const tokenHash = useMemo(
    () => searchParams.get("token_hash"),
    [searchParams],
  );
  const otpType = useMemo(
    () => searchParams.get("type") as EmailOtpType | null,
    [searchParams],
  );

  useEffect(() => {
    const prepareRecoverySession = async () => {
      try {
        // New links route through /auth/callback and arrive with a valid session.
        // Support old links that still include ?code=... on /reset-password.
        const supabase = createClient();

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }
        } else if (tokenHash && otpType === "recovery") {
          // Support links using token_hash/type query parameters.
          const { error } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });

          if (error) {
            throw error;
          }
        }

        setIsReady(true);
      } catch (error: any) {
        toast.error(error?.message || "Invalid or expired reset link");
      } finally {
        setIsPreparing(false);
      }
    };

    prepareRecoverySession();
  }, [code, otpType, tokenHash]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");

      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");

      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      toast.success("Password updated successfully");
      router.push("/login");
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Could not reset password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="relative inline-block w-32 h-10 mb-3">
            <Image
              fill
              priority
              alt="Shefle"
              className="object-contain"
              src="/Images/Shefle-Logo.png"
            />
          </div>
          <p className="text-sm text-gray-600">Secure access to Shefle</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-1">
              Set a new password
            </h1>
            <p className="text-sm text-gray-500">
              Choose a strong password to secure your account.
            </p>
          </div>

          {isPreparing ? (
            <p className="text-sm text-gray-600">Validating reset link...</p>
          ) : !isReady ? (
            <div className="space-y-3">
              <p className="text-sm text-red-600">
                This password reset link is invalid or expired.
              </p>
              <Link
                className="inline-block text-sm text-red-800 hover:text-red-900 font-medium transition-colors"
                href="/forgot-password"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                  htmlFor="new-password"
                >
                  New password
                </label>
                <input
                  required
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-colors"
                  id="new-password"
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                  htmlFor="confirm-password"
                >
                  Confirm new password
                </label>
                <input
                  required
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-colors"
                  id="confirm-password"
                  minLength={8}
                  placeholder="Re-enter your password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                className="w-full py-2.5 text-white text-sm font-semibold bg-red-800 rounded-md hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-800 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
                type="submit"
              >
                {isLoading ? "Updating..." : "Update password"}
              </button>

              <div className="text-center">
                <Link
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  href="/login"
                >
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Secure access. Your data is protected.
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
