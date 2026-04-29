import Image from "next/image";
import Link from "next/link";

import { socialHrefs } from "@/config/social-links";

const socialFill = "#7f1d1d";
const socialHoverClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-full text-[#7f1d1d] transition-opacity hover:opacity-75";

const social = [
  {
    label: "Shefle on Instagram",
    href: socialHrefs.instagram,
    d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  },
  {
    label: "Shefle on X",
    href: socialHrefs.x,
    d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    label: "Shefle on Facebook",
    href: socialHrefs.facebook,
    d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  {
    label: "Shefle on TikTok",
    href: socialHrefs.tiktok,
    d: "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z",
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative z-20 mt-auto w-full shrink-0 border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-[1600px] min-w-0 px-4 py-3.5 sm:px-5 sm:py-4 lg:px-6">
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-5 md:gap-6">
          <div className="min-w-0 max-w-xl">
            <Link className="relative block h-8 w-28 sm:h-9 sm:w-32" href="/">
              <Image
                fill
                alt="Shefle"
                className="object-contain object-left"
                src="/Images/Shefle-Logo.png"
              />
            </Link>
            <p className="mt-2 text-sm leading-snug text-gray-600 sm:mt-2.5 sm:text-[15px] sm:leading-relaxed">
              Brand protection and intellectual property monitoring for
              businesses and creators worldwide.
            </p>
          </div>

          <ul
            aria-label="Social profiles"
            className="m-0 flex list-none flex-wrap items-center justify-end gap-1.5 p-0 sm:translate-x-1 sm:gap-2 sm:pl-3 md:translate-x-1.5 md:pl-4"
          >
            {social.map((item) => (
              <li key={item.label} className="shrink-0">
                <a
                  aria-label={item.label}
                  className={socialHoverClass}
                  href={item.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <svg
                    aria-hidden
                    className="h-[14px] w-[14px]"
                    viewBox="0 0 24 24"
                  >
                    <path d={item.d} fill={socialFill} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
