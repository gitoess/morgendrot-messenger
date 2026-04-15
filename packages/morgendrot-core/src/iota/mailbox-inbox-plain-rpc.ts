import type { IotaClient } from '@iota/iota-sdk/client'
import { fetchMailboxInboxRpcRows } from './mailbox-inbox-mixed-rpc'

export { coerceMoveU8Vector, messagingStructType, normalizeMailboxAddress } from './mailbox-inbox-rpc-helpers'

export type PlainMailboxRowForInbox = {
  sender: string
  recipient: string
  text: string
  nonce: string
  ts?: number
  chainPurgeable: true
}

export type FetchPlaintextMailboxInboxInput = {
  mailboxObjectId: string
  packageId: string
  myAddress: string
  /** Wie Node `fetchLastMessages`: Seiten à 500 Dynamic Fields, max. N Seiten. */
  maxDynamicFieldPages?: number
  /** Nach Sortierung (neueste zuerst): Offset für Pagination. */
  offset?: number
  /** Max. zurückgegebene Zeilen nach Offset. */
  limit?: number
}

/**
 * Liest **nur** purgebare **Klartext**-Mailbox-Einträge (`PlainMsgKey` / `PlaintextMailboxEntry`) per Fullnode —
 * gleiche Datenbasis wie `messenger-fetch.ts` (Mailbox-Zweig), ohne `/api/inbox`.
 */
export async function fetchPlaintextMailboxInboxRows(
  client: IotaClient,
  input: FetchPlaintextMailboxInboxInput
): Promise<PlainMailboxRowForInbox[]> {
  const rows = await fetchMailboxInboxRpcRows(client, {
    mailboxObjectId: input.mailboxObjectId,
    packageId: input.packageId,
    myAddress: input.myAddress,
    maxDynamicFieldPages: input.maxDynamicFieldPages,
    offset: input.offset,
    limit: input.limit,
    includePlaintext: true,
    includeEncrypted: false,
  })
  return rows
    .filter((r) => r.kind === 'plain')
    .map((r) => ({
      sender: r.sender,
      recipient: r.recipient,
      text: r.text,
      nonce: r.nonce,
      ts: r.ts,
      chainPurgeable: true as const,
    }))
}
