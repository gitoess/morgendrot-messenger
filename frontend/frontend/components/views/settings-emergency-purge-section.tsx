'use client'

import { useState } from 'react'
import { AlertTriangle, Lock, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { emergencyPurge, vaultLockCommand, clearLocalHistory } from '@/frontend/lib/api'

export function SettingsEmergencyPurgeSection() {
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [purgeScope, setPurgeScope] = useState<'full' | 'local_cache' | 'lock_session'>('full')
  const [processing, setProcessing] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const handlePurge = async () => {
    if (confirmText !== 'LÖSCHEN') return
    setProcessing(true)
    setStatusMsg('')
    try {
      if (purgeScope === 'full') {
        const res = await emergencyPurge()
        setStatusMsg(res.ok ? 'Vault on-chain notfall-gelöscht + lokaler Inbox-Cache geschreddert.' : res.error || 'Fehler')
        if (res.ok) {
          setConfirmPurge(false)
          setConfirmText('')
        }
      } else if (purgeScope === 'local_cache') {
        const res = await clearLocalHistory({ shred: true })
        setStatusMsg(
          res.ok ? res.message || 'Lokaler Klartext-Inbox-Cache entfernt.' : res.error || 'Fehler'
        )
        if (res.ok) {
          setConfirmPurge(false)
          setConfirmText('')
        }
      } else {
        const res = await vaultLockCommand()
        setStatusMsg(res.ok ? res.message || 'Tresor gesperrt, Keys aus RAM.' : res.error || res.message || 'Fehler')
        if (res.ok) {
          setConfirmPurge(false)
          setConfirmText('')
        }
      }
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-red-500/25 bg-red-500/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 shrink-0 text-red-400" />
        <div>
          <h4 className="font-semibold text-red-400">Notfall-Löschung</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            On-Chain-Vault-Purge ist unwiderruflich. Details:{' '}
            <Link href="/handbook?file=NOTFALL-PURGE-MESSENGER.md" className="text-primary underline">
              Handbuch
            </Link>
          </p>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <label className="flex cursor-pointer items-start gap-2">
          <input type="radio" name="purge-scope-settings" checked={purgeScope === 'full'} onChange={() => setPurgeScope('full')} className="mt-1" />
          <span>
            <strong className="text-foreground">Vollständig (Vault on-chain)</strong>
            <span className="block text-muted-foreground">Chain-Purge + Inbox-Cache schreddern.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input type="radio" name="purge-scope-settings" checked={purgeScope === 'local_cache'} onChange={() => setPurgeScope('local_cache')} className="mt-1" />
          <span>
            <strong className="text-foreground">Nur lokale Klartext-Spuren</strong>
            <span className="block text-muted-foreground">Nur .inbox.enc — keine Chain-TX.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input type="radio" name="purge-scope-settings" checked={purgeScope === 'lock_session'} onChange={() => setPurgeScope('lock_session')} className="mt-1" />
          <span>
            <strong className="text-foreground">Nur Sitzung sperren</strong>
            <span className="block text-muted-foreground">Keys aus RAM + Inbox-Cache schreddern.</span>
          </span>
        </label>
      </div>
      {!confirmPurge ? (
        <button
          type="button"
          onClick={() => setConfirmPurge(true)}
          className="w-full rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm font-semibold text-red-400 hover:bg-red-500/20"
        >
          Notfall-Löschung starten
        </button>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm">
            Tippe <span className="font-mono text-red-400">LÖSCHEN</span> zum Bestätigen
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="LÖSCHEN"
              className="mt-1 w-full rounded-lg border border-red-500/30 bg-input px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmPurge(false)
                setConfirmText('')
              }}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => void handlePurge()}
              disabled={processing || confirmText !== 'LÖSCHEN'}
              className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {processing ? 'Lösche…' : 'Endgültig löschen'}
            </button>
          </div>
        </div>
      )}
      {statusMsg ? <p className="text-sm text-muted-foreground" role="status">{statusMsg}</p> : null}
    </div>
  )
}
