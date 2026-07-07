import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ChunkLoadRecovery } from '@/components/chunk-load-recovery'
import { PwaServiceWorkerRegister } from '@/components/pwa-service-worker-register'
import { AppToaster } from '@/components/app-toaster'
import { I18nProvider } from '@/frontend/components/i18n-provider'
import { MessengerAppearanceBootstrap } from '@/frontend/components/messenger-appearance-bootstrap'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: '#0f172a',
  colorScheme: 'dark',
}

export const metadata: Metadata = {
  title: 'Morgendrot - IOTA Messaging & Access Control',
  description: 'Local dashboard for IOTA/Stardust messaging, access keys, tickets, and device monitoring',
  manifest: '/manifest.webmanifest',
  generator: 'v0.app',
  applicationName: 'Morgendrot Messenger',
  appleWebApp: {
    capable: true,
    title: 'Morgendrot',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='morgendrot.appearanceTheme';var t=localStorage.getItem(k);var ids=['standard','tactical','high-contrast','light'];if(t&&ids.indexOf(t)>=0&&t!=='standard'){document.documentElement.setAttribute('data-appearance',t);}if(t==='light'){document.documentElement.style.colorScheme='light';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <I18nProvider>
          <MessengerAppearanceBootstrap />
          <PwaServiceWorkerRegister />
          <ChunkLoadRecovery />
          <AppToaster />
          {children}
        </I18nProvider>
        <Analytics />
      </body>
    </html>
  )
}
