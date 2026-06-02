import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
const isCapacitorExport = process.env.CAPACITOR_EXPORT === '1'

/** Eine zentrale `.env` im Projektroot (nicht `frontend/.env.local`). */
const repoRoot = path.join(__dirname, '..')
loadEnvConfig(repoRoot)

/** Backend für API-Rewrite (Browser → gleiche Origin wie Next, z. B. 3341 → Proxy → 3342/3343). */
const MORGENDROT_API_INTERNAL = (
  process.env.MORGENDROT_API_INTERNAL_URL || 'http://127.0.0.1:3342'
).replace(/\/$/, '')

/**
 * Next 16 `allowedDevOrigins`: Hostname bzw. `host:port` (siehe nextjs.org/docs/…/allowedDevOrigins).
 * Volle URLs aus `.env` (z. B. `http://192.168.…:3341`) hier auf `host`/`host:port` normalisieren.
 */
function normalizeAllowedDevOrigin(entry) {
  const s = entry.trim()
  if (!s) return null
  if (s.includes('://')) {
    try {
      return new URL(s).host
    } catch {
      return null
    }
  }
  return s
}

const extraDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map(normalizeAllowedDevOrigin)
  .filter(Boolean)

const defaultDevOrigins = ['localhost', '127.0.0.1', 'localhost:3341', '127.0.0.1:3341']

/** Client-only: @meshtastic/core → Node `util.formatWithOptions`; Next's `util` stub lacks it. */
const nodeUtilClientShim = path.join(__dirname, 'frontend/lib/node-util-client-shim.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isCapacitorExport ? { output: 'export' } : {}),
  allowedDevOrigins: [...new Set([...defaultDevOrigins, ...extraDevOrigins])],
  /* @morgendrot/shared + @morgendrot/core: lokale file:-Pakete — Next transpiliert .ts (siehe docs/MONOREPO-NEXT-AND-SHARED.md, docs/MORGENDROT-CORE-PACKAGE-PLAN.md). */
  transpilePackages: [
    '@meshtastic/core',
    '@meshtastic/transport-web-bluetooth',
    '@morgendrot/shared',
    '@morgendrot/core',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  /**
   * Monorepo-Parent: `node_modules/@morgendrot/shared` ist ein `file:`-Link auf `../src/shared` **außerhalb**
   * von `frontend/` — mit Standard-Root (`frontend/`) löst Turbopack den Pfad nicht. Parent-Root + `transpilePackages`.
   * @see https://nextjs.org/docs/app/api-reference/next-config-js/turbopack#root-directory
   */
  turbopack: {
    root: path.resolve(repoRoot),
    /**
     * Kein `resolveAlias.util` hier: Turbopack wendet Aliase **global** an — dann bricht **Server**-Code
     * (`require('util')` in pngjs, RSC, …). Zudem sind **absolute Windows-Pfade** in Turbopack-Aliasen oft
     * nicht auflösbar („windows imports are not implemented yet“). Client-`util`-Shim nur über **Webpack**
     * (`npm run dev` / `build` mit `--webpack` wo nötig), siehe `webpack` unten.
     */
  },
  /** Nur **Client**-Bundle: echtes Node-`util` bleibt auf dem Server. Dafür Dev mit `next dev --webpack`. */
  webpack: (config, { isServer }) => {
    if (!isServer) {
      const prev = config.resolve.alias
      config.resolve.alias = {
        ...(typeof prev === 'object' && prev && !Array.isArray(prev) ? prev : {}),
        util: nodeUtilClientShim,
      }
    }
    return config
  },
  ...(!isCapacitorExport
    ? {
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
    : {}),
}

export default nextConfig
