import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  buildSneakernetPackageJson,
  downloadInboxMessagePlainText,
  downloadSneakernetPackage,
} from '@/frontend/lib/sneakernet-export'
import type { Message } from '@/frontend/lib/types'

const msg: Message = {
  id: 'm-1',
  from: '0x' + 'a'.repeat(64),
  content: 'Hallo Welt',
  timestamp: 1,
  encrypted: false,
}

describe('sneakernet-export', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let click: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:test')
    revokeObjectURL = vi.fn()
    click = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return {
          click,
          remove: vi.fn(),
          href: '',
          download: '',
          rel: '',
        } as unknown as HTMLAnchorElement
      }
      return document.createElement(tag)
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n)
    vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('buildSneakernetPackageJson enthält content', () => {
    const j = JSON.parse(buildSneakernetPackageJson(msg))
    expect(j.message.content).toBe('Hallo Welt')
    expect(j.schema).toBe('morgendrot.sneakernet.v1')
  })

  it('download JSON und TXT lösen Download aus', () => {
    downloadSneakernetPackage(msg)
    downloadInboxMessagePlainText(msg)
    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalledTimes(2)
  })
})
