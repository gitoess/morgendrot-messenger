'use client'

import { cn } from '@/lib/utils'

/** Ghost-Raster für S-ARQ: empfangene Segmente grün, fehlende als Platzhalter. */
export function SarqSegmentProgressGrid({
  n,
  received,
  label,
}: {
  n: number
  received: ReadonlySet<number>
  label: string
}) {
  const cols = Math.min(10, Math.max(1, n))
  return (
    <div className="space-y-0.5">
      <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: n }, (_, i) => {
          const ok = received.has(i)
          return (
            <div
              key={i}
              className={cn(
                'h-2 w-full min-h-[6px] max-h-2 rounded-[2px] border border-border/60',
                ok
                  ? 'bg-emerald-600/35 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.4)]'
                  : 'bg-zinc-900/80 dark:bg-black/70'
              )}
              title={ok ? `Segment ${i} ok` : `Segment ${i} fehlt`}
            />
          )
        })}
      </div>
    </div>
  )
}

/** `Luma 3/20` / `Chroma 0/5` → Indizes 0..done-1 als „gesendet“. */
export function parseLoraMeshProgressLine(
  line: string
): { phase: 'luma' | 'chroma'; done: number; total: number } | null {
  const m = /^(Luma|Chroma)\s+(\d+)\/(\d+)\s*$/i.exec(line.trim())
  if (!m) return null
  const total = Number(m[3])
  const done = Number(m[2])
  if (!Number.isFinite(total) || total < 1 || !Number.isFinite(done) || done < 0) return null
  return {
    phase: m[1]!.toLowerCase() === 'chroma' ? 'chroma' : 'luma',
    done: Math.min(done, total),
    total,
  }
}

export function sentIndicesUpTo(done: number): Set<number> {
  const s = new Set<number>()
  for (let i = 0; i < done; i++) s.add(i)
  return s
}
