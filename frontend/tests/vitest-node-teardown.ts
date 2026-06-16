import { afterAll } from 'vitest'

/** Node-Projekt: Tab-Persist nach jeder Testdatei leeren (dynamischer Import — vi.mock zuerst). */
afterAll(async () => {
  const mod = await import('@/frontend/lib/direct-iota-mnemonic-session')
  await mod.drainDirectIotaTabSessionPersistForTests().catch(() => {})
  mod.disableDirectIotaTabSessionPersistForVitest()
  mod.resetDirectIotaMnemonicSessionModuleForTests()
})
