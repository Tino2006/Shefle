/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Move the dev-mode indicator off the footer/logo area (default is bottom-left).
  devIndicators: {
    position: 'bottom-right',
  },
  // App uses /login; /signin is a common default elsewhere (e.g. auth providers, bookmarks).
  async redirects() {
    return [
      { source: '/signin', destination: '/login', permanent: true },
      { source: '/sign-in', destination: '/login', permanent: true },
    ];
  },
};

module.exports = nextConfig;
