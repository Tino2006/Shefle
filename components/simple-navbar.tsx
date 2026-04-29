"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { MenuIcon } from "@/components/icons";
import { MobileDrawer } from "@/components/mobile-drawer";
import { useSessionUser } from "@/hooks/use-session-user";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Monitor", href: "/monitor" },
  { label: "Register", href: "/register" },
  { label: "Contact Us", href: "/contact" },
  { label: "Profile", href: "/profile" },
  { label: "Subscriptions", href: "/subscriptions" },
];

export const SimpleNavbar = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthed } = useSessionUser();

  const loginHref =
    pathname && pathname !== "/login"
      ? `/login?redirect=${encodeURIComponent(pathname)}`
      : "/login";

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Logged out successfully");
        router.push("/login");
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  return (
    <>
      <nav className="w-full bg-white border-b border-gray-200">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-6">
          <div className="relative flex w-full items-center justify-between h-16 lg:h-20">
            {/* Mobile: menu left, logo right (separate flex items). Desktop: logo stays first column. */}
            <button
              aria-label="Menu"
              className="p-2 -ml-2 text-gray-700 hover:text-gray-900 transition-colors lg:hidden"
              onClick={() => setIsDrawerOpen(true)}
            >
              <MenuIcon size={24} />
            </button>

            <Link className="flex items-center max-lg:-mr-1" href="/">
              <div className="relative w-36 h-11 sm:w-40 sm:h-12">
                <Image
                  fill
                  priority
                  alt="Shefle Logo"
                  className="object-contain"
                  src="/Images/Shefle-Logo.png"
                />
              </div>
            </Link>

            {/* Center: Desktop Navigation Links */}
            <div className="hidden lg:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    className={`text-[15px] font-medium transition-colors relative py-1 ${
                      isActive
                        ? "text-red-800"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    href={link.href}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute -bottom-[20px] left-0 right-0 h-0.5 bg-red-800" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right side: Profile + Log in / Log out (desktop only) */}
            <div className="hidden lg:flex items-center gap-4">
              <div className="w-px h-6 bg-gray-300" />
              <Link
                className="flex items-center gap-2 px-5 py-2.5 text-gray-900 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                href={isAuthed === false ? loginHref : "/profile"}
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    clipRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    fillRule="evenodd"
                  />
                </svg>
                <span className="text-[15px] font-medium">Profile</span>
              </Link>
              {isAuthed === null ? (
                <div
                  aria-hidden
                  className="h-10 w-[118px] animate-pulse rounded-full bg-gray-100"
                />
              ) : isAuthed ? (
                <button
                  className="flex items-center gap-2 px-5 py-2.5 text-red-800 bg-red-50 border border-red-200 rounded-full hover:bg-red-100 transition-colors"
                  type="button"
                  onClick={handleLogout}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                  <span className="text-[15px] font-medium">Log out</span>
                </button>
              ) : (
                <Link
                  className="flex items-center gap-2 px-5 py-2.5 text-white bg-red-800 border border-red-800 rounded-full hover:bg-red-900 transition-colors"
                  href={loginHref}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                  <span className="text-[15px] font-medium">Log in</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <MobileDrawer
        isAuthed={isAuthed}
        isOpen={isDrawerOpen}
        loginHref={loginHref}
        onClose={handleCloseDrawer}
      />
    </>
  );
};
