/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.TABLEGO_ENVIRONMENT === 'staging' ? (process.env.TABLEGO_STAGING_TARGET === 'provider-test' ? '.next-provider-test' : process.env.TABLEGO_STAGING_TARGET === 'qa' ? '.next-staging-qa' : '.next-staging') : '.next',
  typescript: { tsconfigPath: process.env.TABLEGO_ENVIRONMENT === 'staging' ? 'tsconfig.staging.json' : 'tsconfig.json' },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'firebasestorage.googleapis.com' }, { protocol: 'https', hostname: 'storage.googleapis.com' }] },
  async headers() {
    const privateHeaders = [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }, { key: 'Referrer-Policy', value: 'no-referrer' }];
    return [
      { source: '/admin/:path*', headers: [...privateHeaders, { key: 'X-Frame-Options', value: 'DENY' }] },
      { source: '/api/:path*', headers: privateHeaders },
      { source: '/login', headers: privateHeaders },
      ...['reservation', 'cancel-reservation', 'reschedule'].map(route => ({ source: `/${route}/:path*`, headers: privateHeaders })),
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' }] },
    ];
  },
};
export default nextConfig;
