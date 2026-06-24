'use client'

import type { RosterContactDiffSummary } from '@/frontend/lib/roster-contact-diff'
import { rosterDiffHeadline } from '@/frontend/lib/roster-contact-diff'

export function RosterContactDiffPreview(p: { diff: RosterContactDiffSummary }) {
  if (p.diff.status === 'unchanged' || p.diff.fields.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Roster: <span className="text-foreground">Keine Änderungen am Telefonbuch</span>
      </p>
    )
  }

  const badgeClass =
    p.diff.status === 'new'
      ? 'bg-emerald-500/20 text-emerald-300'
      : p.diff.status === 'conflict'
        ? 'bg-red-500/20 text-red-300'
        : 'bg-sky-500/20 text-sky-300'

  return (
    <div className="mt-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs">
      <p className="font-medium text-foreground">
        Roster-Vorschau:{' '}
        <span className={`rounded px-1.5 py-0.5 font-normal ${badgeClass}`}>{rosterDiffHeadline(p.diff)}</span>
      </p>
      <ul className="mt-1.5 space-y-1 text-muted-foreground">
        {p.diff.fields.map((f) => (
          <li key={f.key}>
            <span className="text-foreground">{f.label}:</span>{' '}
            {f.before ? (
              <>
                <span className="line-through opacity-70">{f.before}</span>
                {' → '}
              </>
            ) : null}
            {f.after ? <span className="font-mono text-foreground">{f.after}</span> : null}
            {f.status === 'conflict' ? (
              <span className="ml-1 text-red-400">(bestehender Wert wird überschrieben)</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
