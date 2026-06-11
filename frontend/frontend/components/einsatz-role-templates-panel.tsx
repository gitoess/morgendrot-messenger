'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ListOrdered } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import type { ApiStatus } from '@/frontend/lib/api'
import { fetchEinsatzRoleTemplates, getStatus, saveEinsatzRoleTemplates } from '@/frontend/lib/api'
import {
  canEditEinsatzRoleTemplates,
  canViewEinsatzRoleTemplatesSection,
} from '@/frontend/lib/messenger-role-capabilities'
import { validateEinsatzRoleTemplatesBody } from '@/frontend/lib/einsatz-role-templates-validate'

export type EinsatzRoleTemplatesPanelProps = {
  apiSnapshot?: ApiStatus | null
  embedded?: boolean
}

export function EinsatzRoleTemplatesPanel(p: EinsatzRoleTemplatesPanelProps) {
  const [roleTemplatesJson, setRoleTemplatesJson] = useState('[]')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [backendOnline, setBackendOnline] = useState(false)

  const roleCapsStatus: ApiStatus | null = p.apiSnapshot
    ? { ...p.apiSnapshot, backendOnline: p.apiSnapshot.backendOnline ?? p.apiSnapshot.backendRunning }
    : null

  const visible = canViewEinsatzRoleTemplatesSection(roleCapsStatus)
  const canSave = canEditEinsatzRoleTemplates(roleCapsStatus)

  useEffect(() => {
    void (async () => {
      const s = await getStatus()
      setBackendOnline(!!s.data?.backendOnline)
    })()
  }, [])

  const loadRoleTemplates = useCallback(async () => {
    setMsg('')
    if (!backendOnline) {
      setMsg('Backend offline.')
      return
    }
    setBusy(true)
    try {
      const res = await fetchEinsatzRoleTemplates()
      if (res.ok && res.templates) {
        setRoleTemplatesJson(JSON.stringify(res.templates, null, 2))
        setMsg(`${res.templates.length} Vorlage(n) geladen.`)
      } else {
        setMsg(res.error || 'Vorlagen konnten nicht geladen werden.')
      }
    } finally {
      setBusy(false)
    }
  }, [backendOnline])

  const saveRoleTemplates = async () => {
    setMsg('')
    if (!backendOnline) {
      setMsg('Backend offline.')
      return
    }
    if (!canSave) {
      setMsg('Speichern nur für Boss (configChange).')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(roleTemplatesJson || '[]')
    } catch {
      setMsg('Kein gültiges JSON.')
      return
    }
    if (!Array.isArray(parsed)) {
      setMsg('Erwartet: JSON-Array von Vorlagen-Objekten.')
      return
    }
    const validated = validateEinsatzRoleTemplatesBody({ templates: parsed })
    if (!validated.ok) {
      setMsg(validated.error)
      return
    }
    setBusy(true)
    try {
      const res = await saveEinsatzRoleTemplates(validated.templates)
      if (res.ok && res.templates) {
        setRoleTemplatesJson(JSON.stringify(res.templates, null, 2))
        setMsg(res.message || 'Gespeichert.')
      } else {
        setMsg(res.error || 'Speichern fehlgeschlagen.')
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!visible || !backendOnline) return
    void loadRoleTemplates()
  }, [visible, backendOnline, loadRoleTemplates])

  if (!visible) return null

  return (
    <div className={p.embedded ? '' : 'rounded-xl border border-border bg-card p-4'}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
          <ListOrdered className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h4 className="font-semibold text-foreground">Einsatz-Rollen-Vorlagen</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Vorgefertigte Rollen-Labels für Geräte/Worker —{' '}
              <span className="font-mono text-xs">.morgendrot-einsatz-templates.json</span>.
              {!canSave ? (
                <>
                  {' '}
                  <strong className="text-foreground">Kommandant:</strong> nur Lesen.
                </>
              ) : null}{' '}
              <Link href="/handbook/API-EINSATZ-ROLE-TEMPLATES.md" className="text-primary underline hover:no-underline">
                API-Doku
              </Link>
            </p>
          </div>
          <Textarea
            value={roleTemplatesJson}
            onChange={(e) => setRoleTemplatesJson(e.target.value)}
            className="min-h-[160px] font-mono text-xs"
            spellCheck={false}
            disabled={busy || !backendOnline || !canSave}
            readOnly={!canSave}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !backendOnline}
              onClick={() => void loadRoleTemplates()}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              Vom Backend laden
            </button>
            {canSave ? (
              <button
                type="button"
                disabled={busy || !backendOnline}
                onClick={() => void saveRoleTemplates()}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? '…' : 'Speichern'}
              </button>
            ) : null}
          </div>
          {msg ? (
            <p className="text-xs text-muted-foreground" role="status">
              {msg}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
