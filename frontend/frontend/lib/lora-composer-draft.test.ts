import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearLoraComposerDraft,
  loadLoraComposerDraft,
  saveLoraComposerDraft,
  LORA_COMPOSER_DRAFT_LS,
} from '@/frontend/lib/lora-composer-draft'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'

const sample: ChatAttachedLora = {
  lumaWire: '[[MORG_LUMA_V1:msgId=aabbccdd|len=4|xxxx]]',
  chromaWire: '[[MORG_CHROMA_V1:msgId=aabbccdd|len=4|yyyy]]',
  messageId: 'aabbccdd',
  lumaJpegBytes: 100,
  chromaJpegBytes: 50,
}

describe('lora-composer-draft', () => {
  beforeEach(() => {
    clearLoraComposerDraft()
  })

  it('speichert und lädt Draft', () => {
    saveLoraComposerDraft(sample)
    expect(loadLoraComposerDraft()).toEqual(sample)
    expect(window.localStorage.getItem(LORA_COMPOSER_DRAFT_LS)).toBeTruthy()
  })

  it('clear entfernt Draft', () => {
    saveLoraComposerDraft(sample)
    clearLoraComposerDraft()
    expect(loadLoraComposerDraft()).toBeNull()
  })

  it('verwirft Müll', () => {
    window.localStorage.setItem(LORA_COMPOSER_DRAFT_LS, '{"attached":{"x":1}}')
    expect(loadLoraComposerDraft()).toBeNull()
  })
})
