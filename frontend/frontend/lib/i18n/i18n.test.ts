import { describe, expect, it, beforeEach } from 'vitest'
import { ensureI18nReady, getAppLocale, i18n, setAppLocale } from '@/frontend/lib/i18n/client'

describe('i18n', () => {
  beforeEach(async () => {
    await ensureI18nReady()
    await setAppLocale('de')
  })

  it('liefert englische Standalone-Texte als Default', async () => {
    await setAppLocale('en')
    expect(i18n.t('firstStart.title', { ns: 'standalone' })).toMatch(/Welcome/)
    expect(getAppLocale()).toBe('en')
  })

  it('wechselt nach de für migrierte Namespaces', async () => {
    await setAppLocale('de')
    expect(getAppLocale()).toBe('de')
    expect(i18n.t('firstStart.title', { ns: 'standalone' })).toMatch(/Willkommen/)
    expect(i18n.t('brand.messenger', { ns: 'dashboard' })).toBe('Morgendrot Messenger')
    expect(i18n.t('connection.chatConnected', { ns: 'dashboard' })).toBe('Chat verbunden')
    await setAppLocale('de')
  })
})
