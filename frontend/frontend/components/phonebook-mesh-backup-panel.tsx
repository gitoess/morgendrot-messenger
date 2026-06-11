'use client'

import { useState } from 'react'
import { Download, QrCode, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { exportContactMeshEncrypted, importContactMeshEncrypted } from '@/frontend/lib/api'
import { parseMeshBundleFromQrText } from '@/frontend/lib/mesh-qr'
import { useMeshQrCameraScan } from '@/frontend/hooks/use-mesh-qr-camera-scan'
import { MessengerHandbookChatLink, MESSENGER_HB_ANCHOR_FUNK_KONTEXT } from '@/components/messenger-handbook-link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type PhonebookMeshBackupPanelProps = {
  onContactsChanged: () => void
  className?: string
}

/** Verschlüsseltes Mesh-Telefonbuch (0x ↔ Node-ID) — für alle Rollen im Telefonbuch. */
export function PhonebookMeshBackupPanel(p: PhonebookMeshBackupPanelProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportPw, setExportPw] = useState('')
  const [importPw, setImportPw] = useState('')
  const [importJson, setImportJson] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const { startScan, cameraDialog } = useMeshQrCameraScan({ title: 'Mesh-Backup-QR scannen' })

  const runExport = async () => {
    if (exportPw.length < 8) {
      setStatus('Passwort min. 8 Zeichen.')
      return
    }
    setBusy(true)
    setStatus('')
    try {
      const r = await exportContactMeshEncrypted(exportPw)
      if (r.ok && r.bundle) {
        const json = JSON.stringify(r.bundle)
        setImportJson(json)
        try {
          await navigator.clipboard.writeText(json)
          toast.success('Mesh-Backup in Zwischenablage — zum Import auf anderem Gerät einfügen.')
        } catch {
          toast.success('Mesh-Backup erzeugt — JSON unten im Import-Dialog.')
        }
        setExportOpen(false)
        setImportOpen(true)
        setStatus('')
      } else {
        setStatus(r.error || 'Export fehlgeschlagen.')
      }
    } finally {
      setBusy(false)
    }
  }

  const runImport = async () => {
    const bundle = parseMeshBundleFromQrText(importJson)
    if (!bundle) {
      setStatus('Ungültiges Bundle-JSON.')
      return
    }
    if (importPw.length < 8) {
      setStatus('Passwort min. 8 Zeichen.')
      return
    }
    setBusy(true)
    setStatus('')
    try {
      const r = await importContactMeshEncrypted(importPw, bundle)
      if (r.ok) {
        toast.success(r.message || `Import OK (${r.merged ?? 0})`)
        p.onContactsChanged()
        setImportOpen(false)
        setImportPw('')
        setImportJson('')
      } else {
        setStatus(r.error || 'Import fehlgeschlagen.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={p.className}>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/15 px-3 py-2">
        <span className="text-xs font-medium text-foreground">Mesh-Backup (Node-ID)</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setExportOpen(true)
              setStatus('')
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted/50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export
          </button>
          <button
            type="button"
            onClick={() => {
              setImportOpen(true)
              setStatus('')
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted/50"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            Import
          </button>
          <MessengerHandbookChatLink anchor={MESSENGER_HB_ANCHOR_FUNK_KONTEXT} className="text-[10px]" />
        </div>
      </div>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mesh-Backup exportieren</DialogTitle>
          </DialogHeader>
          <input
            type="password"
            autoComplete="new-password"
            value={exportPw}
            onChange={(e) => setExportPw(e.target.value)}
            placeholder="Passwort (min. 8 Zeichen)"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
          />
          {status ? <p className="text-xs text-destructive">{status}</p> : null}
          <button
            type="button"
            disabled={busy || exportPw.length < 8}
            onClick={() => void runExport()}
            className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Exportiere…' : 'Exportieren'}
          </button>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mesh-Backup importieren</DialogTitle>
          </DialogHeader>
          <input
            type="password"
            autoComplete="new-password"
            value={importPw}
            onChange={(e) => setImportPw(e.target.value)}
            placeholder="Passwort"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const s = await startScan()
              if ('error' in s) {
                if (s.error !== 'Scan abgebrochen.') {
                  setStatus(s.error)
                  toast.error(s.error)
                }
              } else {
                setImportJson(s.bundleJson)
                toast.success('QR gelesen — Passwort prüfen und Import starten.')
              }
              setBusy(false)
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <QrCode className="h-3.5 w-3.5" />
            QR scannen
          </button>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="JSON-Bundle einfügen …"
            rows={4}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-[11px]"
          />
          {status ? <p className="text-xs text-destructive">{status}</p> : null}
          <button
            type="button"
            disabled={busy || importPw.length < 8 || !importJson.trim()}
            onClick={() => void runImport()}
            className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Importiere…' : 'Import anwenden'}
          </button>
        </DialogContent>
      </Dialog>
      {cameraDialog}
    </div>
  )
}
