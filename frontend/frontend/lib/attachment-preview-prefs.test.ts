import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ATTACHMENT_PREVIEW_LS_KEY,
  persistAttachmentPreviewEnabled,
  readAttachmentPreviewEnabled,
} from '@/frontend/lib/attachment-preview-prefs'

describe('attachment-preview-prefs', () => {
  afterEach(() => {
    localStorage.removeItem(ATTACHMENT_PREVIEW_LS_KEY)
    vi.restoreAllMocks()
  })

  it('Default an', () => {
    expect(readAttachmentPreviewEnabled()).toBe(true)
  })

  it('persist aus/an', () => {
    persistAttachmentPreviewEnabled(false)
    expect(readAttachmentPreviewEnabled()).toBe(false)
    persistAttachmentPreviewEnabled(true)
    expect(readAttachmentPreviewEnabled()).toBe(true)
  })
})
