import { describe, expect, it } from 'vitest'
import { buildBossWizardMailboxesContext } from '@/frontend/lib/boss-wizard-mailboxes-context'

const PRIV = '0x' + 'a'.repeat(64)
const TEAM = '0x' + 'b'.repeat(64)

describe('boss-wizard-mailboxes-context', () => {
  it('zeigt Server-Postfach und trennt Team-IDs aus Union', () => {
    const ctx = buildBossWizardMailboxesContext({
      mailboxId: PRIV,
      inboxUnionMailboxIds: [PRIV, TEAM],
      handoffLabel: 'Alpha',
    } as never)
    expect(ctx.hasServerPrivate).toBe(true)
    expect(ctx.hasTeamMailbox).toBe(true)
    expect(ctx.allRows.map((r) => r.id)).toEqual([PRIV, TEAM])
  })

  it('Einsatz-Name allein zählt nicht als Team-Postfach', () => {
    const ctx = buildBossWizardMailboxesContext({
      mailboxId: PRIV,
      handoffLabel: 'Nur Name',
    } as never)
    expect(ctx.hasServerPrivate).toBe(true)
    expect(ctx.hasTeamMailbox).toBe(false)
  })
})
