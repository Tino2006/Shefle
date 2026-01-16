"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { SearchIcon, UploadIcon } from "@/components/icons";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function Home() {
  const prefersReducedMotion = useReducedMotion();
  return (
    <div className="w-full min-h-screen bg-white">
      {/* Hero section with subtle background */}
      <div className="w-full bg-white lg:bg-gray-50">
        {/* Container with max-width for desktop */}
        <div className="mx-auto max-w-[1440px] px-4 py-8 lg:px-20 lg:pt-14 lg:pb-24">
          {/* Two-column grid on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="flex flex-col items-center lg:items-start">
            {/* Tag / Pill */}
            <motion.div
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-full mb-5"
              initial={fadeInUp.initial}
              animate={fadeInUp.animate}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="w-2 h-2 bg-red-600 rounded-full" />
              <span className="text-sm text-gray-700">Brand Protection</span>
            </motion.div>

            {/* Main Heading */}
            <motion.h1
              className="text-3xl lg:text-5xl font-bold text-red-800 mb-4 text-center lg:text-left lg:mb-6"
              initial={fadeInUp.initial}
              animate={fadeInUp.animate}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Protect Your Brand
            </motion.h1>

            {/* Description Text */}
            <motion.p
              className="text-base lg:text-lg text-gray-600 text-center lg:text-left mb-4 max-w-md lg:max-w-none leading-relaxed"
              initial={fadeInUp.initial}
              animate={fadeInUp.animate}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              Upload your logo, image, or brand name. Shefle scans the web to detect
              unauthorized use or potential infringement or similar registrations.
            </motion.p>

            {/* Credibility line */}
            <motion.p
              className="text-sm lg:text-base text-gray-500 text-center lg:text-left mb-8 max-w-md lg:max-w-none leading-relaxed"
              initial={fadeInUp.initial}
              animate={fadeInUp.animate}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              Used to identify trademark conflicts, brand infringements, and risky similarities before they escalate into legal disputes.
            </motion.p>

            {/* Search Input */}
            <motion.div
              className="w-full max-w-md lg:max-w-none mb-3"
              initial={fadeInUp.initial}
              animate={fadeInUp.animate}
              transition={{ duration: 0.8, delay: 1.0 }}
            >
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <SearchIcon size={20} />
                </div>
                <input
                  type="text"
                  placeholder="Search your logo or brand name..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                />
              </div>
            </motion.div>

            {/* Upload Button */}
            <motion.button
              className="flex items-center gap-2 px-6 py-3 mb-3 text-red-700 bg-white border border-gray-200 rounded-xl transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]"
              initial={fadeInUp.initial}
              animate={fadeInUp.animate}
              transition={{ duration: 0.8, delay: 1.2 }}
              whileHover={!prefersReducedMotion ? { y: -1 } : {}}
              whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
            >
              <UploadIcon size={18} />
              <span className="text-sm font-medium">Upload file</span>
            </motion.button>

            {/* Primary CTA Button */}
            <motion.button
              className="w-full max-w-md lg:max-w-none px-6 py-4 mb-4 text-white text-base font-semibold bg-red-800 rounded-xl shadow-sm transition-all duration-200 hover:bg-red-900 hover:shadow-md active:scale-[0.98]"
              initial={fadeInUp.initial}
              animate={fadeInUp.animate}
              transition={{ duration: 0.8, delay: 1.4 }}
              whileHover={!prefersReducedMotion ? { y: -2 } : {}}
              whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
            >
              Search
            </motion.button>

            {/* Credibility Feature Strip */}
            <motion.div
              className="w-full max-w-md lg:max-w-none mb-8 lg:mb-0"
              initial={fadeInUp.initial}
              animate={fadeInUp.animate}
              transition={{ duration: 0.8, delay: 1.6 }}
            >
              <div className="flex flex-col gap-2 text-xs text-gray-500">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 text-red-800 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Monitoring every 30–60 minutes</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 text-red-800 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Name + logo similarity scoring</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 text-red-800 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Email alerts with evidence + audit log</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Hero Image */}
          <motion.div
            className="w-full max-w-md lg:max-w-none mx-auto"
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={{ duration: 0.9, delay: 0.6 }}
          >
            <motion.div 
              className="rounded-2xl overflow-hidden lg:h-[600px]"
              animate={!prefersReducedMotion ? {
                scale: [1, 1.01, 1],
              } : {}}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <div className="relative w-full aspect-[4/5] lg:aspect-auto lg:h-full">
                <Image
                  src="/Images/image.png"
                  alt="Brand protection visualization with cybersecurity shield"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </motion.div>
            {/* Image caption */}
            <motion.p
              className="text-xs text-gray-400 text-center mt-3"
              initial={fadeInUp.initial}
              animate={fadeInUp.animate}
              transition={{ duration: 0.8, delay: 1.8 }}
            >
              Visualization of detected brand risk and potential trademark conflict
            </motion.p>
          </motion.div>
        </div>
        </div>
      </div>

      {/* How it works section */}
      <div className="w-full bg-white">
        <div className="mx-auto max-w-[1440px] px-4 py-12 lg:px-20 lg:py-16">
          <motion.h2
            className="text-lg font-semibold text-gray-900 text-center mb-8 lg:mb-10"
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={{ duration: 0.8, delay: 1.8 }}
          >
            How it works
          </motion.h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 max-w-4xl mx-auto">
            {/* Step 1 */}
            <motion.div
              className="text-center lg:text-left p-4 rounded-xl transition-colors duration-200 hover:bg-gray-50"
              initial={fadeInUp.initial}
              animate={fadeInUp.animate}
              transition={{ duration: 0.8, delay: 2.0 }}
              whileHover={!prefersReducedMotion ? { y: -2 } : {}}
            >
              <div className="text-sm font-semibold text-red-800 mb-2">
                1. Submit
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Upload your brand assets or enter your trademark. Supported formats include logos, images, and text.
              </p>
            </motion.div>
            {/* Step 2 */}
            <motion.div
              className="text-center lg:text-left p-4 rounded-xl transition-colors duration-200 hover:bg-gray-50"
              initial={fadeInUp.initial}
              animate={fadeInUp.animate}
              transition={{ duration: 0.8, delay: 2.2 }}
              whileHover={!prefersReducedMotion ? { y: -2 } : {}}
            >
              <div className="text-sm font-semibold text-red-800 mb-2">
                2. Scan
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Shefle searches trademark registries, e-commerce platforms, and domain databases for matches and similarities.
              </p>
            </motion.div>
            {/* Step 3 */}
            <motion.div
              className="text-center lg:text-left p-4 rounded-xl transition-colors duration-200 hover:bg-gray-50"
              initial={fadeInUp.initial}
              animate={fadeInUp.animate}
              transition={{ duration: 0.8, delay: 2.4 }}
              whileHover={!prefersReducedMotion ? { y: -2 } : {}}
            >
              <div className="text-sm font-semibold text-red-800 mb-2">
                3. Review
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Receive a detailed report of potential conflicts, unauthorized use, and recommended legal actions.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
