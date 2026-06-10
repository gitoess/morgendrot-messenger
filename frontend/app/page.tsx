'use client'

import dynamic from 'next/dynamic'
import { DashboardPageLoading } from '@/frontend/components/dashboard-page-loading'

const MessengerDashboard = dynamic(
  () => import('@/frontend/components/messenger-dashboard').then((m) => m.MessengerDashboard),
  { ssr: false, loading: () => <DashboardPageLoading /> }
)

const ProjektDashboard = dynamic(
  () => import('@/frontend/components/projekt-dashboard').then((m) => m.ProjektDashboard),
  { ssr: false, loading: () => <DashboardPageLoading /> }
)

const isMessengerBuild = process.env.NEXT_PUBLIC_MORG_PRODUCT === 'messenger'

export default function Home() {
  return isMessengerBuild ? <MessengerDashboard /> : <ProjektDashboard />
}
