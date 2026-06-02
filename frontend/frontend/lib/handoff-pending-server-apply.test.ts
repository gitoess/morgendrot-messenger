import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HANDOFF_IMPORT_DRAFT_KEY,
  hasLocalHandoffPendingServerApply,
  readHandoffImportDraft,
} from '@/frontend/lib/handoff-pending-server-apply'

describe('handoff-pending-server-apply', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: {
        store: {} as Record<string, string>,
        getItem(key: string) {
          return this.store[key] ?? null
        },
        setItem(key: string, value: string) {
          this.store[key] = value
        },
        removeItem(key: string) {
          delete this.store[key]
        },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('detects local handoff pending server apply', async () => {
    const { saveLocalHandoffAppliedSnapshot } = await import('@/frontend/lib/handoff-local-apply')
    saveLocalHandoffAppliedSnapshot({ savedAtMs: Date.now(), role: 'arbeiter' })
    expect(hasLocalHandoffPendingServerApply()).toBe(true)
  })

  it('reads valid draft', () => {
    window.localStorage.setItem(
      HANDOFF_IMPORT_DRAFT_KEY,
      JSON.stringify({
        savedAtMs: Date.now(),
        envText: 'ROLE=arbeiter\n',
        runtimeConfigText: null,
      })
    )
    expect(readHandoffImportDraft()?.envText).toContain('ROLE=arbeiter')
  })
})
