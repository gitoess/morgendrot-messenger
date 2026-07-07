/** Einmaliger SOS-Text vom Dashboard → Nachrichten (Senden ohne SOS-Button im Chat). */

export const DASHBOARD_SOS_PENDING_KEY = 'morgendrot.dashboardSosPending'

export function setDashboardSosPending(text: string): void {
  try {
    sessionStorage.setItem(DASHBOARD_SOS_PENDING_KEY, text)
  } catch {
    /* ignore */
  }
}

export function consumeDashboardSosPending(): string | null {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_SOS_PENDING_KEY)
    if (raw) sessionStorage.removeItem(DASHBOARD_SOS_PENDING_KEY)
    return raw?.trim() ? raw : null
  } catch {
    return null
  }
}

export function peekDashboardSosPending(): string | null {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_SOS_PENDING_KEY)
    return raw?.trim() ? raw : null
  } catch {
    return null
  }
}
