/** Sichtbarer Wire-Marker — trennt Pinnwand-Posts von 1:1-Klartext, wenn Brett = MY_ADDRESS. */
export const MORG_PINNWAND_V1_PREFIX = '[[MORG_PINNWAND_V1]]'

export function hasPinnwandPostMarker(content: string | null | undefined): boolean {
  const t = (content ?? '').trimStart()
  return t.startsWith(MORG_PINNWAND_V1_PREFIX)
}

export function prependPinnwandPostMarker(content: string): string {
  const body = (content ?? '').trim()
  if (!body) return MORG_PINNWAND_V1_PREFIX
  if (hasPinnwandPostMarker(body)) return body
  return `${MORG_PINNWAND_V1_PREFIX}${body}`
}

export function stripPinnwandPostMarker(content: string): string {
  const t = (content ?? '').trimStart()
  if (!t.startsWith(MORG_PINNWAND_V1_PREFIX)) return content ?? ''
  return t.slice(MORG_PINNWAND_V1_PREFIX.length).trimStart()
}
