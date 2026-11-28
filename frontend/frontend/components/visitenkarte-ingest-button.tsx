'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  applyVisitenkarteToContact,
  contactExistsForVisitenkarte,
} from '@/frontend/lib/visitenkarte-apply-contact'
import { parseVisitenkarteMessage } from '@/frontend/lib/visitenkarte-ingest'

export function VisitenkarteIngestButton({ content }: { content: string }) {
  const fields = parseVisitenkarteMessage(content)
  const [busy, setBusy] = useState(false)
  if (!fields) return null

  const onClick = async () => {
    const exists = contactExistsForVisitenkarte(fields.address)
    if (exists) {
      const ok = window.confirm(
        'Kontakt existiert bereits. Felder aus der Visitenkarte mergen?\n\n' +
          'Vorhandener Anzeigename bleibt, wenn die Karte keinen Namen liefert.\n' +
          'Eigenes Profilbild wird nicht überschrieben.'
      )
      if (!ok) return
    } else if (fields.avatarThumbDataUrl) {
      const ok = window.confirm(
        'Kontakt anlegen und Profilbild von der Visitenkarte lokal speichern?'
      )
      if (!ok) return
    }
    setBusy(true)
    try {
      const r = await applyVisitenkarteToContact(fields)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(r.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onClick()}
      className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
    >
      {busy ? 'Übernehme…' : 'Als Kontakt übernehmen'}
    </button>
  )
}
