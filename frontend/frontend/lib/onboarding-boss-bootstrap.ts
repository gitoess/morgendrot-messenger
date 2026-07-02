'use client'

import { getApiBase } from '@/frontend/lib/api/api-base'
import { setConfig } from '@/frontend/lib/api/dashboard-rest'
import { setPackageIdCommand } from '@/frontend/lib/api/package-connect'

export { createBossGlobalsRegistries, bossRegistryStatus } from '@/frontend/lib/boss-registry-bootstrap'

export type BossBootstrapResult = {
  ok: boolean
  message?: string
  error?: string
  packageId?: string
}

/** Server `.env`: ROLE=boss — Voraussetzung für `/api/deploy-package`. */
export async function ensureBossRoleOnServer(): Promise<BossBootstrapResult> {
  if (!getApiBase().trim()) return { ok: true, message: 'Kein Backend — Rolle nur lokal.' }
  const r = await setConfig('ROLE', 'boss')
  if (!r.ok) return { ok: false, error: r.error || r.message || 'ROLE=boss setzen fehlgeschlagen.' }
  return { ok: true, message: 'Rolle Boss auf Server gesetzt.' }
}

/** Move-Package deployen und PACKAGE_ID in `.env` schreiben. */
export async function deployBossMovePackage(opts?: {
  createGlobals?: boolean
  forceGlobals?: boolean
}): Promise<BossBootstrapResult> {
  const base = getApiBase().trim()
  if (!base) {
    return { ok: false, error: 'Deploy braucht erreichbares Backend (Basis-URL).' }
  }
  try {
    const res = await fetch(`${base}/api/deploy-package`, {
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
    const parts = [body.message || 'Package deployt.']
    if (body.mailboxId) parts.push('MAILBOX_ID gesetzt.')
    return {
      ok: true,
      packageId: body.packageId?.trim(),
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
  if (!getApiBase().trim()) {
    return { ok: true, packageId: id, message: 'Package-ID lokal notiert (kein Backend).' }
  }
  const r = await setPackageIdCommand(id)
  if (!r.ok) return { ok: false, error: r.error || r.message || 'Package-ID speichern fehlgeschlagen.' }
  return { ok: true, packageId: id, message: 'Package-ID gespeichert.' }
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
