/**
 * localhost und 127.0.0.1 sind unterschiedliche Origins (getrennter localStorage/Tresor).
 * Kanonisch: localhost — dort liegen typisch Session-Signer & Kontakte vom Desktop-Feldtest.
 */

export const CANONICAL_LOOPBACK_HOSTNAME = 'localhost' as const

/** Query: Redirect unterdrücken (Debug / Sonderfälle). */
export const KEEP_LOOPBACK_HOST_QUERY = 'morgKeepHost'

export function isNonCanonicalLoopbackHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase()
  return h === '127.0.0.1' || h === '[::1]' || h === '::1'
}

export function shouldRedirectToCanonicalLoopback(opts: {
  hostname: string
  search?: string
}): boolean {
  if (typeof opts.search === 'string') {
    try {
      const q = new URLSearchParams(opts.search.startsWith('?') ? opts.search.slice(1) : opts.search)
      if (q.get(KEEP_LOOPBACK_HOST_QUERY) === '1') return false
    } catch {
      /* ignore */
    }
  }
  return isNonCanonicalLoopbackHostname(opts.hostname)
}

/** Ziel-URL mit kanonischem Host; null wenn kein Redirect nötig. */
export function buildCanonicalLoopbackRedirectHref(href: string): string | null {
  let u: URL
  try {
    u = new URL(href)
  } catch {
    return null
  }
  if (!shouldRedirectToCanonicalLoopback({ hostname: u.hostname, search: u.search })) return null
  u.hostname = CANONICAL_LOOPBACK_HOSTNAME
  return u.href
}

/** Inline-Script für &lt;head&gt; — Redirect vor Hydration / LS-Lesezugriff. */
export const CANONICAL_LOOPBACK_REDIRECT_INLINE_SCRIPT = `(function(){try{var s=location.search||'';if(s.indexOf('${KEEP_LOOPBACK_HOST_QUERY}=1')>=0)return;var h=location.hostname;if(h==='127.0.0.1'||h==='[::1]'||h==='::1'){var u=new URL(location.href);u.hostname='${CANONICAL_LOOPBACK_HOSTNAME}';location.replace(u.href);}}catch(e){}})();`
