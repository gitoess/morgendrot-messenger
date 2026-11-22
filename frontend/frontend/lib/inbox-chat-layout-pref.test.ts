import { describe, expect, it } from 'vitest'
import {
  formatInboxDayHeading,
  formatInboxMessageTime,
  inboxMessageDayKey,
  isInboxTimestampKnown,
  readInboxChatLayoutMode,
  writeInboxChatLayoutMode,
} from '@/frontend/lib/inbox-chat-layout-pref'

describe('inbox-chat-layout-pref', () => {
  it('default detail', () => {
    window.localStorage.clear()
    expect(readInboxChatLayoutMode()).toBe('detail')
  })

  it('persistiert chat', () => {
    writeInboxChatLayoutMode('chat')
    expect(readInboxChatLayoutMode()).toBe('chat')
    writeInboxChatLayoutMode('detail')
    expect(readInboxChatLayoutMode()).toBe('detail')
  })

  it('day key stabil', () => {
    const ts = new Date(2026, 10, 20, 15, 30).getTime()
    expect(inboxMessageDayKey(ts)).toBe('2026-11-20')
  })

  it('Heute-Heading', () => {
    expect(formatInboxDayHeading(Date.now())).toBe('Heute')
  })

  it('fehlende Chain-Zeit nicht als 1970', () => {
    expect(isInboxTimestampKnown(0)).toBe(false)
    expect(formatInboxMessageTime(0)).toBe('Zeit unbekannt')
    expect(formatInboxDayHeading(0)).toBe('Zeit unbekannt')
    expect(inboxMessageDayKey(0)).toBe('unknown')
  })
})
