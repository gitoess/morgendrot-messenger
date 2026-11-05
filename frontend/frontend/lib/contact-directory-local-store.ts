import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import { getApiBase } from '@/frontend/lib/api/api-base'
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/standalone-device-mode'

export const CONTACT_DIRECTORY_STORAGE_KEY = 'morgendrot.contacts.directory.v1'

export type ContactDirectoryStorageEnvelope = {
  savedAtMs: number
  labels?: Record<string, string>
  directory?: Record<string, ContactMeshEntryClient>
}

export type ContactEntrySaveBody = {
  address: string
  label?: string
  bleUuid?: string
  meshNodeId?: string
  meshPublicKeyHex?: string
  mailboxObjectId?: string
  mailboxSharedId?: string
  mailboxPrivateId?: string
  mailboxTeamId?: string
  mailboxBufferId?: string
  telegramChatId?: string
  clearMesh?: boolean
  roleTags?: string[]
}

/** APK/Autarkie oder native App ohne Basis-URL — Kontakte nur lokal. */
export function shouldPersistContactsLocallyOnly(): boolean {
  if (typeof window === 'undefined') return false
  if (isStandaloneMessengerWithoutBasis()) return true
  return isCapacitorNativePlatform() && !getApiBase().trim()
}

function readEnvelope(): ContactDirectoryStorageEnvelope | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONTACT_DIRECTORY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ContactDirectoryStorageEnvelope>
    const savedAtMs = Number(parsed.savedAtMs ?? 0)
    if (!Number.isFinite(savedAtMs) || savedAtMs <= 0) return null
    return {
      savedAtMs,
      labels: parsed.labels as Record<string, string> | undefined,
      directory: parsed.directory as Record<string, ContactMeshEntryClient> | undefined,
    }
  } catch {
    return null
  }
}

function writeEnvelope(envelope: ContactDirectoryStorageEnvelope): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONTACT_DIRECTORY_STORAGE_KEY, JSON.stringify(envelope))
  } catch {
    // Kein Hard-Fail bei vollem Speicher.
  }
}

function labelsFromDirectory(directory: Record<string, ContactMeshEntryClient>): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const [addr, entry] of Object.entries(directory)) {
    const a = addr.trim().toLowerCase()
    if (!a) continue
    labels[a] = entry.label?.trim() || 'Partner'
  }
  return labels
}

export function readPersistentContactDirectory(): Record<string, ContactMeshEntryClient> {
  const env = readEnvelope()
  if (!env?.directory || Object.keys(env.directory).length === 0) {
    if (env?.labels && Object.keys(env.labels).length > 0) {
      const built: Record<string, ContactMeshEntryClient> = {}
      for (const [addr, label] of Object.entries(env.labels)) {
        const a = addr.trim().toLowerCase()
        if (a) built[a] = { label: label || 'Partner' }
      }
      return built
    }
    return {}
  }
  const out: Record<string, ContactMeshEntryClient> = {}
  for (const [addr, entry] of Object.entries(env.directory)) {
    const a = addr.trim().toLowerCase()
    if (a) out[a] = { ...entry }
  }
  return out
}

function trimOrUndef(v: string | undefined): string | undefined {
  const t = v?.trim()
  return t ? t : undefined
}

export function mergeContactEntryIntoDirectory(
  directory: Record<string, ContactMeshEntryClient>,
  body: ContactEntrySaveBody
): Record<string, ContactMeshEntryClient> {
  const address = body.address.trim().toLowerCase()
  if (!address) return directory

  const next = { ...directory }

  if (body.clearMesh) {
    next[address] = { label: body.label?.trim() || 'Partner' }
    return next
  }

  const prev = next[address] ?? { label: 'Partner' }
  const label = body.label?.trim() || prev.label || 'Partner'
  const entry: ContactMeshEntryClient = { ...prev, label }

  const meshNodeId = trimOrUndef(body.meshNodeId)
  if (meshNodeId !== undefined) entry.meshNodeId = meshNodeId
  else if (body.meshNodeId === '') delete entry.meshNodeId

  const bleUuid = trimOrUndef(body.bleUuid)
  if (bleUuid !== undefined) entry.bleUuid = bleUuid

  const meshPublicKeyHex = trimOrUndef(body.meshPublicKeyHex)
  if (meshPublicKeyHex !== undefined) entry.meshPublicKeyHex = meshPublicKeyHex

  const mailboxPrivateId = trimOrUndef(body.mailboxPrivateId) ?? trimOrUndef(body.mailboxObjectId)
  if (mailboxPrivateId !== undefined) {
    entry.mailboxPrivateId = mailboxPrivateId
    entry.mailboxObjectId = mailboxPrivateId
  } else if (body.mailboxPrivateId === '' && body.mailboxObjectId === '') {
    delete entry.mailboxPrivateId
    delete entry.mailboxObjectId
  }

  for (const [key, raw] of [
    ['mailboxSharedId', body.mailboxSharedId],
    ['mailboxTeamId', body.mailboxTeamId],
    ['mailboxBufferId', body.mailboxBufferId],
  ] as const) {
    const v = trimOrUndef(raw)
    if (v !== undefined) entry[key] = v
    else if (raw === '') delete entry[key]
  }

  const telegramChatId = trimOrUndef(body.telegramChatId)
  if (telegramChatId !== undefined) entry.telegramChatId = telegramChatId
  else if (body.telegramChatId === '') delete entry.telegramChatId

  if (body.roleTags?.length) entry.roleTags = [...body.roleTags]
  else if (body.roleTags && body.roleTags.length === 0) delete entry.roleTags

  next[address] = entry
  return next
}

export function saveContactEntryToLocalStore(
  body: ContactEntrySaveBody
): { ok: boolean; message?: string; error?: string } {
  const address = body.address.trim().toLowerCase()
  if (!address) return { ok: false, error: 'Adresse fehlt.' }

  try {
    const directory = mergeContactEntryIntoDirectory(readPersistentContactDirectory(), body)
    writeEnvelope({
      savedAtMs: Date.now(),
      directory,
      labels: labelsFromDirectory(directory),
    })
    return { ok: true, message: 'Kontakt lokal gespeichert.' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lokales Speichern fehlgeschlagen.'
    return { ok: false, error: msg }
  }
}

export function cacheContactDirectorySnapshot(payload: {
  labels?: Record<string, string>
  directory?: Record<string, ContactMeshEntryClient>
}): void {
  writeEnvelope({
    savedAtMs: Date.now(),
    labels: payload.labels,
    directory: payload.directory,
  })
}
