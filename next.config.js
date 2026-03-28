/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, mediasoup: false };
    }
    return config;
  },
};

module.exports = nextConfig;
