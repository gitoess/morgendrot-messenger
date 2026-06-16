/** Meshtastic-Klartext-Ziel + Kanalindex im Send-Panel (P3). */
export type MeshSendOptionsPort = {
  readonly meshPlaintextToNodeEnabled: boolean
  readonly setMeshPlaintextToNodeEnabled: (v: boolean) => void
  readonly meshPlaintextNodeId: string
  readonly setMeshPlaintextNodeId: (v: string) => void
  readonly meshtasticChannelIndex: number | undefined
  readonly setMeshtasticChannelIndex: (v: number | undefined) => void
}

export function asMeshSendOptions(port: MeshSendOptionsPort): MeshSendOptionsPort {
  return port
}
