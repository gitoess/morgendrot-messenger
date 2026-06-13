'use client'

import { Mic, Square, Loader2, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VoiceRecordKind, VoiceRecordPhase } from '@/frontend/features/voice/messenger-voice-record'

export type ChatViewVoiceRecordProps = {
  slot: 'normal' | 'emergency'
  activeKind: VoiceRecordKind | null
  phase: VoiceRecordPhase
  progress01: number
  maxSeconds: number
  /** SOS: Sendeziel Online (IOTA) vs Funk – nur für Hinweistext, Dauer ist überall kurz. */
  emergencySosOnline?: boolean
  /** Normale Memo: Online darf länger sein als Funk (nur Hinweistext). */
  normalIsOnline?: boolean
  onToggle: () => void
  /** Start blockieren (Stop während Aufnahme bleibt möglich). */
  blockedStart: boolean
  /** Kompakte Leiste neben „Online senden“ vs. großer Block im Composer. */
  density?: 'comfortable' | 'compact'
}

export function ChatViewVoiceRecord(p: ChatViewVoiceRecordProps) {
  const {
    slot,
    activeKind,
    phase,
    progress01,
    maxSeconds,
    emergencySosOnline,
    normalIsOnline,
    onToggle,
    blockedStart,
    density = 'comfortable',
  } = p
  const compact = density === 'compact'
  const isThisSlot = activeKind === slot && phase !== 'idle'
  const recording = phase === 'recording' && isThisSlot
  const encoding = phase === 'encoding' && isThisSlot
  const starting = phase === 'starting' && isThisSlot
  const pct = Math.round(progress01 * 100)
  const disableToggle = starting || encoding || (!recording && blockedStart)

  const elapsed = (progress01 * maxSeconds).toFixed(1)
  const label =
    slot === 'emergency'
      ? encoding
        ? emergencySosOnline
          ? 'SOS-Sprache wird für Online (IOTA) vorbereitet…'
          : 'SOS-Sprache wird für Funk vorbereitet…'
        : starting
          ? 'Mikrofon wird gestartet…'
          : recording
            ? `Stoppen (${elapsed} / ${maxSeconds}s) – Notfall`
            : `SOS-Sprache (Notfall, max. ${maxSeconds}s)`
      : encoding
        ? 'Opus wird erzeugt…'
        : starting
          ? 'Mikrofon wird gestartet…'
          : recording
            ? `Stoppen (${elapsed} / ${maxSeconds}s)`
            : 'Sprachnachricht aufnehmen'

  const isEmergency = slot === 'emergency'

  return (
    <div className={cn(compact ? 'inline-flex max-w-[min(100%,16rem)] flex-col gap-1' : 'mb-3 space-y-2')}>
      <button
        type="button"
        aria-pressed={recording}
        disabled={disableToggle}
        onClick={onToggle}
        className={cn(
          'flex items-center justify-center gap-2 rounded-xl border-2 font-semibold transition-colors',
          compact
            ? 'min-h-10 rounded-lg px-3 py-2 text-xs'
            : 'w-full gap-3 px-4 py-3 text-base',
          isEmergency
            ? compact
              ? 'border-orange-600/70 bg-orange-950/40 text-orange-50 hover:bg-orange-950/55'
              : 'min-h-[4.25rem] sm:min-h-[4.5rem] border-orange-600/70 bg-orange-950/40 text-orange-50 hover:bg-orange-950/55'
            : compact
              ? 'border-primary/50 bg-primary/12 text-foreground hover:bg-primary/20'
              : 'min-h-[3rem] sm:min-h-[3.25rem] border-primary/60 bg-primary/15 text-foreground hover:bg-primary/25',
          recording &&
            (isEmergency
              ? 'border-orange-400/90 bg-orange-900/50 text-orange-50'
              : 'border-red-500/70 bg-red-950/35 text-red-100 hover:bg-red-950/50'),
          disableToggle && 'cursor-not-allowed opacity-50'
        )}
      >
        {encoding ? (
          <Loader2 className={cn('shrink-0 animate-spin', compact ? 'h-4 w-4' : 'h-6 w-6')} aria-hidden />
        ) : recording ? (
          <Square className={cn('shrink-0 fill-current', compact ? 'h-4 w-4' : 'h-6 w-6')} aria-hidden />
        ) : isEmergency ? (
          <Radio className={cn('shrink-0', compact ? 'h-4 w-4' : 'h-7 w-7')} aria-hidden />
        ) : (
          <Mic className={cn('shrink-0', compact ? 'h-4 w-4' : 'h-6 w-6')} aria-hidden />
        )}
        <span className={cn('leading-snug', compact ? 'text-left' : 'text-center')}>
          {compact && slot === 'normal' && !recording && !encoding && !starting ? 'Sprachmemo' : label}
        </span>
      </button>
      {(recording || starting) && isThisSlot && (
        <div className="space-y-1">
          <div className={cn('w-full overflow-hidden rounded-full bg-muted', compact ? 'h-1.5' : 'h-2.5')}>
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-75',
                recording
                  ? isEmergency
                    ? 'bg-orange-400/90'
                    : 'bg-red-400/90'
                  : isEmergency
                    ? 'bg-orange-500/60'
                    : 'bg-primary/60'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          {!compact ? (
            <p className="text-center text-xs text-muted-foreground">
              {isEmergency
                ? emergencySosOnline
                  ? `Max. ${maxSeconds}s – Opus auf dem CM4; Sendepfad bleibt „Online“ (IOTA).`
                  : `Max. ${maxSeconds}s – Opus für LoRa; Sendepfad bleibt „Funk“.`
                : normalIsOnline
                  ? `Max. ${maxSeconds}s – Online (IOTA): längere Memos möglich; Opus auf dem CM4.`
                  : `Max. ${maxSeconds}s (LoRa-tauglich) — Encoding mit ffmpeg auf dem Gerät (CM4), nicht auf dem Funkmodul.`}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">max. {maxSeconds}s</p>
          )}
        </div>
      )}
    </div>
  )
}
