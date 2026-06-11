'use client'

/** Internes Signal: Web/PWA soll {@link QrCameraScanDialog} öffnen. */
export const MESH_QR_WEB_CAMERA_SIGNAL = 'WEB_CAMERA_DIALOG'

export type MeshEncryptedBundle = {
  v: number
  salt: string
  iv: string
  tag: string
  ciphertext: string
}

/** QR-Inhalt = JSON des exportierten Bundles (v, salt, iv, tag, ciphertext). */
export function parseMeshBundleFromQrText(raw: string): MeshEncryptedBundle | null {
  try {
    const j = JSON.parse(raw.trim()) as Partial<MeshEncryptedBundle>
    if (typeof j.v !== 'number' || !j.salt || !j.iv || !j.tag || !j.ciphertext) return null
    return j as MeshEncryptedBundle
  } catch {
    return null
  }
}

export function canUseWebQrCameraScan(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

async function ensureNativeCameraPermission(): Promise<{ ok: true } | { error: string }> {
  const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
  let perm = await BarcodeScanner.checkPermissions()
  if (perm.camera === 'granted') return { ok: true }
  perm = await BarcodeScanner.requestPermissions()
  if (perm.camera === 'granted') return { ok: true }
  return {
    error:
      'Kamera-Berechtigung verweigert — in Android-Einstellungen für Morgendrot Messenger erlauben oder QR-Text einfügen.',
  }
}

/**
 * Capacitor + ML Kit (native App). Web/PWA: {@link canUseWebQrCameraScan} + {@link QrCameraScanDialog}.
 */
export async function scanMeshBundleQrWithCamera(): Promise<
  { bundleJson: string } | { error: string }
> {
  if (typeof window === 'undefined') return { error: 'Nur im Browser' }
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor.isNativePlatform()) {
    if (canUseWebQrCameraScan()) {
      return { error: MESH_QR_WEB_CAMERA_SIGNAL }
    }
    return {
      error:
        'Keine Kamera verfügbar — QR-Text manuell einfügen (Button „QR-Text einfügen“).',
    }
  }
  const perm = await ensureNativeCameraPermission()
  if ('error' in perm) return perm
  try {
    const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning')
    const result = await BarcodeScanner.scan({
      formats: [BarcodeFormat.QrCode],
      autoZoom: true,
    })
    const first = result.barcodes?.[0]
    const text =
      first?.displayValue ?? (first as { rawValue?: string } | undefined)?.rawValue ?? ''
    if (!text.trim()) return { error: 'Kein QR-Inhalt erkannt' }
    return { bundleJson: text.trim() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/cancel/i.test(msg)) return { error: 'Scan abgebrochen.' }
    return { error: msg || 'QR-Scan fehlgeschlagen.' }
  }
}
