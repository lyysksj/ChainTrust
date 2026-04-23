/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Avoid warning from optional deps pulled in by wallet-adapter
    config.externals.push("pino-pretty", "encoding");
    return config;
  },
};

export default nextConfig;
