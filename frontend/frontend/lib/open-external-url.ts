'use client'

import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'

/**
 * Externe https-URL öffnen (Faucet, Explorer).
 * APK-WebView: `window.open` oft wirkungslos → Anchor-Click, sonst Clipboard.
 */
export async function openExternalHttpUrl(url: string): Promise<'opened' | 'copied' | 'failed'> {
  const href = url.trim()
  if (!href || !/^https?:\/\//i.test(href)) return 'failed'

  if (typeof window === 'undefined') return 'failed'

  try {
    const a = document.createElement('a')
    a.href = href
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
    if (!isCapacitorNativePlatform()) return 'opened'
  } catch {
    /* fall through */
  }

  try {
    const opened = window.open(href, '_blank', 'noopener,noreferrer')
    if (opened) return 'opened'
  } catch {
    /* fall through */
  }

  try {
    await navigator.clipboard.writeText(href)
    return 'copied'
  } catch {
    return 'failed'
  }
}
