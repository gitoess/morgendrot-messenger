import type { MetadataRoute } from 'next'

/**
 * Web App Manifest – installierbare PWA (Chrome/Android; Safari: teilweise über Meta-Tags in layout).
 * Splash / „großes Logo“ beim Start unter Android: Chrome nutzt dafür bevorzugt **192×192** und **512×512** PNG
 * unter `public/` (hier noch SVG-only). Für den klassischen Splash: `icons` um `purpose: 'maskable'`-PNG erweitern,
 * siehe z. B. https://web.dev/add-manifest/ – bis dahin: `theme_color` / `background_color` + Name.
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
