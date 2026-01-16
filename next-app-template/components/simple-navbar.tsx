"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "@/components/icons";
import { MobileDrawer } from "@/components/mobile-drawer";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Monitor", href: "/monitor" },
  { label: "Register", href: "/register" },
  { label: "Contact Us", href: "/contact" },
  { label: "Profile", href: "/profile" },
  { label: "Subscriptions", href: "/subscriptions" },
];

export const SimpleNavbar = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const pathname = usePathname();

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  return (
    <>
      <nav className="w-full bg-white border-b border-gray-200">
        <div className="mx-auto max-w-[1280px] px-4 lg:px-16">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Left side: hamburger (mobile) + logo + links (desktop) */}
            <div className="flex items-center gap-4 lg:gap-10">
              {/* Hamburger - Mobile only */}
              <button
                aria-label="Menu"
                className="p-2 -ml-2 text-gray-700 hover:text-gray-900 transition-colors lg:hidden"
                onClick={() => setIsDrawerOpen(true)}
              >
                <MenuIcon size={24} />
              </button>
              
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-red-600 rounded-sm flex items-center justify-center">
                  <span className="text-white text-xs font-bold">S</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">Shefle</span>
              </Link>

              {/* Desktop Navigation Links */}
              <div className="hidden lg:flex items-center gap-7">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`text-[15px] font-medium transition-colors relative py-1 ${
                        isActive
                          ? "text-red-800"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {link.label}
                      {isActive && (
                        <span className="absolute -bottom-[20px] left-0 right-0 h-0.5 bg-red-800" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
            
            {/* Right side: Login + Sign up (desktop only) */}
            <div className="hidden lg:flex items-center gap-6">
              <Link
                href="/signup"
                className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Sign up
              </Link>
              <button className="px-6 py-2.5 text-[15px] font-semibold text-white bg-red-800 rounded-lg hover:bg-red-900 active:bg-red-950 transition-all duration-200 shadow-sm hover:shadow">
                Login
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <MobileDrawer isOpen={isDrawerOpen} onClose={handleCloseDrawer} />
    </>
  );
};
