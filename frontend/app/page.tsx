'use client'

import dynamic from 'next/dynamic'
import { DashboardPageLoading } from '@/frontend/components/dashboard-page-loading'
import { importWithChunkRecovery } from '@/frontend/lib/chunk-load-error'

const MessengerDashboard = dynamic(
  () =>
    importWithChunkRecovery(() =>
      import('@/frontend/components/messenger-dashboard').then((m) => m.MessengerDashboard)
    ),
  { ssr: false, loading: () => <DashboardPageLoading /> }
)

const ProjektDashboard = dynamic(
  () =>
    importWithChunkRecovery(() =>
      import('@/frontend/components/projekt-dashboard').then((m) => m.ProjektDashboard)
    ),
  { ssr: false, loading: () => <DashboardPageLoading /> }
)

const isMessengerBuild = process.env.NEXT_PUBLIC_MORG_PRODUCT === 'messenger'

export default function Home() {
  return isMessengerBuild ? <MessengerDashboard /> : <ProjektDashboard />
}
