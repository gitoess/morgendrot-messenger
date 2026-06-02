'use client'

import dynamic from 'next/dynamic'

const MessengerDashboard = dynamic(
  () => import('@/frontend/components/messenger-dashboard').then((m) => m.MessengerDashboard),
  { ssr: true }
)

const ProjektDashboard = dynamic(
  () => import('@/frontend/components/projekt-dashboard').then((m) => m.ProjektDashboard),
  { ssr: true }
)

const isMessengerBuild = process.env.NEXT_PUBLIC_MORG_PRODUCT === 'messenger'

export default function Home() {
  return isMessengerBuild ? <MessengerDashboard /> : <ProjektDashboard />
}
