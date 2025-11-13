/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client'],
  images: {
    domains: ['images.unsplash.com'],
  },
}

module.exports = nextConfig