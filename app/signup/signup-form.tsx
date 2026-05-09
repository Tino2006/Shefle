"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Image from "next/image";

import { createClient } from "@/lib/supabase/client";

const REFERRAL_STORAGE_KEY = "shefle_signup_referral";

export default function SignupForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [oauthProviderLoading, setOauthProviderLoading] = useState<
    "google" | "apple" | null
  >(null);

  const [signupForm, setSignupForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    referralCode: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("ref");

    if (fromQuery && fromQuery.trim()) {
      const v = fromQuery.trim().toUpperCase();

      setSignupForm((prev) => ({ ...prev, referralCode: v }));
      try {
        sessionStorage.setItem(REFERRAL_STORAGE_KEY, v);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        ...signupForm,
        referralCode: signupForm.referralCode.trim() || undefined,
      };

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      toast.success(
        data.message || "Account created! Please check your email to verify.",
      );
      try {
        sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      router.push("/login");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getStoredReferral = (): string | undefined => {
    try {
      const s = sessionStorage.getItem(REFERRAL_STORAGE_KEY);

      return s?.trim() || signupForm.referralCode.trim() || undefined;
    } catch {
      return signupForm.referralCode.trim() || undefined;
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    try {
      setOauthProviderLoading(provider);
      const supabase = createClient();
      const callbackUrl = new URL("/auth/callback", window.location.origin);

      callbackUrl.searchParams.set("next", "/");

      const referral = getStoredReferral();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: { prompt: "select_account" },
          ...(referral
            ? {
                data: {
                  referral_code: referral,
                },
              }
            : {}),
        },
      });

      if (error) {
        throw error;
      }

      if (!data.url) {
        throw new Error("Missing OAuth redirect URL");
      }

      window.location.href = data.url;
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Social signup failed",
      );
      setOauthProviderLoading(null);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="relative inline-block w-52 h-16 mb-4">
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

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-1">
              Create your account
            </h1>
            <p className="text-sm text-gray-500">
              Get started with brand protection
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSignupSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                  htmlFor="first-name"
                >
                  First name
                </label>
                <input
                  required
                  autoComplete="given-name"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-colors"
                  id="first-name"
                  placeholder="John"
                  type="text"
                  value={signupForm.firstName}
                  onChange={(e) =>
                    setSignupForm({ ...signupForm, firstName: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                  htmlFor="last-name"
                >
                  Last name
                </label>
                <input
                  required
                  autoComplete="family-name"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-colors"
                  id="last-name"
                  placeholder="Doe"
                  type="text"
                  value={signupForm.lastName}
                  onChange={(e) =>
                    setSignupForm({ ...signupForm, lastName: e.target.value })
                  }
                />
              </div>
            </div>

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
                value={signupForm.email}
                onChange={(e) =>
                  setSignupForm({ ...signupForm, email: e.target.value })
                }
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-gray-700 mb-1.5"
                htmlFor="password"
              >
                Password
              </label>
              <input
                required
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-colors"
                id="password"
                minLength={8}
                placeholder="Minimum 8 characters"
                type="password"
                value={signupForm.password}
                onChange={(e) =>
                  setSignupForm({ ...signupForm, password: e.target.value })
                }
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-gray-700 mb-1.5"
                htmlFor="referral-code"
              >
                Referral code{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                autoComplete="off"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-colors uppercase"
                id="referral-code"
                placeholder="e.g. JPX92A"
                type="text"
                value={signupForm.referralCode}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();

                  setSignupForm({ ...signupForm, referralCode: v });
                  try {
                    if (v.trim())
                      sessionStorage.setItem(REFERRAL_STORAGE_KEY, v.trim());
                    else sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
                  } catch {
                    /* ignore */
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Have a referral link? It may fill this automatically.
              </p>
            </div>

            <button
              className="w-full py-2.5 text-white text-sm font-semibold bg-red-800 rounded-md hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-800 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              disabled={isLoading || oauthProviderLoading !== null}
              type="submit"
            >
              {isLoading ? "Creating account..." : "Create account"}
            </button>

            <div className="space-y-2">
              <button
                className="w-full py-2.5 text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || oauthProviderLoading !== null}
                type="button"
                onClick={() => handleOAuthSignIn("google")}
              >
                {oauthProviderLoading === "google"
                  ? "Redirecting to Google..."
                  : "Continue with Google"}
              </button>
              <button
                className="w-full py-2.5 text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || oauthProviderLoading !== null}
                type="button"
                onClick={() => handleOAuthSignIn("apple")}
              >
                {oauthProviderLoading === "apple"
                  ? "Redirecting to Apple..."
                  : "Continue with Apple"}
              </button>
            </div>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-gray-400">
                Already have an account?
              </span>
            </div>
          </div>

          <div className="text-center">
            <Link
              className="text-sm text-red-800 hover:text-red-900 font-medium transition-colors"
              href="/login"
            >
              Sign in instead
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Secure access. Your data is protected.
        </p>
      </div>
    </div>
  );
}
