/** Peering-/Handshake-Aktionen aus der Send-Orchestrierung (P4). */
export type HandshakeActionsPort = {
  readonly onHandshake: () => void | Promise<void>
  readonly onHandshakeForAddress: (address: string) => void | Promise<void>
  readonly onConnectAcceptPartner: () => void | Promise<void>
  readonly onConnectAcceptForAddress: (address: string) => void | Promise<void>
  readonly onConnectDeployment: () => void | Promise<void>
}

export function asHandshakeActions(actions: HandshakeActionsPort): HandshakeActionsPort {
  return actions
}
