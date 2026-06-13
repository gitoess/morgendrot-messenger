import path from 'node:path'
import os from 'node:os'
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

/** LAN-IPs für Handy-Zugriff auf Next-Dev (WLAN-QR ohne extra Skript). */
function collectLanIpv4DevOrigins() {
  const uiPort = String(process.env.UI_PORT || '3341').trim() || '3341'
  const hosts = []
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const net of entries ?? []) {
      const family = net.family
      const isV4 = family === 'IPv4' || family === 4
      if (!isV4 || net.internal) continue
      const addr = net.address.trim()
      if (!/^\d+\.\d+\.\d+\.\d+$/.test(addr)) continue
      if (addr.startsWith('127.') || addr.startsWith('169.254.')) continue
      const [a, b] = addr.split('.').map((x) => parseInt(x, 10))
      const lan =
        a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      if (!lan) continue
      hosts.push(addr, `${addr}:${uiPort}`)
    }
  }
  return [...new Set(hosts)]
}

const defaultDevOrigins = [
  'localhost',
  '127.0.0.1',
  'localhost:3341',
  '127.0.0.1:3341',
  ...collectLanIpv4DevOrigins(),
]

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
