import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EinsatzleitungJoinRequestsPanel } from '@/frontend/components/einsatzleitung-join-requests-panel'
import { upsertJoinRequestFromWire } from '@/frontend/lib/team-join-request-store'
import { enqueueRosterPendingSuggestion } from '@/frontend/lib/team-roster-pending-store'

vi.mock('@/frontend/lib/api/contacts', () => ({
  applyInitialProfileProvisioning: vi.fn(async () => ({ ok: true, applied: 1 })),
}))
vi.mock('@/frontend/lib/team-sync-wire', () => ({
  publishTeamMemberUpdateWire: vi.fn(async () => ({ ok: true, channels: { iota: true, lan: true } })),
}))
vi.mock('@/frontend/lib/roster-pending-sync', () => ({
  refreshRosterPendingFromServer: vi.fn(async () => ({ ok: true })),
  markRosterPendingOnServer: vi.fn(async () => ({ ok: true })),
  syncJoinRequestToServer: vi.fn(async () => ({ ok: true })),
}))

import { applyInitialProfileProvisioning } from '@/frontend/lib/api/contacts'
import { publishTeamMemberUpdateWire } from '@/frontend/lib/team-sync-wire'

const BOSS = `0x${'b'.repeat(64)}`
const HELPER = `0x${'c'.repeat(64)}`

describe('EinsatzleitungJoinRequestsPanel (Roster P0 UI)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('zeigt Leerzustand ohne Anfragen', () => {
    render(<EinsatzleitungJoinRequestsPanel apiStatus={{ myAddressFull: BOSS } as never} />)
    expect(screen.getByRole('heading', { name: /Beitrittsanfragen & Roster-Vorschläge/i })).toBeInTheDocument()
    expect(screen.getByText(/Keine offenen Anfragen/i)).toBeInTheDocument()
  })

  it('zeigt Handoff-Vorschlag mit Diff und übernimmt ins Roster', async () => {
    enqueueRosterPendingSuggestion({
      source: 'handoff',
      member: { address: HELPER, name: 'Anna Handoff' },
      handoffLabel: 'helfer',
      registryEntryId: 'reg-1',
    })

    const onContactsChanged = vi.fn()
    render(
      <EinsatzleitungJoinRequestsPanel
        apiStatus={{
          myAddressFull: BOSS,
          inboxUnionMailboxIds: [`0x${'a'.repeat(64)}`],
          handoffLabel: 'team-alpha',
        } as never}
        contactDirectory={{}}
        onContactsChanged={onContactsChanged}
      />
    )

    expect(screen.getByText(/Handoff-Vorschlag/i)).toBeInTheDocument()
    expect(screen.getByText(/Neu im Roster/i)).toBeInTheDocument()
    expect(screen.getAllByText('Anna Handoff').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /Ins Roster übernehmen/i }))

    await waitFor(() => {
      expect(applyInitialProfileProvisioning).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          contacts: [expect.objectContaining({ address: HELPER, name: 'Anna Handoff' })],
        })
      )
      expect(publishTeamMemberUpdateWire).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'add',
          member: expect.objectContaining({ address: HELPER, name: 'Anna Handoff' }),
        })
      )
    })
    expect(onContactsChanged).toHaveBeenCalled()
    expect(screen.getByText(/Team-Update gesendet/i)).toBeInTheDocument()
  })

  it('verwirft Handoff-Vorschlag', () => {
    enqueueRosterPendingSuggestion({
      source: 'handoff',
      member: { address: HELPER, name: 'Verwerfen Test' },
    })

    render(<EinsatzleitungJoinRequestsPanel apiStatus={{ myAddressFull: BOSS } as never} />)
    fireEvent.click(screen.getByRole('button', { name: /Verwerfen/i }))
    expect(screen.queryByText('Verwerfen Test')).not.toBeInTheDocument()
  })

  it('freigibt Beitrittsanfrage: erst Roster, dann Team-Update', async () => {
    upsertJoinRequestFromWire({
      v: 1,
      requestId: 'jr-1',
      applicant: {
        address: HELPER,
        name: 'Max Beitritt',
        meshNodeId: '!deadbeef',
        telegramChatId: '-10099',
      },
      boss: BOSS,
      issuedAt: Date.now(),
      note: 'Bitte aufnehmen',
    })

    render(
      <EinsatzleitungJoinRequestsPanel
        apiStatus={{
          myAddressFull: BOSS,
          inboxUnionMailboxIds: [`0x${'a'.repeat(64)}`],
          handoffLabel: 'team-alpha',
        } as never}
        contactDirectory={{}}
      />
    )

    expect(screen.getByText('Beitrittsanfrage')).toBeInTheDocument()
    expect(screen.getByText(/Neu im Roster/i)).toBeInTheDocument()
    expect(screen.getByText('Bitte aufnehmen')).toBeInTheDocument()
    expect(screen.getByText(/Funk \(Node-ID\)/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Freigeben & Roster übernehmen/i }))

    await waitFor(() => {
      expect(applyInitialProfileProvisioning).toHaveBeenCalled()
      expect(publishTeamMemberUpdateWire).toHaveBeenCalled()
    })
    const rosterOrder = vi.mocked(applyInitialProfileProvisioning).mock.invocationCallOrder[0]
    const wireOrder = vi.mocked(publishTeamMemberUpdateWire).mock.invocationCallOrder[0]
    expect(rosterOrder).toBeLessThan(wireOrder)

    expect(screen.getByText(/Freigegeben — Roster aktualisiert/i)).toBeInTheDocument()
    expect(screen.getByText(/Lokales Netz ✓ · IOTA ✓/)).toBeInTheDocument()
  })

  it('zeigt Konflikt-Diff bei bestehendem Roster-Eintrag', () => {
    upsertJoinRequestFromWire({
      v: 1,
      requestId: 'jr-conflict',
      applicant: { address: HELPER, name: 'Neuer Name', meshNodeId: '!newnode' },
      boss: BOSS,
      issuedAt: Date.now(),
    })

    render(
      <EinsatzleitungJoinRequestsPanel
        apiStatus={{ myAddressFull: BOSS } as never}
        contactDirectory={{
          [HELPER]: { label: 'Alter Name', meshNodeId: '!oldnode' },
        }}
      />
    )

    expect(screen.getByText(/Konflikt — prüfen/i)).toBeInTheDocument()
    expect(screen.getAllByText(/bestehender Wert wird überschrieben/i).length).toBeGreaterThan(0)
  })

  it('lehnt Beitrittsanfrage ab', () => {
    upsertJoinRequestFromWire({
      v: 1,
      requestId: 'jr-reject',
      applicant: { address: HELPER, name: 'Abgelehnt' },
      boss: BOSS,
      issuedAt: Date.now(),
    })

    render(<EinsatzleitungJoinRequestsPanel apiStatus={{ myAddressFull: BOSS } as never} />)
    fireEvent.click(screen.getByRole('button', { name: /^Ablehnen$/i }))
    expect(screen.queryByText('Abgelehnt')).not.toBeInTheDocument()
  })
})
