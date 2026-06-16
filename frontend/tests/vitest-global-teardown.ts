/** CI: Tab-Persist-Kette nach der gesamten Suite leeren (Fork/Thread-Shutdown-Flake). */
export default async function globalTeardown(): Promise<void> {
  try {
    const mod = await import('@/frontend/lib/direct-iota-mnemonic-session')
    await mod.drainDirectIotaTabSessionPersistForTests()
    mod.resetDirectIotaMnemonicSessionModuleForTests()
  } catch {
    /* optional */
  }
}
