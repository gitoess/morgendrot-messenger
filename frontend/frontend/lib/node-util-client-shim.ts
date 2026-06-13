/**
 * @meshtastic/core imports `formatWithOptions` from Node `util`. Next bundles a minimal
 * `next/dist/compiled/util` stub for the client that omits `formatWithOptions` → runtime TypeError
 * after connect. We re-export that stub and add `formatWithOptions` via `inspect` (same idea as Node).
 */
// Next internal — no published types for this path.
// @ts-expect-error compiled util
import * as base from 'next/dist/compiled/util/util.js'

// @ts-expect-error compiled util
export * from 'next/dist/compiled/util/util.js'

type InspectOptions = import('node:util').InspectOptions

/** Overrides missing export from Next's compiled `util` (see module doc). */
export function formatWithOptions(inspectOptions: InspectOptions, ...args: unknown[]): string {
  const inspectFn = base.inspect as (value: unknown, opts?: InspectOptions) => string
  return args.map((a) => inspectFn(a, inspectOptions)).join(' ')
}
