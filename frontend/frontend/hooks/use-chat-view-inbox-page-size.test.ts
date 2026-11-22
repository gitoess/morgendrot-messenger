import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/** Guard: Web-Reset darf nicht wieder auf 500+ Auto-Append explodieren (DOM-Last). */
describe('inbox page size (source guard)', () => {
  it('RESET_PAGE_SIZE_WEB bleibt klein und Auto-Append aus', () => {
    const src = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'use-chat-view-inbox.ts'),
      'utf8'
    )
    expect(src).toMatch(/const RESET_PAGE_SIZE_WEB = 80\b/)
    expect(src).toMatch(/const AUTO_APPEND_ROUNDS_ON_RESET = 0\b/)
    expect(src).not.toMatch(/const RESET_PAGE_SIZE_WEB = 500\b/)
  })
})
