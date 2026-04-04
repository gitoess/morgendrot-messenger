import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { PwaServiceWorkerRegister } from '@/components/pwa-service-worker-register'
import { AppToaster } from '@/components/app-toaster'
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
    <html lang="de">
      <body className="font-sans antialiased">
        <PwaServiceWorkerRegister />
        <AppToaster />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
