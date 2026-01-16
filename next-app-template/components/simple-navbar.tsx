"use client";

import { MenuIcon } from "@/components/icons";

export const SimpleNavbar = () => {
  return (
    <nav className="w-full bg-white border-b border-gray-200">
      <div className="mx-auto max-w-[1440px] px-4 lg:px-20">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Left side: hamburger + logo */}
          <div className="flex items-center gap-4">
            <button
              aria-label="Menu"
              className="p-2 -ml-2 text-gray-700 hover:text-gray-900"
            >
              <MenuIcon size={24} />
            </button>
            
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-red-600 rounded-sm flex items-center justify-center">
                <span className="text-white text-xs font-bold">S</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">Shefle</span>
            </div>
          </div>
          
          {/* Right side: empty for now, ready for Sign in */}
          <div className="flex items-center">
            {/* Future: Sign in / user menu */}
          </div>
        </div>
      </div>
    </nav>
  );
};
