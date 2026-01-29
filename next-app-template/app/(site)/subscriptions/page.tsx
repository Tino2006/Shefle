"use client";

import Image from "next/image";
import Link from "next/link";

const plans = [
  {
    price: 40,
    features: [
      "50 Searches available",
      "1 Monitor",
      "20 Notifications"
    ],
    highlighted: false,
  },
  {
    price: 50,
    features: [
      "70 Searches available",
      "2 Monitor",
      "40 Notifications"
    ],
    highlighted: true,
  },
  {
    price: 60,
    features: [
      "Unlimited Searches Available",
      "3 Monitor",
      "Unlimited Notifications"
    ],
    highlighted: false,
  },
];

export default function SubscriptionsPage() {
  return (
    <div className="w-full min-h-screen bg-white flex flex-col">
      {/* Main Content */}
      <div className="flex-1 mx-auto max-w-[1400px] px-4 lg:px-20 py-12 lg:py-20">
        {/* Page Header */}
        <div className="text-center mb-12 lg:mb-16">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
            Subscriptions
          </h1>
          <p className="text-base lg:text-lg text-gray-600 max-w-2xl mx-auto">
            Manage your personal information, preferences, and account settings.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`bg-white rounded-2xl p-8 flex flex-col ${
                plan.highlighted
                  ? "border-2 border-red-800 shadow-lg"
                  : "border border-gray-200 shadow-sm"
              }`}
            >
              {/* Price */}
              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-gray-900">
                    ${plan.price}
                  </span>
                  <span className="text-xl text-gray-500">/mo</span>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-4 mb-8 flex-1">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-800 flex items-center justify-center mt-0.5">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <span className="text-[15px] text-gray-900 leading-relaxed">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              {/* Buy Button */}
              <Link
                href={`/payment?price=${plan.price}`}
                className={`w-full px-6 py-3 text-base font-semibold rounded-lg transition-colors text-center block ${
                  plan.highlighted
                    ? "bg-red-800 text-white hover:bg-red-900"
                    : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                }`}
              >
                Buy
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-20 py-8">
          <div className="flex flex-col lg:flex-row items-start gap-32">
            {/* Left Column: Logo, Description, Social Icons */}
            <div className="flex-shrink-0 max-w-sm">
              <div className="mb-4">
                <div className="relative w-44 h-14">
                  <Image
                    src="/Images/Shefle-Logo.png"
                    alt="Shefle Logo"
                    fill
                    className="object-contain object-left"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-800 mb-5 leading-relaxed">
                Brand protection and intellectual property monitoring for businesses and creators worldwide.
              </p>
              <div className="flex items-center gap-4">
                <Link href="#" className="text-red-800 hover:text-red-900 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5a4.25 4.25 0 0 0 4.25 4.25h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5a4.25 4.25 0 0 0-4.25-4.25h-8.5zM12 7.25a4.75 4.75 0 1 1 0 9.5 4.75 4.75 0 0 1 0-9.5zm0 1.5a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5zM17.25 5.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
                  </svg>
                </Link>
                <Link href="#" className="text-red-800 hover:text-red-900 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </Link>
                <Link href="#" className="text-red-800 hover:text-red-900 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </Link>
                <Link href="#" className="text-red-800 hover:text-red-900 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Right Column: Company Links */}
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-4">Company</h3>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/" className="text-sm text-gray-600 hover:text-red-800 transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/monitor" className="text-sm text-gray-600 hover:text-red-800 transition-colors">
                    Monitor
                  </Link>
                </li>
                <li>
                  <Link href="/portfolio" className="text-sm text-gray-600 hover:text-red-800 transition-colors">
                    Portfolio
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="text-sm text-gray-600 hover:text-red-800 transition-colors">
                    Register
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-sm text-gray-600 hover:text-red-800 transition-colors">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link href="/subscriptions" className="text-sm text-gray-600 hover:text-red-800 transition-colors">
                    Subscription
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
