"use client";

import { motion, useReducedMotion } from "framer-motion";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const plans = [
  {
    name: "Starter",
    price: 40,
    features: [
      "50 Searches available",
      "1 Monitor",
      "20 Notifications"
    ],
    highlighted: false,
  },
  {
    name: "Professional",
    price: 50,
    features: [
      "70 Searches available",
      "2 Monitors",
      "40 Notifications"
    ],
    highlighted: true,
    badge: "Most Popular"
  },
  {
    name: "Enterprise",
    price: 60,
    features: [
      "Unlimited Searches Available",
      "3 Monitors",
      "Unlimited Notifications"
    ],
    highlighted: false,
  },
];

export default function SubscriptionsPage() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="w-full min-h-screen bg-white lg:bg-gradient-to-br lg:from-gray-50 lg:via-white lg:to-gray-50">
      {/* Container */}
      <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-16 lg:pt-12 lg:pb-20">
        {/* Page Header */}
        <motion.div
          className="text-center mb-10 lg:mb-16"
          initial={fadeInUp.initial}
          animate={fadeInUp.animate}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h1 className="text-3xl lg:text-[2.75rem] lg:leading-tight font-bold text-red-800 mb-4">
            Subscriptions
          </h1>
          <p className="text-base lg:text-lg text-gray-600 max-w-2xl mx-auto">
            Manage your personal information, preferences, and account settings.
          </p>
        </motion.div>

        {/* Pricing Cards Grid - Three Columns on Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              className={`relative bg-white rounded-2xl p-7 md:p-9 lg:p-10 transition-all duration-300 flex flex-col ${
                plan.highlighted
                  ? "border-2 border-red-800 shadow-xl md:col-span-2 lg:col-span-1 lg:scale-[1.06] lg:-mt-6 lg:mb-6"
                  : "border border-gray-100 shadow-md hover:shadow-xl"
              }`}
              initial={fadeInUp.initial}
              animate={fadeInUp.animate}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
              whileHover={
                !prefersReducedMotion && !plan.highlighted
                  ? { y: -8, scale: 1.02 }
                  : {}
              }
            >
              {/* Badge for highlighted plan */}
              {plan.highlighted && plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-red-800 text-white text-xs font-semibold rounded-full shadow-md">
                  {plan.badge}
                </div>
              )}

              {/* Plan Name */}
              <div className="mb-4 md:mb-5">
                <h3 className="text-lg md:text-xl font-bold text-gray-900">
                  {plan.name}
                </h3>
              </div>

              {/* Price */}
              <div className="mb-7 md:mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl md:text-[3.5rem] font-bold text-gray-900 leading-none">
                    ${plan.price}
                  </span>
                  <span className="text-xl md:text-2xl text-gray-500 font-medium">/mo</span>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-3.5 md:space-y-4 mb-8 md:mb-10 flex-1">
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
                    <span className="text-[15px] text-gray-700 leading-relaxed font-medium">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <motion.button
                className={`w-full px-6 py-3.5 md:py-4 text-base font-semibold rounded-xl transition-all duration-200 ${
                  plan.highlighted
                    ? "bg-red-800 text-white hover:bg-red-900 shadow-md hover:shadow-lg"
                    : "bg-white text-gray-900 hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300"
                }`}
                whileHover={!prefersReducedMotion ? { y: -2 } : {}}
                whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
              >
                Buy
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* FAQ or Additional Info Section */}
        <motion.div
          className="mt-16 md:mt-20 lg:mt-24 text-center"
          initial={fadeInUp.initial}
          animate={fadeInUp.animate}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-3 md:mb-4">
            Need help choosing?
          </h2>
          <p className="text-sm md:text-base lg:text-lg text-gray-600 mb-5 md:mb-6 max-w-2xl mx-auto leading-relaxed px-4">
            All plans include brand protection monitoring, email alerts, and detailed reports. Upgrade or downgrade anytime.
          </p>
          <button className="text-red-800 text-sm md:text-base font-semibold hover:text-red-900 transition-colors">
            Contact our sales team →
          </button>
        </motion.div>

        {/* Feature Comparison Table */}
        <motion.div
          className="mt-16 md:mt-20 lg:mt-28"
          initial={fadeInUp.initial}
          animate={fadeInUp.animate}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-8 md:mb-10 lg:mb-12 text-center">
            Compare Features
          </h2>
          
          <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-left text-sm md:text-base font-bold text-gray-900">
                      Feature
                    </th>
                    {plans.map((plan) => (
                      <th
                        key={plan.name}
                        className={`px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center text-sm md:text-base font-bold ${
                          plan.highlighted ? "text-red-800 bg-red-50" : "text-gray-900"
                        }`}
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-sm md:text-[15px] font-medium text-gray-700">
                      Brand Searches
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center text-sm md:text-[15px] text-gray-900">
                      50
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center text-sm md:text-[15px] font-semibold text-red-800 bg-red-50/50">
                      70
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center text-sm md:text-[15px] text-gray-900">
                      Unlimited
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-sm md:text-[15px] font-medium text-gray-700">
                      Active Monitors
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center text-sm md:text-[15px] text-gray-900">
                      1
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center text-sm md:text-[15px] font-semibold text-red-800 bg-red-50/50">
                      2
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center text-sm md:text-[15px] text-gray-900">
                      3
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-sm md:text-[15px] font-medium text-gray-700">
                      Monthly Notifications
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center text-sm md:text-[15px] text-gray-900">
                      20
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center text-sm md:text-[15px] font-semibold text-red-800 bg-red-50/50">
                      40
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center text-sm md:text-[15px] text-gray-900">
                      Unlimited
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-sm md:text-[15px] font-medium text-gray-700">
                      Priority Support
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-300 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center bg-red-50/50">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-red-800 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-red-800 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-sm md:text-[15px] font-medium text-gray-700">
                      API Access
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-300 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center bg-red-50/50">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-300 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </td>
                    <td className="px-4 md:px-6 lg:px-8 py-4 md:py-5 text-center">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-red-800 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
