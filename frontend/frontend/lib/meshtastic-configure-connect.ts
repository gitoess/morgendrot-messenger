/**
 * `MeshDevice.configure()` wartet auf volle WantConfig (Kanäle + NodeDB).
 * Große Meshes → viele Sekunden. USB „Verbinden“ darf das nicht blockieren:
 * Transport öffnen, UI verbunden, configure im Hintergrund nachziehen.
 */

export const MESHTASTIC_CONFIGURE_CONNECT_BUDGET_MS = 2_500

export type MeshtasticConfigureConnectResult = 'done' | 'budget'

/**
 * Startet `configure` und gibt spätestens nach `budgetMs` zurück.
 * Bei Budget läuft configure weiter (NodeDB/Kanäle trickle-in über Events).
 */
export async function raceMeshtasticConfigureConnect(
  configure: () => Promise<unknown>,
  budgetMs: number = MESHTASTIC_CONFIGURE_CONNECT_BUDGET_MS
): Promise<MeshtasticConfigureConnectResult> {
  const run = Promise.resolve()
    .then(() => configure())
    .then(
      () => 'done' as const,
      () => 'done' as const
    )
  const budget = new Promise<'budget'>((resolve) => {
    setTimeout(() => resolve('budget'), Math.max(0, budgetMs))
  })
  return Promise.race([run, budget])
}
