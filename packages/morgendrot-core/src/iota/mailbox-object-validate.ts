import type { IotaClient } from '@iota/iota-sdk/client'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type MessagingMailboxObjectKind = 'mailbox' | 'privatemailbox' | 'other'

export function extractPackageIdFromMoveType(typeStr: string | null | undefined): string | null {
  const t = (typeStr || '').trim()
  if (!t) return null
  const first = t.split('::')[0]
  return first && HEX64.test(first) ? first.toLowerCase() : null
}

export function classifyMessagingMailboxMoveType(typeStr: string): MessagingMailboxObjectKind {
  const t = typeStr.toLowerCase()
  if (t.includes('::messaging::privatemailbox')) return 'privatemailbox'
  if (t.includes('::messaging::mailbox')) return 'mailbox'
  return 'other'
}

function shortHexId(id: string): string {
  const n = id.trim().toLowerCase()
  if (n.length <= 14) return n
  return `${n.slice(0, 8)}…${n.slice(-6)}`
}

export function formatMailboxPackageMismatchError(opts: {
  objectId: string
  objectPackageId: string | null
  expectedPackageId: string
  objectKind: MessagingMailboxObjectKind
  requiredKind?: 'mailbox' | 'privatemailbox'
}): string {
  const objPkg = opts.objectPackageId ? shortHexId(opts.objectPackageId) : 'unbekannt'
  const expPkg = shortHexId(opts.expectedPackageId)
  const obj = shortHexId(opts.objectId)
  if (opts.requiredKind === 'mailbox' && opts.objectKind === 'privatemailbox') {
    return `Postfach ${obj} ist eine PrivateMailbox — Team-Broadcast braucht ein Shared-Team-Postfach (create_team_mailbox).`
  }
  if (opts.objectKind === 'other') {
    return `Objekt ${obj} ist keine Messaging-Mailbox (Typ auf der Kette prüfen).`
  }
  if (opts.objectPackageId && opts.objectPackageId.toLowerCase() !== opts.expectedPackageId.trim().toLowerCase()) {
    return (
      `Postfach ${obj} gehört zu Package ${objPkg}, eingestellt ist ${expPkg}. ` +
      'Nach Move-Deploy: neues Postfach mit aktuellem Package erstellen (Team: „Team-Mailbox anlegen“, Server: create_globals) und verknüpfen.'
    )
  }
  return `Postfach ${obj} passt nicht zum eingestellten Package ${expPkg}.`
}

export type MessagingMailboxObjectMeta = {
  type: string
  packageId: string | null
  kind: MessagingMailboxObjectKind
}

export async function fetchMessagingMailboxObjectMeta(
  client: IotaClient,
  objectId: string
): Promise<MessagingMailboxObjectMeta | null> {
  const oid = objectId.trim()
  if (!HEX64.test(oid)) return null
  const objRes = await client.getObject({
    id: oid,
    options: { showType: true },
  } as Parameters<typeof client.getObject>[0])
  const typeStr = String((objRes as { data?: { type?: string } })?.data?.type ?? '').trim()
  if (!typeStr) return null
  return {
    type: typeStr,
    packageId: extractPackageIdFromMoveType(typeStr),
    kind: classifyMessagingMailboxMoveType(typeStr),
  }
}

export type ValidateMessagingMailboxResult =
  | { ok: true; packageId: string; kind: MessagingMailboxObjectKind }
  | { ok: false; error: string }

export async function validateMessagingMailboxObjectForPackage(
  client: IotaClient,
  objectId: string,
  expectedPackageId: string,
  requiredKind: 'mailbox' | 'privatemailbox' | 'any' = 'any'
): Promise<ValidateMessagingMailboxResult> {
  const exp = expectedPackageId.trim()
  if (!HEX64.test(exp)) {
    return { ok: false, error: 'PACKAGE_ID fehlt oder ist ungültig.' }
  }
  const oid = objectId.trim()
  if (!HEX64.test(oid)) {
    return { ok: false, error: 'Mailbox-Object-ID ungültig (0x + 64 Hex).' }
  }
  if (oid.toLowerCase() === exp.toLowerCase()) {
    return { ok: false, error: 'Mailbox-ID darf nicht gleich PACKAGE_ID sein.' }
  }
  let meta: MessagingMailboxObjectMeta | null
  try {
    meta = await fetchMessagingMailboxObjectMeta(client, oid)
  } catch {
    return { ok: false, error: 'Mailbox-Objekt auf der Kette nicht lesbar (RPC/Netz).' }
  }
  if (!meta) {
    return { ok: false, error: 'Mailbox-Objekt auf der Kette nicht gefunden oder ohne Typ.' }
  }
  if (requiredKind === 'mailbox' && meta.kind !== 'mailbox') {
    return {
      ok: false,
      error: formatMailboxPackageMismatchError({
        objectId: oid,
        objectPackageId: meta.packageId,
        expectedPackageId: exp,
        objectKind: meta.kind,
        requiredKind: 'mailbox',
      }),
    }
  }
  if (requiredKind === 'privatemailbox' && meta.kind !== 'privatemailbox') {
    return {
      ok: false,
      error: formatMailboxPackageMismatchError({
        objectId: oid,
        objectPackageId: meta.packageId,
        expectedPackageId: exp,
        objectKind: meta.kind,
        requiredKind: 'privatemailbox',
      }),
    }
  }
  if (meta.kind === 'other') {
    return {
      ok: false,
      error: formatMailboxPackageMismatchError({
        objectId: oid,
        objectPackageId: meta.packageId,
        expectedPackageId: exp,
        objectKind: meta.kind,
      }),
    }
  }
  if (!meta.packageId || meta.packageId !== exp.toLowerCase()) {
    return {
      ok: false,
      error: formatMailboxPackageMismatchError({
        objectId: oid,
        objectPackageId: meta.packageId,
        expectedPackageId: exp,
        objectKind: meta.kind,
        requiredKind: requiredKind === 'any' ? undefined : requiredKind,
      }),
    }
  }
  return { ok: true, packageId: meta.packageId, kind: meta.kind }
}
