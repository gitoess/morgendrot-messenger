import { describe, expect, it } from 'vitest'
import { sha256HexUtf8 } from '@/frontend/lib/contact-avatar-local-store'
import { buildVisitenkarteShare } from '@/frontend/lib/visitenkarte-share'
import { looksLikeVisitenkarteMessage, parseVisitenkarteMessage } from '@/frontend/lib/visitenkarte-ingest'

describe('visitenkarte-ingest', () => {
  const addr = '0x' + 'ab'.repeat(32)

  it('parst Share-Klartext inkl. TG und Funk-Node', () => {
    const r = buildVisitenkarteShare({
      address: addr,
      displayName: 'Ada',
      telegramChatId: '12345',
      meshNodeId: '!abc',
      mailboxObjectId: '0x' + 'cd'.repeat(32),
      flags: {
        includeDisplayName: true,
        includeWallet: true,
        includeTelegram: true,
        includeEcdh: false,
        includeMailbox: true,
        includeMeshNode: true,
        includeAvatarThumb: false,
      },
    })
    expect(looksLikeVisitenkarteMessage(r.plainText)).toBe(true)
    const p = parseVisitenkarteMessage(r.plainText)
    expect(p?.address.toLowerCase()).toBe(addr.toLowerCase())
    expect(p?.displayName).toBe('Ada')
    expect(p?.telegramChatId).toBe('12345')
    expect(p?.meshNodeId).toBe('!abc')
    expect(p?.mailboxPrivateId).toMatch(/^0xcd/)
  })

  it('parst Profilbild-Thumb + Hash (Stufe B)', async () => {
    const thumb = 'data:image/jpeg;base64,Zm9v'
    const hash = await sha256HexUtf8(thumb)
    const r = buildVisitenkarteShare({
      address: addr,
      avatarThumbDataUrl: thumb,
      avatarHashHex: hash,
      flags: {
        includeDisplayName: false,
        includeWallet: true,
        includeTelegram: false,
        includeEcdh: false,
        includeMailbox: false,
        includeMeshNode: false,
        includeAvatarThumb: true,
      },
    })
    const p = parseVisitenkarteMessage(r.plainText)
    expect(p?.avatarThumbDataUrl).toBe(thumb)
    expect(p?.avatarHashHex).toBe(hash)
  })

  it('lehnt normalen Chat-Text ab', () => {
    expect(parseVisitenkarteMessage('Hallo Welt')).toBeNull()
    expect(looksLikeVisitenkarteMessage('Hallo')).toBe(false)
  })
})
