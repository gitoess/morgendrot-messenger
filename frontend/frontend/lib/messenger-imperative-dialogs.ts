'use client'

/**
 * Kleine Brücke: Posteingangszeilen können R1- bzw. Protokoll-Dialoge öffnen,
 * obwohl die Trigger-Komponenten im Import/Export-Dropdown sitzen (Radix mount).
 */

const R1_PREFILL_KEY = 'morgendrot.r1CourierPrefillOnce.v1'
const PROTO_PREFILL_KEY = 'morgendrot.protokollAnchorPrefillOnce.v1'

export type R1CourierPrefillPayload = {
  builderSender?: string
  builderRecipient?: string
  builderPayload: string
}

export type ProtokollAnchorPrefillPayload = {
  messageIds: string[]
  variant?: 'hash' | 'full'
}

type VoidFn = () => void

let r1Open: VoidFn | null = null
let protokollOpen: VoidFn | null = null

export function registerR1CourierDialogOpener(fn: VoidFn | null) {
  r1Open = fn
}

export function registerProtokollAnchorDialogOpener(fn: VoidFn | null) {
  protokollOpen = fn
}

function stashSessionJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

function takeSessionJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    window.sessionStorage.removeItem(key)
    return JSON.parse(raw) as T
  } catch {
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    return null
  }
}

/** Für `ChatViewRelaySubmitButton`: Prefill beim nächsten Öffnen konsumieren. */
export function takeR1CourierPrefillPayload(): R1CourierPrefillPayload | null {
  return takeSessionJson<R1CourierPrefillPayload>(R1_PREFILL_KEY)
}

/** Für `ChatViewProtokollAnchorButton`: Prefill beim nächsten Öffnen konsumieren. */
export function takeProtokollAnchorPrefillPayload(): ProtokollAnchorPrefillPayload | null {
  return takeSessionJson<ProtokollAnchorPrefillPayload>(PROTO_PREFILL_KEY)
}

export function openR1CourierDialogFromPrefill(payload: R1CourierPrefillPayload) {
  stashSessionJson(R1_PREFILL_KEY, payload)
  r1Open?.()
}

/** Relay-/Kurier-Dialog (`ChatViewRelaySubmitButton`) von überall öffnen. */
export function openRelaySubmitDialog() {
  r1Open?.()
}

export function openProtokollAnchorDialogFromPrefill(payload: ProtokollAnchorPrefillPayload) {
  stashSessionJson(PROTO_PREFILL_KEY, payload)
  protokollOpen?.()
}
