import QRCode from 'qrcode'
import type { StandaloneSmartphoneHandoffZipBody } from '@/frontend/lib/api/standalone-smartphone-handoff'
import { fetchGenerateMnemonic } from '@/frontend/lib/api/generate-mnemonic'
import { downloadHandoffZipExport } from '@/frontend/lib/handoff-export-download'
import { addBossProvisionRegistryEntry } from '@/frontend/lib/boss-provision-registry'
import { buildSeedSetupQrText } from '@/frontend/lib/seed-setup-qr'
import { writeHandoffLastPresetId } from '@/frontend/lib/handoff-last-preset'
import type { HandoffEinsatzPresetId } from '@/frontend/lib/handoff-export-presets'

export const HANDOFF_SEED_QR_SECONDS = 60

export type ProvisionNewHandoffDeviceInput = {
  buildBody: (helperAddress: string) => StandaloneSmartphoneHandoffZipBody
  presetId: HandoffEinsatzPresetId
  label: string
  masterPassword: string
  zipPassword?: string
}

export type ProvisionNewHandoffDeviceSuccess = {
  ok: true
  address: string
  entryId: string
  qrDataUrl: string
  qrSeconds: number
  zipPasswordProtected: boolean
}

export type ProvisionNewHandoffDeviceFailure = {
  ok: false
  error: string
}

export type ProvisionNewHandoffDeviceResult =
  | ProvisionNewHandoffDeviceSuccess
  | ProvisionNewHandoffDeviceFailure

/** Neues Helfer-Wallet: Mnemonic → Handoff-ZIP → Boss-Registry → Seed-QR. */
export async function provisionNewHandoffDevice(
  input: ProvisionNewHandoffDeviceInput
): Promise<ProvisionNewHandoffDeviceResult> {
  const mnemonic = await fetchGenerateMnemonic()
  if (!mnemonic.ok) {
    return { ok: false, error: mnemonic.error }
  }

  const body = input.buildBody(mnemonic.address)
  const zip = await downloadHandoffZipExport(
    body,
    input.zipPassword ? { password: input.zipPassword } : {}
  )
  if (!zip.ok) {
    return { ok: false, error: zip.error }
  }

  writeHandoffLastPresetId(input.presetId)

  const added = await addBossProvisionRegistryEntry({
    label: input.label.trim() || input.presetId,
    presetId: input.presetId,
    address: mnemonic.address,
    seedImport: mnemonic.secretKey,
    zipFilenameBase: input.label.trim().replace(/\s+/g, '-').slice(0, 40) || 'handoff',
    masterPassword: input.masterPassword,
  })
  if (!added.ok) {
    return { ok: false, error: added.error }
  }

  const qrText = buildSeedSetupQrText({ seedImport: mnemonic.secretKey, address: mnemonic.address })
  const qrDataUrl = await QRCode.toDataURL(qrText, { width: 240, margin: 2 })

  return {
    ok: true,
    address: mnemonic.address,
    entryId: added.entry.id,
    qrDataUrl,
    qrSeconds: HANDOFF_SEED_QR_SECONDS,
    zipPasswordProtected: Boolean(input.zipPassword),
  }
}
