"use client";

import { useEffect } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** `null` until the client knows if a session exists */
  isAuthed: boolean | null;
  loginHref: string;
}

const menuItems = [
  { label: "Home", href: "/" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Monitor", href: "/monitor" },
  { label: "Contact Us", href: "/contact" },
  { label: "Subscriptions", href: "/subscriptions" },
];

const socialLinks = [
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://facebook.com",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    label: "X",
    href: "https://twitter.com",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://tiktok.com",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
      </svg>
    ),
  },
];

export const MobileDrawer = ({
  isOpen,
  onClose,
  isAuthed,
  loginHref,
}: MobileDrawerProps) => {
  const prefersReducedMotion = useReducedMotion();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Logged out successfully");
        onClose();
        router.push("/login");
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  // Close drawer on route change
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [pathname]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Focus trap: keep focus within drawer when open
  useEffect(() => {
    if (!isOpen) return;

    const drawer = document.querySelector('[role="dialog"]');

    if (!drawer) return;

    const focusableElements = drawer.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    // Focus first element on open
    firstElement?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener("keydown", handleTab);

    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            animate={{ opacity: 1 }}
            aria-hidden="true"
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            animate={{ x: 0 }}
            aria-label="Navigation menu"
            aria-modal="true"
            className="fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-[85%] max-w-[400px] min-w-0 flex-col bg-white shadow-2xl lg:hidden pt-[env(safe-area-inset-top,0px)]"
            exit={{ x: "-100%" }}
            initial={{ x: "-100%" }}
            role="dialog"
            transition={{
              duration: prefersReducedMotion ? 0 : 0.3,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            {/* Header — fixed height, never scrolls away */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5">
              <Link
                className="flex items-center min-w-0"
                href="/"
                onClick={onClose}
              >
                <div className="relative h-10 w-32 shrink-0 sm:h-11 sm:w-36">
                  <Image
                    fill
                    alt="Shefle Logo"
                    className="object-contain object-left"
                    src="/Images/Shefle-Logo.png"
                  />
                </div>
              </Link>
              <button
                aria-label="Close menu"
                className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:bg-gray-200"
                type="button"
                onClick={onClose}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            {/* Everything below scrolls so short viewports never clip links or footer */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
              <nav aria-label="Main">
                <ul className="divide-y divide-gray-100">
                  {menuItems.map((item) => {
                    const isActive = pathname === item.href;

                    return (
                      <li key={item.href}>
                        <Link
                          className={`block px-5 py-3.5 text-base font-medium transition-colors sm:px-6 sm:py-4 sm:text-[17px] ${
                            isActive
                              ? "bg-red-50/90 font-semibold text-red-800"
                              : "text-gray-800 hover:bg-gray-50 active:bg-gray-100"
                          }`}
                          href={item.href}
                          onClick={onClose}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="space-y-3 px-5 py-5 sm:px-6">
                {isAuthed === null ? (
                  <div
                    aria-hidden
                    className="h-[52px] w-full animate-pulse rounded-xl bg-gray-100 sm:h-14"
                  />
                ) : isAuthed ? (
                  <>
                    <Link
                      className="flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-base font-semibold text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 sm:py-4 sm:text-[17px]"
                      href="/profile"
                      onClick={onClose}
                    >
                      Profile
                    </Link>
                    <button
                      className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-base font-semibold text-red-800 transition-colors hover:bg-red-100 active:bg-red-200 sm:py-4 sm:text-[17px]"
                      type="button"
                      onClick={handleLogout}
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      className="flex w-full items-center justify-center rounded-xl border border-red-800 bg-red-800 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-red-900 active:bg-red-950 sm:py-4 sm:text-[17px]"
                      href={loginHref}
                      onClick={onClose}
                    >
                      Log in
                    </Link>
                    <Link
                      className="flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-base font-semibold text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 sm:py-4 sm:text-[17px]"
                      href="/register"
                      onClick={onClose}
                    >
                      Register
                    </Link>
                  </>
                )}
              </div>

              <div className="border-t border-gray-200 bg-gray-50/50 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-6 sm:px-6">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  About Shefle
                </p>
                <p className="text-sm leading-relaxed text-gray-600">
                  Brand protection and intellectual property monitoring for
                  businesses and creators worldwide.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  {socialLinks.map((social) => (
                    <a
                      key={social.label}
                      aria-label={social.label}
                      className="text-gray-500 transition-colors hover:text-red-800 active:text-red-900"
                      href={social.href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {social.icon}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
