import { afterEach, describe, expect, it } from 'vitest'
import {
  DISKRET_SEND_LS_KEY,
  readDiskretSendEnabled,
  writeDiskretSendEnabled,
} from '@/frontend/lib/diskret-send-pref'
import {
  getStealthCallPackageId,
  STEALTH_CALL_PACKAGE_ID_DEFAULT,
  writeStealthCallPackageIdOverride,
} from '@/frontend/lib/stealth-call-package'

describe('diskret-send-pref', () => {
  afterEach(() => {
    window.localStorage.removeItem(DISKRET_SEND_LS_KEY)
    writeStealthCallPackageIdOverride('')
  })

  it('Default aus', () => {
    expect(readDiskretSendEnabled()).toBe(false)
  })

  it('write/read Opt-in', () => {
    writeDiskretSendEnabled(true)
    expect(readDiskretSendEnabled()).toBe(true)
    writeDiskretSendEnabled(false)
    expect(readDiskretSendEnabled()).toBe(false)
  })
})

describe('stealth-call-package', () => {
  afterEach(() => {
    writeStealthCallPackageIdOverride('')
  })

  it('Default = published-at Call-Package', () => {
    expect(getStealthCallPackageId()).toBe(STEALTH_CALL_PACKAGE_ID_DEFAULT)
  })

  it('Override wenn gültige 0x64', () => {
    const o = '0x' + 'ab'.repeat(32)
    writeStealthCallPackageIdOverride(o)
    expect(getStealthCallPackageId().toLowerCase()).toBe(o.toLowerCase())
  })
})
