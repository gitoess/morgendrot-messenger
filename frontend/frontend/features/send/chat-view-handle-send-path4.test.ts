import { describe, expect, it } from 'vitest'
import { formatPath4TextSelfArchiveFootnote } from '@/frontend/features/send/chat-view-handle-send-path4'

describe('formatPath4TextSelfArchiveFootnote', () => {
  it('markiert failed mit __PATH4_FAILED__ Präfix', () => {
    expect(formatPath4TextSelfArchiveFootnote({ status: 'failed', note: 'Tresor gesperrt' })).toBe(
      '__PATH4_FAILED__Tresor gesperrt'
    )
  })

  it('gibt queued/duplicate als Leerzeichen + note zurück', () => {
    expect(formatPath4TextSelfArchiveFootnote({ status: 'queued', note: 'in Warteschlange' })).toBe(
      ' in Warteschlange'
    )
  })

  it('hängt Tx-Digest-Suffix bei anchored an', () => {
    const foot = formatPath4TextSelfArchiveFootnote({
      status: 'anchored',
      note: 'Eigen-Archiv ok',
      txDigest: '0xabc',
    })
    expect(foot).toContain('Eigen-Archiv ok')
    expect(foot).toContain('0xabc')
  })
})
