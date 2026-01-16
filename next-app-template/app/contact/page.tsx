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

export default function ContactPage() {
  const prefersReducedMotion = useReducedMotion();
  const [attachmentFile, setAttachmentFile] = useState<FileUpload | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
      setAttachmentFile({
        file,
        name: file.name,
        size: `${sizeInMB} MB`,
      });
    }
  };

  const removeFile = () => {
    setAttachmentFile(null);
  };

  return (
    <div className="w-full min-h-screen bg-white lg:bg-gradient-to-br lg:from-gray-50 lg:via-white lg:to-gray-50">
      {/* Container */}
      <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-16 lg:pt-12 lg:pb-20">
        {/* Header */}
        <motion.div
          className="mb-8 lg:mb-10 text-center lg:text-left"
          initial={fadeInUp.initial}
          animate={fadeInUp.animate}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h1 className="text-3xl lg:text-[2.75rem] lg:leading-tight font-bold text-red-800 mb-3">
            Contact Us
          </h1>
          <p className="text-base lg:text-lg text-gray-600 max-w-2xl lg:max-w-none">
            Have questions about protecting your intellectual property? Our team is here to help you secure your innovations.
          </p>
        </motion.div>

        {/* Two-column layout on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8 lg:gap-12">
          {/* Left Column - Contact Form */}
          <motion.div
            className="bg-white lg:rounded-2xl lg:shadow-lg lg:border lg:border-gray-100 lg:p-12 transition-shadow duration-300 hover:shadow-xl"
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              Send us a message
            </h2>

            <form className="space-y-6">
              {/* Name Fields */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                  placeholder="Enter email address"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300"
                  placeholder="Enter phone number"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                  Message
                </label>
                <textarea
                  id="message"
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 focus:shadow-sm hover:border-gray-300 resize-none"
                  placeholder="Tell us more about your brand..."
                />
              </div>

              {/* Attachments */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Attachments <span className="text-gray-400">(optional)</span>
                </label>
                
                {!attachmentFile ? (
                  <label className="flex flex-col items-center justify-center w-full px-6 py-6 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-400 transition-colors bg-gray-50">
                    <UploadIcon size={24} />
                    <span className="mt-2 text-sm font-medium text-gray-700">
                      Select file
                    </span>
                    <span className="mt-1 text-xs text-gray-500">
                      Up to 10 MB
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-gray-50">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachmentFile.name}
                        </p>
                        <p className="text-xs text-gray-500">{attachmentFile.size}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="flex-shrink-0 ml-3 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                className="w-full px-6 py-4 text-white text-base font-semibold bg-red-800 rounded-xl hover:bg-red-900 active:bg-red-950 transition-all duration-200 shadow-md hover:shadow-lg"
                whileHover={!prefersReducedMotion ? { y: -3, scale: 1.01 } : {}}
                whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
              >
                Send Message
              </motion.button>
            </form>
          </motion.div>

          {/* Right Column - Contact Information */}
          <motion.div
            className="space-y-5"
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6 lg:mb-8">
              Contact Information
            </h2>

            {/* Email Card */}
            <motion.div
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-300 cursor-default"
              whileHover={!prefersReducedMotion ? { y: -4, scale: 1.02 } : {}}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Email
                  </h3>
                  <a href="mailto:info@shefle.com" className="text-base text-gray-600 hover:text-red-800 transition-colors font-medium">
                    info@shefle.com
                  </a>
                </div>
              </div>
            </motion.div>

            {/* Phone Card */}
            <motion.div
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-300 cursor-default"
              whileHover={!prefersReducedMotion ? { y: -4, scale: 1.02 } : {}}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Phone
                  </h3>
                  <a href="tel:+96178973511" className="text-base text-gray-600 hover:text-red-800 transition-colors font-medium">
                    +961 78 973 511
                  </a>
                </div>
              </div>
            </motion.div>

            {/* Office Card */}
            <motion.div
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-300 cursor-default"
              whileHover={!prefersReducedMotion ? { y: -4, scale: 1.02 } : {}}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Office
                  </h3>
                  <p className="text-base text-gray-600 font-medium">
                    Beirut, Lebanon
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Business Hours Card */}
            <motion.div
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-300 cursor-default"
              whileHover={!prefersReducedMotion ? { y: -4, scale: 1.02 } : {}}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Business Hours
                  </h3>
                  <p className="text-base text-gray-600 font-medium">
                    Monday - Friday: 9:00 AM - 6:00 PM EST
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Social Media */}
            <div className="pt-6 mt-2 border-t border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Follow us on
              </h3>
              <div className="flex items-center gap-4">
                <motion.a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-600 hover:text-red-800 transition-all duration-200"
                  aria-label="Instagram"
                  whileHover={!prefersReducedMotion ? { scale: 1.1, y: -2 } : {}}
                  whileTap={!prefersReducedMotion ? { scale: 0.95 } : {}}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </motion.a>
                <motion.a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-600 hover:text-red-800 transition-all duration-200"
                  aria-label="Facebook"
                  whileHover={!prefersReducedMotion ? { scale: 1.1, y: -2 } : {}}
                  whileTap={!prefersReducedMotion ? { scale: 0.95 } : {}}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </motion.a>
                <motion.a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-600 hover:text-red-800 transition-all duration-200"
                  aria-label="X (Twitter)"
                  whileHover={!prefersReducedMotion ? { scale: 1.1, y: -2 } : {}}
                  whileTap={!prefersReducedMotion ? { scale: 0.95 } : {}}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </motion.a>
                <motion.a
                  href="https://tiktok.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-600 hover:text-red-800 transition-all duration-200"
                  aria-label="TikTok"
                  whileHover={!prefersReducedMotion ? { scale: 1.1, y: -2 } : {}}
                  whileTap={!prefersReducedMotion ? { scale: 0.95 } : {}}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                  </svg>
                </motion.a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
