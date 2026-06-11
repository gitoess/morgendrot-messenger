import { i18n } from '@/frontend/lib/i18n/client'

/** Standalone-Namespace ohne strikte i18n-Key-Typen (dynamische Hint-Keys). */
export function standaloneT(key: string): string {
  return String((i18n.t as (k: string, o?: { ns: string }) => string)(key, { ns: 'standalone' }))
}
