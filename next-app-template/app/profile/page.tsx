"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function ProfilePage() {
  const prefersReducedMotion = useReducedMotion();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    company: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log("Form submitted:", formData);
  };

  return (
    <div className="w-full min-h-screen bg-white lg:bg-gradient-to-br lg:from-gray-50 lg:via-white lg:to-gray-50">
      {/* Container */}
      <div className="mx-auto max-w-[1280px] px-4 py-8 lg:px-16 lg:pt-12 lg:pb-20">
        {/* Page Header */}
        <motion.div
          className="mb-8 lg:mb-12"
          initial={fadeInUp.initial}
          animate={fadeInUp.animate}
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
            className="bg-white lg:rounded-2xl lg:shadow-lg lg:border lg:border-gray-100 lg:p-10 transition-shadow duration-300"
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
          <form onSubmit={handleSubmit} className="space-y-8">
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
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              {/* Company Name - Full Width */}
              <div className="space-y-2">
                <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                  Company Name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                  placeholder="Enter company name"
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
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                  placeholder="your.email@example.com"
                />
              </div>

              {/* Phone & Country - Two Column */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                    Country
                  </label>
                  <select
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                  >
                    <option value="">Select country</option>
                    <option value="us">United States</option>
                    <option value="ca">Canada</option>
                    <option value="uk">United Kingdom</option>
                    <option value="au">Australia</option>
                    <option value="lb">Lebanon</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-8 border-t border-gray-100">
              <button
                type="button"
                className="px-6 py-3 text-gray-700 text-base font-medium bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 transition-all duration-200"
              >
                Cancel
              </button>
              <motion.button
                type="submit"
                className="px-8 py-3.5 text-white text-base font-semibold bg-red-800 rounded-xl hover:bg-red-900 active:bg-red-950 transition-all duration-200 shadow-md hover:shadow-lg min-w-[180px]"
                whileHover={!prefersReducedMotion ? { y: -3, scale: 1.01 } : {}}
                whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
              >
                Save Changes
              </motion.button>
            </div>
          </form>
        </motion.div>

        {/* Right Column - Additional Settings Cards */}
        <div className="space-y-6 lg:mt-0 mt-8">
          {/* Account Security Header */}
          <motion.div
            className="mb-6"
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Account Settings
            </h2>
            <p className="text-sm text-gray-500">
              Manage security and preferences
            </p>
          </motion.div>

          {/* Password Card */}
          <motion.div
            className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={{ duration: 0.6, delay: 0.35 }}
            whileHover={!prefersReducedMotion ? { y: -4, scale: 1.02 } : {}}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Password
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Update your password to keep your account secure
                </p>
                <button className="text-sm font-medium text-red-800 hover:text-red-900 transition-colors">
                  Change password →
                </button>
              </div>
            </div>
          </motion.div>

          {/* Notifications Card */}
          <motion.div
            className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={{ duration: 0.6, delay: 0.4 }}
            whileHover={!prefersReducedMotion ? { y: -4, scale: 1.02 } : {}}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Notifications
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Manage your email and alert preferences
                </p>
                <button className="text-sm font-medium text-red-800 hover:text-red-900 transition-colors">
                  Manage preferences →
                </button>
              </div>
            </div>
          </motion.div>
        </div>
        </div>
      </div>
    </div>
  );
}
