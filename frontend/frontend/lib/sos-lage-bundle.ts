'use client'

import type { ApiStatus } from '@/frontend/lib/api/status'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'

export type SosLageBundlePreview = {
  freeText: string
  displayName: string
  iotaAddress: string
  meshNodeId: string
  telegramHint: string
  packageId: string
  locationHint: string
}

export function buildSosLageBundlePreview(opts: {
  freeText: string
  apiStatus?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  myAddress?: string
}): SosLageBundlePreview {
  const me = (opts.myAddress || opts.apiStatus?.myAddressFull || opts.apiStatus?.myAddress || '').trim()
  const dir = opts.contactDirectory?.[me.toLowerCase()]
  return {
    freeText: opts.freeText.trim(),
    displayName:
      dir?.label?.trim() ||
      opts.apiStatus?.displayName?.trim() ||
      opts.apiStatus?.handoffLabel?.trim() ||
      '—',
    iotaAddress: me || '—',
    meshNodeId: dir?.meshNodeId?.trim() || '—',
    telegramHint: dir?.telegramChatId?.trim() ? `Chat-ID ${dir.telegramChatId}` : '—',
    packageId: opts.apiStatus?.packageId?.trim() || '—',
    locationHint: 'GPS optional — noch nicht automatisch (manuell im Text)',
  }
}

export function formatSosLageBundlePlaintext(bundle: SosLageBundlePreview): string {
  const lines = [
    bundle.freeText,
    '',
    `Name: ${bundle.displayName}`,
    `IOTA: ${bundle.iotaAddress}`,
    `Funk: ${bundle.meshNodeId}`,
    `Telegram: ${bundle.telegramHint}`,
    `Package: ${bundle.packageId}`,
    `Ort: ${bundle.locationHint}`,
  ]
  return lines.join('\n').trim()
}
