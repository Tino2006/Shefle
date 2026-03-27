"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [oauthProviderLoading, setOauthProviderLoading] = useState<"google" | "apple" | null>(null);
  const verified = searchParams.get("verified");
  const authError = searchParams.get("error_code") || searchParams.get("error");

  useEffect(() => {
    if (verified === "1") {
      toast.success("Email verified. You can sign in now.");
      return;
    }

    if (authError === "otp_expired") {
      toast.error("Verification link is invalid or expired. Please request a new one.");
    }
  }, [verified, authError]);

  // Login form state
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      toast.success("Login successful");
      
      // Redirect admins to admin panel, regular users to redirect param or home
      const redirectTo = data.role === 'admin' 
        ? '/admin' 
        : (searchParams.get('redirect') || '/');
      
      router.push(redirectTo);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    try {
      setOauthProviderLoading(provider);
      const supabase = createClient();
      const redirectTo = searchParams.get("redirect") || "/";
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        throw error;
      }

      if (!data.url) {
        throw new Error("Missing OAuth redirect URL");
      }

      window.location.href = data.url;
    } catch (error: any) {
      toast.error(error.message || "Social login failed");
      setOauthProviderLoading(null);
    }
  };

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

        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-1">
              Sign in to your account
            </h1>
            <p className="text-sm text-gray-500">
              Enter your credentials to continue
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-5">
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
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                placeholder="you@company.com"
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-colors"
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-colors"
              />
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading || oauthProviderLoading !== null}
              className="w-full py-2.5 text-white text-sm font-semibold bg-red-800 rounded-md hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-800 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleOAuthSignIn("google")}
                disabled={isLoading || oauthProviderLoading !== null}
                className="w-full py-2.5 text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthProviderLoading === "google" ? "Redirecting to Google..." : "Continue with Google"}
              </button>
              <button
                type="button"
                onClick={() => handleOAuthSignIn("apple")}
                disabled={isLoading || oauthProviderLoading !== null}
                className="w-full py-2.5 text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthProviderLoading === "apple" ? "Redirecting to Apple..." : "Continue with Apple"}
              </button>
            </div>

            {/* Forgot Password */}
            <div className="text-center">
              <Link
                href="/forgot-password"
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Forgot your password?
              </Link>
            </div>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-gray-400">New to Shefle?</span>
            </div>
          </div>

          {/* Sign Up Link */}
          <div className="text-center">
            <Link
              href="/signup"
              className="text-sm text-red-800 hover:text-red-900 font-medium transition-colors"
            >
              Create an account
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="w-full min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
