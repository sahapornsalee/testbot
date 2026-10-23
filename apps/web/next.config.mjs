// API_INTERNAL_URL is where the Next.js server forwards /api/v1/* requests.
// Rewrites are resolved at build time for `next build`, so set it before building.
const apiUrl = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // ESLint runs as its own step (npm run lint) locally and in CI.
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiUrl}/api/v1/:path*` }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
