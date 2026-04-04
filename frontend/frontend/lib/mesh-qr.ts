'use client'

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

/**
 * Capacitor + ML Kit (nur native Plattform). Web: Bundle manuell einfügen.
 * @see https://github.com/capawesome-team/capacitor-mlkit
 */
export async function scanMeshBundleQrWithCamera(): Promise<
  { bundleJson: string } | { error: string }
> {
  if (typeof window === 'undefined') return { error: 'Nur im Browser' }
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor.isNativePlatform()) {
    return {
      error:
        'Kamera-QR nur in der Capacitor-App. Im Browser: exportiertes JSON vom PC einfügen (Feld unten).',
    }
  }
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
}
