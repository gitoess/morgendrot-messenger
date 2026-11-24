import { describe, it, expect, vi } from 'vitest'
import {
  MESHTASTIC_CONFIGURE_CONNECT_BUDGET_MS,
  raceMeshtasticConfigureConnect,
} from '@/frontend/lib/meshtastic-configure-connect'

describe('raceMeshtasticConfigureConnect', () => {
  it('done wenn configure schnell fertig', async () => {
    const configure = vi.fn(async () => undefined)
    await expect(raceMeshtasticConfigureConnect(configure, 500)).resolves.toBe('done')
    expect(configure).toHaveBeenCalledTimes(1)
  })

  it('budget wenn configure hängt — Promise läuft weiter', async () => {
    let finished = false
    const configure = () =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          finished = true
          resolve()
        }, 80)
      })
    await expect(raceMeshtasticConfigureConnect(configure, 15)).resolves.toBe('budget')
    expect(finished).toBe(false)
    await new Promise((r) => setTimeout(r, 100))
    expect(finished).toBe(true)
  })

  it('Default-Budget ist kurz (UI nicht blockieren)', () => {
    expect(MESHTASTIC_CONFIGURE_CONNECT_BUDGET_MS).toBeLessThanOrEqual(3_500)
  })
})
