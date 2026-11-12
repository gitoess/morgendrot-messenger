/** Besitz-Snapshot für NFT Ein/Aus-Erkennung (kein Secret). */

export const NFT_OWNED_SNAPSHOT_LS_KEY = 'morgendrot.nftOwnedSnapshot.v1'
export const NFT_OWNED_SNAPSHOT_INIT_LS_KEY = 'morgendrot.nftOwnedSnapshot.init.v1'

export function isNftOwnedSnapshotInitialized(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(NFT_OWNED_SNAPSHOT_INIT_LS_KEY) === '1'
  } catch {
    return false
  }
}

function markInitialized(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NFT_OWNED_SNAPSHOT_INIT_LS_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function readNftOwnedSnapshot(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(NFT_OWNED_SNAPSHOT_LS_KEY)
    if (!raw) return []
    const j = JSON.parse(raw) as unknown
    if (!Array.isArray(j)) return []
    return j
      .filter((x): x is string => typeof x === 'string' && /^0x[a-f0-9]{64}$/i.test(x))
      .map((x) => x.toLowerCase())
  } catch {
    return []
  }
}

export function writeNftOwnedSnapshot(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      NFT_OWNED_SNAPSHOT_LS_KEY,
      JSON.stringify([...new Set(ids.map((x) => x.toLowerCase()))])
    )
    markInitialized()
  } catch {
    /* ignore */
  }
}

export function noteNftNoLongerOwned(objectId: string): void {
  const oid = objectId.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(oid)) return
  // Snapshot bleibt „initialisiert“, auch wenn leer — sonst gilt Rückkehr als Baseline.
  if (!isNftOwnedSnapshotInitialized()) markInitialized()
  writeNftOwnedSnapshot(readNftOwnedSnapshot().filter((id) => id !== oid))
}

export function clearNftOwnedSnapshot(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(NFT_OWNED_SNAPSHOT_LS_KEY)
    window.localStorage.removeItem(NFT_OWNED_SNAPSHOT_INIT_LS_KEY)
  } catch {
    /* ignore */
  }
}
