import type { ApiStatus } from '@/frontend/lib/api'
import type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
import type { StandaloneSmartphoneHandoffZipBody } from '@/frontend/lib/api/standalone-smartphone-handoff'
import { buildWizardHandoffExportBody } from '@/frontend/lib/handoff-export-defaults'
import { suggestHandoffBezeichnung, getHandoffPreset } from '@/frontend/lib/handoff-export-presets'

export type EinsatzHandoffParams = {
  defaultTtlDays: number
  enablePurge: boolean
}

/** Schnell-Handoff aus Einsatz-Konfiguration (Profil Helfer, Boss-Defaults). */
export function buildEinsatzQuickHandoffBody(opts: {
  apiSnapshot: ApiStatus | null | undefined
  contactDirectory?: Record<string, ContactMeshEntryClient>
  params: EinsatzHandoffParams
  handoffLabel?: string
}): StandaloneSmartphoneHandoffZipBody {
  const preset = getHandoffPreset('helfer')
  const label = opts.handoffLabel?.trim() || suggestHandoffBezeichnung(preset)
  const body = buildWizardHandoffExportBody({
    apiSnapshot: opts.apiSnapshot,
    contactDirectory: opts.contactDirectory,
    presetId: 'helfer',
    bezeichnung: label,
  })
  return {
    ...body,
    handoffLabel: label,
    exportTtlDays: Math.max(0, Math.min(3650, Math.floor(opts.params.defaultTtlDays))),
    exportEnablePurge: opts.params.enablePurge,
  }
}
