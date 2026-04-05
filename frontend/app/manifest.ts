import type { MetadataRoute } from 'next'

/**
 * Web App Manifest – installierbare PWA (Chrome/Android; Safari: teilweise über Meta-Tags in layout).
 * PNG-Icons: `public/icon-192.png`, `public/icon-512.png` — erzeugen mit `npm run build:pwa-icons` (Root).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Morgendrot Messenger',
    short_name: 'Morgendrot',
    description:
      'IOTA-Messaging, Meshtastic/Web Bluetooth, Zugriffskontrolle – Einsatz- und Laborbetrieb.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'portrait-primary',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    categories: ['utilities', 'productivity'],
    lang: 'de',
    dir: 'ltr',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
