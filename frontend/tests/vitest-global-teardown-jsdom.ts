/**
 * jsdom-Projekt: kein direct-iota / @iota/sdk — nur Event-Loop leeren.
 * (Linux-CI: schwerer Import in globalTeardown verstärkt jsdom-Shutdown-Flake.)
 */
async function flushEventLoop(rounds = 16): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
}

export default async function vitestGlobalTeardownJsdom(): Promise<void> {
  await flushEventLoop()
}
