import type { Message } from './types'

/** JSON-Datei einer Posteingangszeile (Inhalt wie angezeigt — Klartext oder Wire). Kein ECDH. */
export function buildSneakernetPackageJson(msg: Message): string {
  return JSON.stringify(
    {
      schema: 'morgendrot.sneakernet.v1',
      exportedAt: Date.now(),
      note: 'Snapshot der Zeile (content wie in der UI). ECDH-Datei: Optionen → Datei-Paket (.morg-pkg).',
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

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function safeMsgStem(msg: Message): string {
  return msg.id.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 96) || 'msg'
}

export function downloadSneakernetPackage(msg: Message): void {
  const json = buildSneakernetPackageJson(msg)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  triggerDownload(blob, `morgendrot-packet-${safeMsgStem(msg)}.json`)
}

/** Nur der Nachrichteninhalt als .txt (wie angezeigt). */
export function downloadInboxMessagePlainText(msg: Message): void {
  const text = `${msg.content ?? ''}`
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  triggerDownload(blob, `morgendrot-message-${safeMsgStem(msg)}.txt`)
}

/** Server-generiertes Paket (morgendrot.morgpkg.v1) als Datei speichern. */
export function downloadMorgPkgJson(pkg: Record<string, unknown>, filenameStem: string): void {
  const json = JSON.stringify(pkg, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const safe = filenameStem.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'morg-pkg'
  triggerDownload(blob, `${safe}.morg-pkg.json`)
}

/** Nach async-Export: erneuter Klick durch Nutzer (Toast), falls der Browser den Auto-Download blockiert. */
export function createMorgPkgDownloadAction(
  pkg: Record<string, unknown>,
  filenameStem: string
): () => void {
  return () => downloadMorgPkgJson(pkg, filenameStem)
}
