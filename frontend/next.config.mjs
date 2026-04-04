import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Backend für API-Rewrite (Browser → gleiche Origin wie Next, z. B. 3341 → Proxy → 3342/3343). */
const MORGENDROT_API_INTERNAL = (
  process.env.MORGENDROT_API_INTERNAL_URL || 'http://127.0.0.1:3342'
).replace(/\/$/, '')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@meshtastic/core', '@meshtastic/transport-web-bluetooth'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${MORGENDROT_API_INTERNAL}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
