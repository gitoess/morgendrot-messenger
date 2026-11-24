import { formatMeshtasticNodeIdFromNum } from '@/frontend/lib/meshtastic-node-id'

/** Sichtbarer Mesh-Knoten aus NodeDB / onNodeInfoPacket. */
export type MeshtasticVisibleNode = {
  nodeNum: number
  nodeId: string
  longName: string
  shortName: string
}

export function isUsableMeshtasticNodeNum(nodeNum: number): boolean {
  return Number.isFinite(nodeNum) && nodeNum > 0
}

/** NodeInfo / User-Payload aus dem SDK → sichtbarer Eintrag; `null` bei ungültigem num (z. B. 0). */
export function parseMeshtasticVisibleNode(payload: unknown): MeshtasticVisibleNode | null {
  if (!payload || typeof payload !== 'object') return null
  const o = payload as Record<string, unknown>
  const user =
    o.user && typeof o.user === 'object' ? (o.user as Record<string, unknown>) : null

  let nodeNum: number | null = null
  const rawNum = o.num ?? o.nodeNum ?? o.from
  if (typeof rawNum === 'number' && Number.isFinite(rawNum)) nodeNum = rawNum >>> 0
  else if (typeof rawNum === 'bigint') nodeNum = Number(rawNum & BigInt(0xffffffff)) >>> 0

  if (nodeNum == null && user) {
    const id = typeof user.id === 'string' ? user.id.trim() : ''
    if (id.startsWith('!')) {
      const n = Number.parseInt(id.slice(1), 16)
      if (Number.isFinite(n) && n > 0) nodeNum = n >>> 0
    }
  }

  if (nodeNum == null || !isUsableMeshtasticNodeNum(nodeNum)) return null

  const longName =
    (typeof user?.longName === 'string' && user.longName.trim()) ||
    (typeof o.longName === 'string' && o.longName.trim()) ||
    ''
  const shortName =
    (typeof user?.shortName === 'string' && user.shortName.trim()) ||
    (typeof o.shortName === 'string' && o.shortName.trim()) ||
    ''

  return {
    nodeNum,
    nodeId: formatMeshtasticNodeIdFromNum(nodeNum),
    longName,
    shortName,
  }
}

export function upsertMeshtasticVisibleNode(
  prev: readonly MeshtasticVisibleNode[],
  next: MeshtasticVisibleNode,
  max = 64
): MeshtasticVisibleNode[] {
  const without = prev.filter((n) => n.nodeNum !== next.nodeNum)
  const merged = [next, ...without]
  return merged.slice(0, max)
}

export function meshtasticVisibleNodeLabel(n: MeshtasticVisibleNode): string {
  const name = n.longName || n.shortName
  return name ? `${name} (${n.nodeId})` : n.nodeId
}
