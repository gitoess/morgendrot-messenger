import { describe, expect, it, beforeEach } from 'vitest'
import { ensureI18nReady, getAppLocale, i18n, setAppLocale } from '@/frontend/lib/i18n/client'

describe('i18n', () => {
  beforeEach(async () => {
    await ensureI18nReady()
    await setAppLocale('de')
  })

  it('liefert deutsche Standalone-Texte als Default', () => {
    expect(i18n.t('firstStart.title', { ns: 'standalone' })).toMatch(/Willkommen/)
    expect(getAppLocale()).toBe('de')
  })

  it('wechselt nach en für migrierte Namespaces', async () => {
    await setAppLocale('en')
    expect(getAppLocale()).toBe('en')
    expect(i18n.t('firstStart.title', { ns: 'standalone' })).toMatch(/Welcome/)
    expect(i18n.t('brand.messenger', { ns: 'dashboard' })).toBe('Morgendrot Messenger')
    expect(i18n.t('connection.chatConnected', { ns: 'dashboard' })).toBe('Chat connected')
    await setAppLocale('de')
  })
})
