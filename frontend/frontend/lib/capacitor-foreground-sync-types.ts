export interface MessengerFgSyncPlugin {
  start(options?: { reason?: string }): Promise<{ ok: boolean; running: boolean }>
  stop(): Promise<{ ok: boolean; running: boolean }>
  getState(): Promise<{ running: boolean }>
}
