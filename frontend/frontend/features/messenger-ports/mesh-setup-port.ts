/** Funk-Setup-Panel: BLE-Kontakt-Zuordnung und Mesh-Sync-Hinweis (P6). */
export type MeshSetupPort = {
  readonly contactBleAddress: string
  readonly onContactBleAddressChange: (v: string) => void
  readonly contactBleUuid: string
  readonly onContactBleUuidChange: (v: string) => void
  readonly contactBleBusy: boolean
  readonly setContactBleBusy: (v: boolean) => void
  readonly meshSyncMsg: string | null
  readonly setMeshSyncMsg: (v: string | null) => void
  readonly refreshContactDirectory: () => void
}

export function asMeshSetup(setup: MeshSetupPort): MeshSetupPort {
  return setup
}
