import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'
import { executeCommand } from '@/frontend/lib/api/execute-command'

/** Strukturierte Notizen im Vault-Payload (mehrere Einträge, optional Ordner). */
export type VaultNoteAttachmentKind = 'image' | 'text' | 'audio'

export type VaultNoteAttachment = {
  id: string
  name: string
  mime: string
  kind: VaultNoteAttachmentKind
  dataBase64: string
  textContent?: string
  updatedAt?: number
}

export type VaultNoteEntry = {
  id: string
  title: string
  folder?: string
  body: string
  attachments?: VaultNoteAttachment[]
  updatedAt?: number
}

function routeMissing(text: string, status: number): boolean {
  return status === 404 || /Route nicht gefunden/i.test(text)
}

function notesFromCommandBody(body: Record<string, unknown>): VaultNoteEntry[] {
  return Array.isArray(body.notes) ? (body.notes as VaultNoteEntry[]) : []
}

async function fetchVaultNotesViaCommand(): Promise<{
  ok: boolean
  unlocked?: boolean
  notes?: VaultNoteEntry[]
  error?: string
}> {
  const r = (await executeCommand('/vault-notes-get', [])) as {
    ok?: boolean
    unlocked?: boolean
    notes?: VaultNoteEntry[]
    message?: string
    error?: string
  }
  if (!r?.ok) {
    return { ok: false, error: r?.error || r?.message || 'Notizen konnten nicht geladen werden.' }
  }
  return {
    ok: true,
    unlocked: r.unlocked === true,
    notes: notesFromCommandBody(r as Record<string, unknown>),
  }
}

function encodeNotesPayload(notes: VaultNoteEntry[]): string {
  const json = JSON.stringify(notes)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function saveVaultNotesViaCommand(
  notes: VaultNoteEntry[],
  persistLocal: boolean
): Promise<{ ok: boolean; message?: string; error?: string; notes?: VaultNoteEntry[] }> {
  const b64 = encodeNotesPayload(notes)
  const args = persistLocal ? [b64, 'persistLocal'] : [b64]
  const r = (await executeCommand('/vault-notes-set', args)) as {
    ok?: boolean
    message?: string
    error?: string
    notes?: VaultNoteEntry[]
  }
  if (!r?.ok) {
    return { ok: false, error: r?.error || r?.message || 'Notizen speichern fehlgeschlagen.' }
  }
  return {
    ok: true,
    message: typeof r.message === 'string' ? r.message : undefined,
    notes: notesFromCommandBody(r as Record<string, unknown>),
  }
}

export async function fetchVaultNotes(): Promise<{
  ok: boolean
  unlocked?: boolean
  notes?: VaultNoteEntry[]
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/vault-notes')
    if (fr.ok && !routeMissing(fr.text, fr.response.status)) {
      const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Notizen-API nicht lesbar.' })
      if (r.ok) {
        const b = r.body
        return {
          ok: true,
          unlocked: b.unlocked === true,
          notes: Array.isArray(b.notes) ? (b.notes as VaultNoteEntry[]) : undefined,
        }
      }
    }
    return await fetchVaultNotesViaCommand()
  } catch (error) {
    const cmd = await fetchVaultNotesViaCommand()
    if (cmd.ok) return cmd
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

export async function saveVaultNotes(
  notes: VaultNoteEntry[],
  persistLocal: boolean
): Promise<{ ok: boolean; message?: string; error?: string; notes?: VaultNoteEntry[] }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/vault-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, persistLocal }),
    })
    if (fr.ok && !routeMissing(fr.text, fr.response.status)) {
      const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Notizen speichern fehlgeschlagen.' })
      if (r.ok) {
        const b = r.body
        return {
          ok: true,
          message: typeof b.message === 'string' ? b.message : undefined,
          notes: Array.isArray(b.notes) ? (b.notes as VaultNoteEntry[]) : undefined,
        }
      }
      if (r.error && !/Route nicht gefunden/i.test(r.error)) {
        return { ok: false, error: r.error }
      }
    }
    return await saveVaultNotesViaCommand(notes, persistLocal)
  } catch (error) {
    const cmd = await saveVaultNotesViaCommand(notes, persistLocal)
    if (cmd.ok) return cmd
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
