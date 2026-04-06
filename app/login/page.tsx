"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { sanitizeRedirectPath } from "@/lib/sanitize-redirect";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [oauthProviderLoading, setOauthProviderLoading] = useState(false);
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
      const redirectTo =
        data.role === "admin"
          ? "/admin"
          : sanitizeRedirectPath(searchParams.get("redirect"), "/");

      router.push(redirectTo);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setOauthProviderLoading(true);
      const supabase = createClient();
      const redirectTo = sanitizeRedirectPath(searchParams.get("redirect"), "/");
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
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
      setOauthProviderLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Mark */}
        <div className="text-center mb-6">
          <div className="relative inline-block w-52 h-16 mb-4">
            <Image
              src="/Images/Shefle-Logo.png"
              alt="Shefle"
              fill
              className="object-contain mix-blend-multiply"
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
              disabled={isLoading || oauthProviderLoading}
              className="w-full py-2.5 text-white text-sm font-semibold bg-red-800 rounded-md hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-800 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading || oauthProviderLoading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="shrink-0 size-[18px]"
                viewBox="0 0 24 24"
                aria-hidden
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {oauthProviderLoading ? "Redirecting to Google..." : "Continue with Google"}
            </button>

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
