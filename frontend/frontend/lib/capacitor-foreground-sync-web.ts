import type { MessengerFgSyncPlugin } from '@/frontend/lib/capacitor-foreground-sync-types'

/** PWA/Browser — kein Foreground Service (§ H.6f). */
export class MessengerFgSyncWeb implements MessengerFgSyncPlugin {
  async start(): Promise<{ ok: boolean; running: boolean }> {
    return { ok: false, running: false }
  }

  async stop(): Promise<{ ok: boolean; running: boolean }> {
    return { ok: true, running: false }
  }

  async getState(): Promise<{ running: boolean }> {
    return { running: false }
  }
}
