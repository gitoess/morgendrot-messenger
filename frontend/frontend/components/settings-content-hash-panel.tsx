'use client'

import { useCallback, useRef, useState } from 'react'
import { Check, Copy, Hash, ShieldCheck } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  isSha256Hex64,
  normalizeSha256Hex,
  sha256HexOfBlob,
  sha256HexOfUtf8,
} from '@/frontend/lib/content-sha256'

export function SettingsContentHashPanel() {
  const [mode, setMode] = useState<'hash' | 'verify'>('hash')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileHash, setFileHash] = useState('')
  const [hash, setHash] = useState('')
  const [expected, setExpected] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [match, setMatch] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingFileRef = useRef<File | null>(null)

  const applyVerify = useCallback((computed: string, expectedRaw: string) => {
    const exp = normalizeSha256Hex(expectedRaw)
    if (!exp) {
      setMatch(null)
      setErr('Zuerst den erwarteten Hash eintragen (64 Hex), dann Datei oder Text prüfen.')
      return false
    }
    if (!isSha256Hex64(exp)) {
      setMatch(null)
      setErr('Erwarteter Hash muss 64 Hex-Zeichen sein (optional mit 0x).')
      return false
    }
    setErr('')
    setMatch(exp === computed)
    return true
  }, [])

  const runHashText = useCallback(async () => {
    setBusy(true)
    setErr('')
    setMatch(null)
    try {
      const h = await sha256HexOfUtf8(text)
      setHash(h)
      setFileName('')
      setFileHash('')
      pendingFileRef.current = null
      if (mode === 'verify') applyVerify(h, expected)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Hash fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }, [text, mode, expected, applyVerify])

  const runHashFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      pendingFileRef.current = file
      setBusy(true)
      setErr('')
      setMatch(null)
      try {
        const h = await sha256HexOfBlob(file)
        setFileHash(h)
        setHash(h)
        setFileName(file.name)
        setText('')
        if (mode === 'verify') applyVerify(h, expected)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Datei-Hash fehlgeschlagen')
      } finally {
        setBusy(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [mode, expected, applyVerify]
  )

  /** Wenn man zuerst Datei wählt und danach den erwarteten Hash eintippt. */
  const recheckPending = useCallback(() => {
    if (mode !== 'verify') return
    const computed = fileHash || hash
    if (!computed) return
    applyVerify(computed, expected)
  }, [mode, fileHash, hash, expected, applyVerify])

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Hash className="h-5 w-5 text-primary" aria-hidden />
        <h4 className="font-semibold text-foreground">Hash &amp; Prüfen (SHA-256)</h4>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        Datei/Text lokal hashen (SHA-256) — z. B. Export-JSON. Prüfen = erwarteten Hash eintragen, dann Datei
        wählen oder Text hashen. Einstieg: Posteingang → Optionen.
      </p>

      <div className="mb-3 inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
        <button
          type="button"
          className={
            mode === 'hash'
              ? 'rounded-md bg-background px-3 py-1.5 text-xs font-semibold shadow-sm'
              : 'rounded-md px-3 py-1.5 text-xs text-muted-foreground'
          }
          onClick={() => {
            setMode('hash')
            setMatch(null)
            setErr('')
          }}
        >
          Hash erzeugen
        </button>
        <button
          type="button"
          className={
            mode === 'verify'
              ? 'rounded-md bg-background px-3 py-1.5 text-xs font-semibold shadow-sm'
              : 'rounded-md px-3 py-1.5 text-xs text-muted-foreground'
          }
          onClick={() => {
            setMode('verify')
            setMatch(null)
            setErr('')
          }}
        >
          Hash prüfen
        </button>
      </div>

      {mode === 'verify' ? (
        <label className="mb-3 block text-sm">
          <span className="text-muted-foreground">Erwarteter Hash (64 Hex)</span>
          <input
            value={expected}
            onChange={(e) => {
              setExpected(e.target.value)
              setMatch(null)
              setErr('')
            }}
            onBlur={() => recheckPending()}
            placeholder="abc123… oder 0x…"
            className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs"
            spellCheck={false}
          />
        </label>
      ) : null}

      <label className="mb-2 block text-sm">
        <span className="text-muted-foreground">Text</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Text einfügen…"
          className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
        />
      </label>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void runHashText()}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? '…' : mode === 'verify' ? 'Text prüfen' : 'Text hashen'}
        </button>
        <Label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
          {mode === 'verify' ? 'Datei prüfen…' : 'Datei wählen…'}
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            onChange={(e) => void runHashFile(e.target.files?.[0] ?? null)}
          />
        </Label>
        {mode === 'verify' && (fileHash || hash) && expected.trim() ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => recheckPending()}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            Erneut prüfen
          </button>
        ) : null}
      </div>

      {err ? <p className="mb-2 text-sm text-destructive">{err}</p> : null}
      {match === true ? (
        <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4" /> Hash stimmt überein
        </p>
      ) : null}
      {match === false ? (
        <p className="mb-2 text-sm font-medium text-destructive">
          Hash stimmt nicht — Datei/Text oder erwarteter Hash prüfen (Absichtstest: eine Ziffer ändern).
        </p>
      ) : null}

      {hash ? (
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          {fileName ? <p className="mb-1 text-[11px] text-muted-foreground">Datei: {fileName}</p> : null}
          <code className="block break-all font-mono text-[11px] text-foreground">{hash}</code>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            onClick={() => {
              void navigator.clipboard.writeText(hash)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Kopiert' : 'Hash kopieren'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
