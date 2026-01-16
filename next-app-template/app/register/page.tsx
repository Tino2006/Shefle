"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { UploadIcon } from "@/components/icons";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

interface FileUpload {
  file: File | null;
  name: string;
  size: string;
}

export default function RegisterPage() {
  const prefersReducedMotion = useReducedMotion();
  const [accountType, setAccountType] = useState<"individual" | "company">("individual");
  const [poaFile, setPoaFile] = useState<FileUpload | null>(null);
  const [logoFile, setLogoFile] = useState<FileUpload | null>(null);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (file: FileUpload | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
      setFile({
        file,
        name: file.name,
        size: `${sizeInMB} MB`,
      });
    }
  };

  const removeFile = (setFile: (file: FileUpload | null) => void) => {
    setFile(null);
  };

  return (
    <div className="w-full min-h-screen bg-white lg:bg-gray-50">
      {/* Container */}
      <div className="mx-auto max-w-[960px] px-4 py-8 lg:px-16 lg:py-16">
        {/* Header */}
        <motion.div
          className="mb-8 lg:mb-12"
          initial={fadeInUp.initial}
          animate={fadeInUp.animate}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h1 className="text-3xl lg:text-[2.75rem] lg:leading-tight font-bold text-gray-900 mb-3">
            Create Account
          </h1>
          <p className="text-base lg:text-lg text-gray-600">
            Register to start protecting your brand
          </p>
        </motion.div>

        {/* Form Card */}
        <motion.div
          className="bg-white lg:rounded-2xl lg:shadow-sm lg:border lg:border-gray-200 lg:p-12"
          initial={fadeInUp.initial}
          animate={fadeInUp.animate}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <form className="space-y-10">
            {/* Account Type Selector */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-900">
                Account Type <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountType("individual")}
                  className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    accountType === "individual"
                      ? "border-red-800 bg-red-50 text-red-800"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType("company")}
                  className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    accountType === "company"
                      ? "border-red-800 bg-red-50 text-red-800"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Company
                </button>
              </div>
            </div>

            {/* Personal Details Section */}
            <div className="space-y-6 pt-8 border-t border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {accountType === "company" ? "Company Details" : "Personal Details"}
              </h2>
              
              {accountType === "company" && (
                <div className="space-y-2">
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                    Company Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                    placeholder="Enter company name"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    First Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Last Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                    placeholder="Enter last name"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="space-y-6 pt-8 border-t border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                Contact Information
              </h2>
              
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                  placeholder="your.email@example.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            {/* Address Section */}
            <div className="space-y-6 pt-8 border-t border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                Address
              </h2>
              
              <div className="space-y-2">
                <label htmlFor="street" className="block text-sm font-medium text-gray-700">
                  Street Address <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="street"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                  placeholder="Enter street address"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                    City <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    id="city"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                    placeholder="Enter city"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                    State / Province <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    id="state"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                    placeholder="Enter state"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="zip" className="block text-sm font-medium text-gray-700">
                    ZIP / Postal Code <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    id="zip"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                    placeholder="Enter ZIP code"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                    Country <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="country"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                  >
                    <option value="">Select country</option>
                    <option value="us">United States</option>
                    <option value="ca">Canada</option>
                    <option value="uk">United Kingdom</option>
                    <option value="au">Australia</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Registration Details Section */}
            <div className="space-y-6 pt-8 border-t border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                Registration Details
              </h2>
              
              <div className="space-y-2">
                <label htmlFor="registrationCountry" className="block text-sm font-medium text-gray-700">
                  Country of Registration <span className="text-red-600">*</span>
                </label>
                <select
                  id="registrationCountry"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                >
                  <option value="">Select country</option>
                  <option value="us">United States</option>
                  <option value="ca">Canada</option>
                  <option value="uk">United Kingdom</option>
                  <option value="au">Australia</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="typeOfWork" className="block text-sm font-medium text-gray-700">
                  Type of Work <span className="text-red-600">*</span>
                </label>
                <select
                  id="typeOfWork"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                >
                  <option value="">Select type of work</option>
                  <option value="product">Product/Goods</option>
                  <option value="service">Service</option>
                  <option value="both">Both Product & Service</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Document Uploads Section */}
            <div className="space-y-6 pt-8 border-t border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                Documents
              </h2>
              
              {/* POA Upload */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Power of Attorney (POA) <span className="text-red-600">*</span>
                </label>
                <p className="text-xs text-gray-500">
                  Upload a signed POA document (PDF, max 10 MB)
                </p>
                
                {!poaFile ? (
                  <label className="flex flex-col items-center justify-center w-full px-6 py-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-400 transition-colors bg-gray-50">
                    <UploadIcon size={32} />
                    <span className="mt-3 text-sm font-medium text-gray-700">
                      Click to upload POA
                    </span>
                    <span className="mt-1 text-xs text-gray-500">
                      PDF up to 10 MB
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf"
                      onChange={(e) => handleFileUpload(e, setPoaFile)}
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {poaFile.name}
                        </p>
                        <p className="text-xs text-gray-500">{poaFile.size}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(setPoaFile)}
                      className="flex-shrink-0 ml-3 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Wordmark/Logo Upload */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Wordmark / Logo <span className="text-red-600">*</span>
                </label>
                <p className="text-xs text-gray-500">
                  Upload your brand logo or wordmark (PNG, JPG, SVG, max 5 MB)
                </p>
                
                {!logoFile ? (
                  <label className="flex flex-col items-center justify-center w-full px-6 py-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-400 transition-colors bg-gray-50">
                    <UploadIcon size={32} />
                    <span className="mt-3 text-sm font-medium text-gray-700">
                      Click to upload logo
                    </span>
                    <span className="mt-1 text-xs text-gray-500">
                      PNG, JPG, or SVG up to 5 MB
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".png,.jpg,.jpeg,.svg"
                      onChange={(e) => handleFileUpload(e, setLogoFile)}
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {logoFile.name}
                        </p>
                        <p className="text-xs text-gray-500">{logoFile.size}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(setLogoFile)}
                      className="flex-shrink-0 ml-3 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Terms and Submit */}
            <div className="space-y-6 pt-8 border-t border-gray-100">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  className="mt-1 w-4 h-4 border-gray-300 rounded text-red-800 focus:ring-2 focus:ring-red-800/20"
                />
                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                  I agree to the{" "}
                  <a href="/terms" className="text-red-800 hover:underline">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="/privacy" className="text-red-800 hover:underline">
                    Privacy Policy
                  </a>
                </span>
              </label>

              <motion.button
                type="submit"
                className="w-full px-6 py-4 text-white text-base font-semibold bg-red-800 rounded-xl hover:bg-red-900 active:bg-red-950 transition-colors shadow-sm"
                whileHover={!prefersReducedMotion ? { y: -2 } : {}}
                whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
              >
                Create Account
              </motion.button>

              <p className="text-sm text-center text-gray-600">
                Already have an account?{" "}
                <a href="/login" className="text-red-800 font-medium hover:underline">
                  Sign in
                </a>
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
