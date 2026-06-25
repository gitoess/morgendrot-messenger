import type { ApiStatus } from '@/frontend/lib/api'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import { API_BASE } from '@/frontend/lib/api/api-base'
import {
  buildTeamMailboxOptions,
  defaultSelectedTeamMailboxIds,
} from '@/frontend/lib/handoff-export-autofill'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'
import {
  defaultHandoffRpcForChainMode,
  parseEinsatzChainMode,
  type EinsatzChainMode,
} from '@morgendrot/shared/einsatz-chain-mode'

export type HandoffExportRuntimeDefaults = {
  handoffBoss: string
  handoffPkgCustom: string
  handoffMailbox: string
  handoffCmdReg: string
  handoffVaultReg: string
  handoffRpc: string
  handoffDirectIota: string
  selectedTeamIds: string[]
  einsatzChainMode: EinsatzChainMode
}

export function seedHandoffExportDefaultsFromStatus(
  apiSnapshot?: ApiStatus | null,
  _contactDirectory?: Record<string, ContactMeshEntryClient>
): HandoffExportRuntimeDefaults {
  const full = apiSnapshot?.myAddressFull?.trim() || apiSnapshot?.myAddress?.trim() || ''
  const boss = /^0x[a-fA-F0-9]{64}$/i.test(full) ? full : ''
  const pkg = apiSnapshot?.packageId?.trim() || ''
  const pkgOk = /^0x[a-fA-F0-9]{64}$/i.test(pkg) ? pkg : ''
  const teamOpts = buildTeamMailboxOptions(apiSnapshot ?? null, readMyTeamMailboxes())
  const selectedTeamIds = teamOpts.length ? defaultSelectedTeamMailboxIds(teamOpts) : []
  const mode = parseEinsatzChainMode(apiSnapshot?.einsatzChainMode) ?? 'mainnet-direct'
  return {
    handoffBoss: boss,
    handoffPkgCustom: pkgOk,
    handoffMailbox: '',
    handoffCmdReg: '',
    handoffVaultReg: '',
    handoffRpc: defaultHandoffRpcForChainMode(mode),
    handoffDirectIota: '',
    selectedTeamIds,
    einsatzChainMode: mode,
  }
}

/** Ergänzt IDs/RPC aus GET /api/current-ids (wie Experten-Panel). */
export async function fetchHandoffCurrentIdsDefaults(): Promise<Partial<HandoffExportRuntimeDefaults>> {
  try {
    const r = await fetch(`${API_BASE}/api/current-ids`)
    const j = (await r.json()) as {
      mailboxId?: string
      commandRegistryId?: string
      vaultRegistryId?: string
      rpcUrl?: string
    }
    if (!r.ok) return {}
    const out: Partial<HandoffExportRuntimeDefaults> = {}
    const mb = String(j.mailboxId || '').trim()
    const cr = String(j.commandRegistryId || '').trim()
    const vr = String(j.vaultRegistryId || '').trim()
    const rpc = String(j.rpcUrl || '').trim()
    if (mb && /^0x[a-fA-F0-9]{64}$/i.test(mb)) {
      out.handoffMailbox = mb
      out.selectedTeamIds = [mb]
    }
    if (cr && /^0x[a-fA-F0-9]{64}$/i.test(cr)) out.handoffCmdReg = cr
    if (vr && /^0x[a-fA-F0-9]{64}$/i.test(vr)) out.handoffVaultReg = vr
    if (rpc) out.handoffRpc = rpc
    return out
  } catch {
    return {}
  }
}

export function mergeHandoffExportDefaults(
  base: HandoffExportRuntimeDefaults,
  patch: Partial<HandoffExportRuntimeDefaults>
): HandoffExportRuntimeDefaults {
  return {
    ...base,
    ...patch,
    selectedTeamIds: patch.selectedTeamIds?.length ? patch.selectedTeamIds : base.selectedTeamIds,
  }
}
