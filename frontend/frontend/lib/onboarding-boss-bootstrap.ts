'use client'

import { getApiBase } from '@/frontend/lib/api/api-base'
import { fetchWithApiAuth } from '@/frontend/lib/api-authenticated-fetch'
import { joinApiUrl } from '@/frontend/lib/api-fetch-text'
import { setConfig } from '@/frontend/lib/api/dashboard-rest'
import { setPackageIdCommand } from '@/frontend/lib/api/package-connect'
import {
  notifyNetworkProfilesChanged,
  readNetworkProfilesState,
  writeNetworkProfilesState,
} from '@/frontend/lib/einsatz-network-profiles'
import { persistBossChainRegistryIds } from '@/frontend/lib/boss-chain-registry-store'
import { persistDirectChainFieldIds } from '@/frontend/lib/direct-iota-chain-context'
import { writeBossMainnetPackageOverride } from '@/frontend/lib/einsatz-mainnet-local-config'

export { createBossGlobalsRegistries, bossRegistryStatus } from '@/frontend/lib/boss-registry-bootstrap'

export type BossBootstrapResult = {
  ok: boolean
  message?: string
  error?: string
  packageId?: string
  mailboxId?: string
  vaultRegistryId?: string
  commandRegistryId?: string
}

/** Server `.env`: ROLE=boss + ROLE_ID=14 — Voraussetzung für Deploy und Sendepfade. */
export async function ensureBossRoleOnServer(): Promise<BossBootstrapResult> {
  if (typeof window === 'undefined' && !getApiBase().trim()) {
    return { ok: true, message: 'Kein Backend — Rolle nur lokal.' }
  }
  const r = await setConfig('ROLE', 'boss')
  if (!r.ok) return { ok: false, error: r.error || r.message || 'ROLE=boss setzen fehlgeschlagen.' }
  const roleId = await setConfig('ROLE_ID', '14')
  if (!roleId.ok) {
    return { ok: false, error: roleId.error || roleId.message || 'ROLE_ID=14 setzen fehlgeschlagen.' }
  }
  return { ok: true, message: 'Rolle Boss (ROLE_ID=14) auf Server gesetzt.' }
}

/** Move-Package deployen und PACKAGE_ID in `.env` schreiben. */
export async function deployBossMovePackage(opts?: {
  createGlobals?: boolean
  forceGlobals?: boolean
}): Promise<BossBootstrapResult> {
  try {
    const res = await fetchWithApiAuth(joinApiUrl(getApiBase(), '/api/deploy-package'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(opts?.createGlobals ? { createGlobals: true, forceGlobals: opts.forceGlobals === true } : {}),
      }),
    })
    const body = (await res.json()) as {
      ok?: boolean
      packageId?: string
      mailboxId?: string
      vaultRegistryId?: string
      commandRegistryId?: string
      message?: string
      error?: string
    }
    if (!body.ok) {
      return { ok: false, error: body.error || body.message || 'Deploy fehlgeschlagen.' }
    }
    const packageId = body.packageId?.trim()
    const mailboxId = body.mailboxId?.trim()
    if (packageId) persistDirectChainFieldIds({ packageId })
    if (mailboxId) persistDirectChainFieldIds({ mailboxId })
    persistBossChainRegistryIds({
      commandRegistryId: body.commandRegistryId,
      vaultRegistryId: body.vaultRegistryId,
    })
    const parts = [body.message || 'Package deployt.']
    if (mailboxId) parts.push('MAILBOX_ID gesetzt.')
    return {
      ok: true,
      packageId,
      mailboxId,
      vaultRegistryId: body.vaultRegistryId?.trim(),
      commandRegistryId: body.commandRegistryId?.trim(),
      message: parts.join(' '),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Deploy fehlgeschlagen.' }
  }
}

const PKG_RE = /^0x[a-fA-F0-9]{64}$/

export async function applyBossPackageId(packageId: string): Promise<BossBootstrapResult> {
  const id = packageId.trim()
  if (!PKG_RE.test(id)) {
    return { ok: false, error: 'Package-ID ungültig (0x + 64 Hex).' }
  }
  if (typeof window === 'undefined' && !getApiBase().trim()) {
    return { ok: true, packageId: id, message: 'Package-ID lokal notiert (kein Backend).' }
  }
  const r = await setPackageIdCommand(id)
  if (!r.ok) return { ok: false, error: r.error || r.message || 'Package-ID speichern fehlgeschlagen.' }
  return { ok: true, packageId: id, message: 'Package-ID gespeichert.' }
}

/** Bestehendes Mainnet-Package manuell verknüpfen (MAINNET_PACKAGE_ID + lokales Profil). */
export async function applyBossMainnetPackageId(packageId: string): Promise<BossBootstrapResult> {
  const id = packageId.trim()
  if (!PKG_RE.test(id)) {
    return { ok: false, error: 'Mainnet Package-ID ungültig (0x + 64 Hex).' }
  }
  writeBossMainnetPackageOverride(id)
  const state = readNetworkProfilesState()
  writeNetworkProfilesState({
    ...state,
    mainnet: { ...state.mainnet, packageId: id },
  })
  notifyNetworkProfilesChanged()
  if (typeof window === 'undefined' && !getApiBase().trim()) {
    return { ok: true, packageId: id, message: 'Mainnet Package-ID lokal notiert (kein Backend).' }
  }
  const r = await setConfig('MAINNET_PACKAGE_ID', id)
  if (!r.ok) {
    return { ok: false, error: r.error || r.message || 'MAINNET_PACKAGE_ID speichern fehlgeschlagen.' }
  }
  return { ok: true, packageId: id, message: 'Mainnet Package-ID gespeichert.' }
}

export async function applyBossServerMailboxId(mailboxId: string): Promise<BossBootstrapResult> {
  const id = mailboxId.trim()
  if (!PKG_RE.test(id)) {
    return { ok: false, error: 'Mailbox-ID ungültig (0x + 64 Hex).' }
  }
  if (!getApiBase().trim()) {
    return { ok: true, message: 'Mailbox-ID lokal notiert (kein Backend).' }
  }
  const r = await setConfig('MAILBOX_ID', id)
  if (!r.ok) return { ok: false, error: r.error || r.message || 'MAILBOX_ID setzen fehlgeschlagen.' }
  return { ok: true, message: 'Server-Postfach-ID gespeichert.' }
}

export async function applyBossHandoffLabel(label: string): Promise<BossBootstrapResult> {
  const t = label.trim()
  if (!t) return { ok: false, error: 'Einsatz-Name fehlt.' }
  if (!getApiBase().trim()) {
    return { ok: false, error: 'Boss-Server nicht erreichbar — HANDOFF_LABEL wird dort gespeichert.' }
  }
  const r = await setConfig('HANDOFF_LABEL', t)
  if (!r.ok) return { ok: false, error: r.error || r.message || 'HANDOFF_LABEL setzen fehlgeschlagen.' }
  return { ok: true, message: 'Einsatz-Name auf dem Boss gespeichert (HANDOFF_LABEL).' }
}
