/**
 * H.18 STT — Web Speech API.
 * Chrome/Edge brauchen oft Online-Zugang zum Sprachanbieter („network“ = Cloud blockiert/offline).
 * Zuverlässiger Fallback: OS-Diktat (Windows Win+H) in den fokussierten Composer.
 */

export type SpeechRecognitionDeHandle = {
  stop: () => void
}

type RecCtor = new () => {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
  onerror: ((ev: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function getRecognitionCtor(): RecCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: RecCtor
    webkitSpeechRecognition?: RecCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function canUseWebSpeechRecognition(): boolean {
  return getRecognitionCtor() != null
}

/** Kurzhinweis für Toast / UI — kein blocking Alert. */
export function osDictationHint(): string {
  return 'Composer fokussiert — Windows: Win+H (OS-Diktat). Android: Mikrofon in der Tastatur.'
}

export function startGermanDictation(opts: {
  onFinal: (transcript: string) => void
  onInterim?: (transcript: string) => void
  onError?: (message: string) => void
  onEnd?: () => void
}): SpeechRecognitionDeHandle | null {
  const Ctor = getRecognitionCtor()
  if (!Ctor) return null
  /** continuous=false: eine Äußerung; weniger „network“-Hänger als Dauer-Session. */
  const rec = new Ctor()
  rec.lang = 'de-DE'
  rec.continuous = false
  rec.interimResults = true
  rec.onresult = (ev) => {
    let interim = ''
    let finals = ''
    const list = ev.results
    for (let i = 0; i < list.length; i++) {
      const row = list[i]
      if (!row) continue
      const t = row[0]?.transcript ?? ''
      if (row.isFinal) finals += t
      else interim += t
    }
    if (finals.trim()) opts.onFinal(finals)
    if (interim.trim()) opts.onInterim?.(interim)
  }
  rec.onerror = (ev) => {
    const err = String(ev.error || 'error')
    if (err === 'aborted' || err === 'no-speech') return
    if (err === 'not-allowed') {
      opts.onError?.('Mikrofon-Zugriff verweigert.')
      return
    }
    /** Chrome Cloud-STT → „network“ bei Offline/Firewall — kein App-Bug. */
    if (err === 'network' || err === 'service-not-allowed') {
      opts.onError?.(`Spracherkennung: ${err}`)
      return
    }
    opts.onError?.(`Spracherkennung: ${err}`)
  }
  rec.onend = () => opts.onEnd?.()
  try {
    rec.start()
  } catch (e) {
    opts.onError?.(e instanceof Error ? e.message : 'Spracherkennung startet nicht.')
    return null
  }
  return {
    stop: () => {
      try {
        rec.stop()
      } catch {
        try {
          rec.abort()
        } catch {
          /* */
        }
      }
    },
  }
}
