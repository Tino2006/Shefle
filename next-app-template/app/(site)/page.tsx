"use client";

import Image from "next/image";
import Link from "next/link";
import { SearchIcon, UploadIcon } from "@/components/icons";

export default function Home() {
  return (
    <div className="w-full min-h-screen bg-white">
      {/* Hero Section */}
      <div className="w-full bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-12 lg:px-6 lg:py-16">
          {/* Centered Content */}
          <div className="flex flex-col items-center text-center">
            {/* Brand Protection Tag */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 mb-6 border border-gray-300 rounded-full">
              <div className="w-2.5 h-2.5 bg-red-800 rounded-full" />
              <span className="text-base font-medium text-gray-700">Brand Protection</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl lg:text-7xl font-bold text-red-900 mb-6 max-w-4xl leading-tight">
              Protect Your Brand
            </h1>

            {/* Description */}
            <p className="text-base lg:text-lg text-gray-600 mb-10 max-w-3xl leading-relaxed">
              Upload your logo, image, or brand name, Shefle scans the web to detect unauthorized use or potential infringement or similar registrations.
            </p>

            {/* Search and Upload Section */}
            <div className="w-full max-w-4xl mb-6">
              {/* Single Row with Search and Search Button */}
              <div className="flex items-center gap-3">
                {/* Search Input with Upload Button Inside */}
                <div className="relative flex-1">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <SearchIcon size={20} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search your logo or brand name..."
                    className="w-full pl-12 pr-40 py-3.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 transition-all"
                  />
                  {/* Upload Button Inside Input */}
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                    <UploadIcon size={16} />
                    <span className="text-sm font-medium">Upload file</span>
                  </button>
                </div>

                {/* Search Button */}
                <button className="px-10 py-3.5 text-white text-base font-semibold bg-red-800 rounded-lg hover:bg-red-900 transition-colors shadow-sm whitespace-nowrap">
                  Search
                </button>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="mt-16">
            <div className="rounded-2xl overflow-hidden shadow-xl">
              <div className="relative w-full aspect-[16/9]">
                <Image
                  src="/Images/image.png"
                  alt="Brand protection visualization with cybersecurity shield"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-gray-200 bg-white mt-20">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-20 py-8">
          <div className="flex flex-col lg:flex-row items-start gap-32">
            {/* Left Side - Brand Info */}
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
              
              {/* Social Icons */}
              <div className="flex items-center gap-4">
                <a 
                  href="https://instagram.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-red-800 hover:text-red-900 transition-colors"
                  aria-label="Instagram"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                <a 
                  href="https://facebook.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-red-800 hover:text-red-900 transition-colors"
                  aria-label="Facebook"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a 
                  href="https://twitter.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-red-800 hover:text-red-900 transition-colors"
                  aria-label="X"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                <a 
                  href="https://tiktok.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-red-800 hover:text-red-900 transition-colors"
                  aria-label="TikTok"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Right Side - Company Links */}
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-4">Company</h3>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/" className="text-sm text-gray-700 hover:text-red-800 transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/monitor" className="text-sm text-gray-700 hover:text-red-800 transition-colors">
                    Monitor
                  </Link>
                </li>
                <li>
                  <Link href="/portfolio" className="text-sm text-gray-700 hover:text-red-800 transition-colors">
                    Portfolio
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="text-sm text-gray-700 hover:text-red-800 transition-colors">
                    Register
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-sm text-gray-700 hover:text-red-800 transition-colors">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link href="/subscriptions" className="text-sm text-gray-700 hover:text-red-800 transition-colors">
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
