/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
      },
    ],
  },
  webpack: (config) => {
    // Handle module resolution issues with web3 libraries
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      encoding: false,
    };
    
    // Ignore warnings from optional dependencies
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    return config;
  },
};

export default nextConfig;
