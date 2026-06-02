/** Menschenlesbare „zuletzt synchronisiert“-Anzeige (Dashboard). */
export function formatRelativeMinutes(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min) || min < 0) return 'Zeitpunkt unbekannt'
  if (min < 1) return 'gerade eben'
  if (min < 60) return `vor ${Math.round(min)} Min.`
  const hours = Math.floor(min / 60)
  if (hours < 48) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`
}
