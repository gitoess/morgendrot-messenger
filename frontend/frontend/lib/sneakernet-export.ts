import type { Message } from './types'

/** JSON-Paket für manuellen Transport (USB/SD/Air-Gap); Inhalt = angezeigter Klartext-Wire nach Entschlüsselung. */
export function buildSneakernetPackageJson(msg: Message): string {
  return JSON.stringify(
    {
      schema: 'morgendrot.sneakernet.v1',
      exportedAt: Date.now(),
      note: 'Klartext-Snapshot des angezeigten Wire-Inhalts (nach Entschlüsselung). Für ECDH-only-Transport siehe UI „ECDH .morg-pkg“ (schema morgendrot.morgpkg.v1).',
      v1GoldTarget:
        'ECDH-.morg-pkg: Chat → ECDH-Button (gleiche Krypto wie /send). Dieses JSON ist der ältere Klartext-Export.',
      notImplementedYet: ['Kein automatischer USB-Stick-Observer.'],
      message: {
        id: msg.id,
        from: msg.from,
        timestamp: msg.timestamp,
        encryptedFlag: msg.encrypted === true,
        recipient: msg.recipient ?? null,
        transports: msg.transports ?? null,
        content: msg.content,
      },
    },
    null,
    2
  )
}

export function downloadSneakernetPackage(msg: Message): void {
  const json = buildSneakernetPackageJson(msg)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safe = msg.id.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 96) || 'msg'
  a.download = `morgendrot-packet-${safe}.json`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Server-generiertes Paket (morgendrot.morgpkg.v1) als Datei speichern. */
export function downloadMorgPkgJson(pkg: Record<string, unknown>, filenameStem: string): void {
  const json = JSON.stringify(pkg, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    const safe = filenameStem.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'morg-pkg'
    a.download = `${safe}.morg-pkg.json`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Nach async-Export: erneuter Klick durch Nutzer (Toast), falls der Browser den Auto-Download blockiert. */
export function createMorgPkgDownloadAction(
  pkg: Record<string, unknown>,
  filenameStem: string
): () => void {
  return () => downloadMorgPkgJson(pkg, filenameStem)
}
