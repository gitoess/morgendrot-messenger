import { describe, it, expect, vi } from 'vitest'
import type { Message } from '@/frontend/lib/types'
import { asComposerDraft } from './composer-draft-port'
import { asInboxFeedRead } from './inbox-feed-read-port'
import {
  asSendMeshMirrorDelay,
  asSendTransportChoice,
  asSendTransportRead,
} from './send-transport-ports'

describe('asInboxFeedRead', () => {
  it('behält Referenzen für messages und myAddress', () => {
    const messages: Message[] = [{ id: '1', from: '0xa', content: '', timestamp: 1 }]
    const port = asInboxFeedRead(messages, ' 0xB ')
    expect(port.messages).toBe(messages)
    expect(port.myAddress).toBe(' 0xB ')
  })
})

describe('asComposerDraft', () => {
  it('leitet Callbacks durch', () => {
    const onMsg = vi.fn()
    const onRec = vi.fn()
    const p = asComposerDraft('hi', '0xr', onMsg, onRec)
    expect(p.message).toBe('hi')
    expect(p.recipient).toBe('0xr')
    p.onMessageChange('x')
    p.onRecipientChange('y')
    expect(onMsg).toHaveBeenCalledWith('x')
    expect(onRec).toHaveBeenCalledWith('y')
  })
})

describe('asSendTransportRead', () => {
  it('mappt encrypted und forcedTransport', () => {
    const p = asSendTransportRead(true, 'mesh')
    expect(p).toEqual({ encrypted: true, forcedTransport: 'mesh' })
  })
})

describe('asSendMeshMirrorDelay', () => {
  it('mappt Flag und Callback', () => {
    const fn = vi.fn()
    const p = asSendMeshMirrorDelay(true, fn)
    p.onDelayMirrorToIotaChange(false)
    expect(p.delayMirrorToIota).toBe(true)
    expect(fn).toHaveBeenCalledWith(false)
  })
})

describe('asSendTransportChoice', () => {
  it('mappt alle vier Felder', () => {
    const onEnc = vi.fn()
    const onTr = vi.fn()
    const p = asSendTransportChoice(false, onEnc, 'internet', onTr)
    p.onEncryptedChange(true)
    p.onForcedTransportChange('mesh')
    expect(onEnc).toHaveBeenCalledWith(true)
    expect(onTr).toHaveBeenCalledWith('mesh')
    expect(p.encrypted).toBe(false)
    expect(p.forcedTransport).toBe('internet')
  })
})
