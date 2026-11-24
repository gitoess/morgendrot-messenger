/**
 * `@meshtastic/core` loggt `Error received for packet …: undefined` und rejected
 * oft mit Plain-Object `{ id, error }`.
 *
 * Next DevTools patcht `console.error` und ruft **immer zuerst** `handleConsoleError`
 * auf → Overlay „Console Error“ / Runtime `[object Object]`, selbst wenn wir
 * weiter unten schlucken. Deshalb: **unser Wrapper muss outermost bleiben**
 * (`reassertMeshtasticConsoleErrorFilter`) und Benign **ohne** Next weiterreichen.
 */

const PACKET_ERR_RE = /^Error received for packet\s+\d+/i

let listenersInstalled = false
let ourConsoleError: ((...args: unknown[]) => void) | null = null

export function isMeshtasticSdkPacketConsoleError(message: string): boolean {
  return PACKET_ERR_RE.test(message)
}

function argToProbeString(a: unknown): string {
  if (a instanceof Error) return `${a.name} ${a.message}`
  if (typeof a === 'string') return a
  if (a && typeof a === 'object') {
    try {
      return JSON.stringify(a)
    } catch {
      return ''
    }
  }
  return String(a ?? '')
}

/** SDK `{ id, error }` / Serial-Rauschen — kein Next-Overlay. */
export function isMeshtasticBenignUnhandledReason(reason: unknown): boolean {
  if (reason == null) return false
  if (reason instanceof Error || (typeof DOMException !== 'undefined' && reason instanceof DOMException)) {
    const name = reason.name || ''
    const msg = (reason.message || '').trim()
    if (name === 'NetworkError' || name === 'BreakError' || name === 'Runtime Error') return true
    if (msg === '[object Object]' || msg === '') return true
    if (/Break received|device has been lost|\[object Object\]/i.test(`${name} ${msg}`)) return true
    if (isMeshtasticSdkPacketConsoleError(msg)) return true
    if ((reason as { __NEXT_ERROR_CODE?: string }).__NEXT_ERROR_CODE === 'E394') return true
  }
  if (typeof reason === 'object' && !(reason instanceof Error)) {
    const o = reason as Record<string, unknown>
    if ('error' in o || 'id' in o) return true
  }
  const s = argToProbeString(reason)
  if (/Break received|BreakError|device has been lost|NetworkError/i.test(s)) return true
  if (s === '[object Object]' || s === '{}' || s === 'null') return true
  if (/"error"\s*:\s*\d+/i.test(s)) return true
  if (/RATE_LIMIT_EXCEEDED|MAX_RETRANSMIT|TIMEOUT|DUTY_CYCLE/i.test(s)) return true
  if (isMeshtasticSdkPacketConsoleError(s)) return true
  return false
}

export function isMeshtasticBenignConsoleErrorArgs(args: unknown[]): boolean {
  for (const a of args) {
    if (typeof a === 'string' && isMeshtasticSdkPacketConsoleError(a)) return true
    if (isMeshtasticBenignUnhandledReason(a)) return true
    const s = argToProbeString(a)
    if (s.startsWith('[meshtastic] unhandled rejection')) return true
    if (s === '[object Object]') return true
    if (isMeshtasticSdkPacketConsoleError(s)) return true
  }
  if (
    args.length === 1 &&
    args[0] instanceof Error &&
    (args[0].message === '[object Object]' ||
      !args[0].message ||
      isMeshtasticSdkPacketConsoleError(args[0].message))
  ) {
    return true
  }
  return false
}

function swallowBenignRejection(ev: Event): void {
  const reason = (ev as PromiseRejectionEvent).reason
  if (!isMeshtasticBenignUnhandledReason(reason)) return
  ev.preventDefault()
  ev.stopImmediatePropagation()
}

function swallowBenignError(ev: Event): void {
  const e = ev as ErrorEvent
  const probe = e.error ?? e.message
  if (
    !isMeshtasticBenignUnhandledReason(probe) &&
    !isMeshtasticBenignUnhandledReason(e.message) &&
    !(typeof e.message === 'string' && e.message.trim() === '[object Object]')
  ) {
    return
  }
  e.preventDefault()
  e.stopImmediatePropagation()
}

function patchAddEventListenerForBenignMeshNoise(): void {
  if (typeof window === 'undefined') return
  const w = window as Window & { __morgMeshAelPatched?: boolean }
  if (w.__morgMeshAelPatched) return
  w.__morgMeshAelPatched = true
  const orig = window.addEventListener.bind(window)
  window.addEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ) => {
    if ((type === 'unhandledrejection' || type === 'error') && listener != null) {
      const wrapped: EventListener = (ev) => {
        if (
          type === 'unhandledrejection' &&
          isMeshtasticBenignUnhandledReason((ev as PromiseRejectionEvent).reason)
        ) {
          ev.preventDefault()
          return
        }
        if (type === 'error') {
          const ee = ev as ErrorEvent
          const probe = ee.error ?? ee.message
          if (
            isMeshtasticBenignUnhandledReason(probe) ||
            (typeof ee.message === 'string' && ee.message.trim() === '[object Object]')
          ) {
            ee.preventDefault()
            return
          }
        }
        if (typeof listener === 'function') listener.call(window, ev)
        else listener.handleEvent(ev)
      }
      return orig(type, wrapped, options)
    }
    return orig(type, listener as EventListener, options)
  }) as typeof window.addEventListener
}

/**
 * Next patcht `console.error` nach unserem ersten Install — erneut outermost werden.
 * Benign: **kein** Weiterreichen an Next (`handleConsoleError`).
 */
export function reassertMeshtasticConsoleErrorFilter(): void {
  if (typeof console === 'undefined') return
  if (ourConsoleError && console.error === ourConsoleError) return
  const inner = console.error.bind(console)
  ourConsoleError = (...args: unknown[]) => {
    if (isMeshtasticBenignConsoleErrorArgs(args)) return
    inner(...args)
  }
  console.error = ourConsoleError as typeof console.error
}

export function installMeshtasticConsoleErrorFilter(): void {
  if (typeof console === 'undefined') return
  patchAddEventListenerForBenignMeshNoise()
  reassertMeshtasticConsoleErrorFilter()
  if (listenersInstalled || typeof window === 'undefined') return
  listenersInstalled = true
  window.addEventListener('unhandledrejection', swallowBenignRejection, true)
  window.addEventListener('error', swallowBenignError, true)
}
