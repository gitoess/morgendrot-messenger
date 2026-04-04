'use client'

import type { ProjectType, ProjectVariant } from '@/lib/types'
import { ChatProject } from './chat-project'
import { LockProject } from './lock-project'
import { MonitorProject } from './monitor-project'
import { BossProject } from './boss-project'
import { VaultProject } from './vault-project'

interface ProjectViewProps {
  type: ProjectType
  variant: ProjectVariant
}

export function ProjectView({ type, variant }: ProjectViewProps) {
  switch (type) {
    case 'chat':
      return (
        <ChatProject
          variant={variant as 'private-chat' | 'pinnwand'}
        />
      )
    case 'lock':
      return (
        <LockProject
          variant={variant as 'smart-lock' | 'access-key-ticket' | 'payment-trigger'}
        />
      )
    case 'monitor':
      return (
        <MonitorProject
          variant={variant as 'sensor-central' | 'device-monitor' | 'heartbeat-sender'}
        />
      )
    case 'boss':
      return (
        <BossProject
          variant={variant as 'boss-signer' | 'pinnwand-admin'}
        />
      )
    case 'vault':
      return (
        <VaultProject
          variant={variant as 'local-vault' | 'emergency-purge'}
        />
      )
    default:
      return null
  }
}
