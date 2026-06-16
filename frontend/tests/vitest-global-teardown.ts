import {
  disableDirectIotaTabSessionPersistForVitest,
  drainDirectIotaTabSessionPersistForTests,
  resetDirectIotaMnemonicSessionModuleForTests,
} from '@/frontend/lib/direct-iota-mnemonic-session'

/** Einmal pro Vitest-Projekt — offene Tab-Persist-Kette vor Prozess-Exit leeren. */
export default async function vitestGlobalTeardown(): Promise<void> {
  await drainDirectIotaTabSessionPersistForTests().catch(() => {})
  disableDirectIotaTabSessionPersistForVitest()
  resetDirectIotaMnemonicSessionModuleForTests()
}
