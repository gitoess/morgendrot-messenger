import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Backend für API-Rewrite (Browser → gleiche Origin wie Next, z. B. 3341 → Proxy → 3342/3343). */
const MORGENDROT_API_INTERNAL = (
  process.env.MORGENDROT_API_INTERNAL_URL || 'http://127.0.0.1:3342'
).replace(/\/$/, '')

/** Dev: Next 16+ — Zugriff auf /_next/* von anderem Host (localhost vs 127.0.0.1 vs Handy-LAN). */
const extraDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    'http://localhost:3341',
    'http://127.0.0.1:3341',
    ...extraDevOrigins,
  ],
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
  /** SW-Updates: Browser sollen neue sw.js schnell ziehen. */
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
