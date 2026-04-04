import type { MetadataRoute } from 'next'

/**
 * Web App Manifest – installierbare PWA (Chrome/Android; Safari: teilweise über Meta-Tags in layout).
 * Icons: vorerst SVG (public/icon.svg). Für maximale Kompatibilität später 192×192 / 512×512 PNG ergänzen.
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
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
