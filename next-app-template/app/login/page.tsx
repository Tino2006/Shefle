"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");

  return (
    <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-8 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setActiveTab("login")}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                activeTab === "login"
                  ? "bg-red-800 text-white shadow-sm"
                  : "bg-transparent text-gray-700 hover:bg-white/50"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setActiveTab("signup")}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                activeTab === "signup"
                  ? "bg-red-800 text-white shadow-sm"
                  : "bg-transparent text-gray-700 hover:bg-white/50"
              }`}
            >
              Sign up
            </button>
          </div>

          {activeTab === "login" ? (
            <>
              {/* Login Form */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Login to your account
                </h1>
                <p className="text-sm text-gray-600">
                  Enter your email below to login to your account.
                </p>
              </div>

              <form className="space-y-5">
                {/* Email Field */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-900 mb-2"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    placeholder="Placeholder"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                  />
                </div>

                {/* Password Field */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-900 mb-2"
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    placeholder="Placeholder"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                  />
                  <div className="mt-2 text-right">
                    <Link
                      href="/forgot-password"
                      className="text-sm text-red-800 hover:text-red-900 transition-colors"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  className="w-full py-3.5 text-white text-base font-semibold bg-red-800 rounded-lg hover:bg-red-900 transition-colors shadow-sm"
                >
                  Login
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Sign Up Form */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Create your account
                </h1>
                <p className="text-sm text-gray-600">
                  Enter your email below to login to your account.
                </p>
              </div>

              <form className="space-y-5">
                {/* First Name Field */}
                <div>
                  <label
                    htmlFor="first-name"
                    className="block text-sm font-medium text-gray-900 mb-2"
                  >
                    First Name
                  </label>
                  <input
                    type="text"
                    id="first-name"
                    placeholder="Placeholder"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                  />
                </div>

                {/* Last Name Field */}
                <div>
                  <label
                    htmlFor="last-name"
                    className="block text-sm font-medium text-gray-900 mb-2"
                  >
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="last-name"
                    placeholder="Placeholder"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                  />
                </div>

                {/* Email Field */}
                <div>
                  <label
                    htmlFor="signup-email"
                    className="block text-sm font-medium text-gray-900 mb-2"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="signup-email"
                    placeholder="Placeholder"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                  />
                </div>

                {/* Password Field */}
                <div>
                  <label
                    htmlFor="signup-password"
                    className="block text-sm font-medium text-gray-900 mb-2"
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    id="signup-password"
                    placeholder="Placeholder"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                  />
                  <div className="mt-2 text-right">
                    <Link
                      href="/forgot-password"
                      className="text-sm text-red-800 hover:text-red-900 transition-colors"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                </div>

                {/* Sign Up Button */}
                <button
                  type="submit"
                  className="w-full py-3.5 text-white text-base font-semibold bg-red-800 rounded-lg hover:bg-red-900 transition-colors shadow-sm"
                >
                  Sign up
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
