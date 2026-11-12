import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MessengerEntityInfoDialog } from '@/frontend/components/messenger-entity-info-dialog'

describe('MessengerEntityInfoDialog', () => {
  it('zeigt Sektionen und CTA', () => {
    const onPrimary = vi.fn()
    render(
      <MessengerEntityInfoDialog
        open
        onOpenChange={() => undefined}
        title="Gruppen-Info"
        description="Test"
        sections={[
          {
            id: 'mailbox',
            title: 'Mailbox & Schlüssel',
            fields: [{ id: 'team-mb', label: 'Team-Mailbox', value: `0x${'ab'.repeat(32)}` }],
          },
        ]}
        primaryAction={{ label: 'Gruppe verwalten…', onClick: onPrimary }}
      />
    )
    expect(screen.getByText('Gruppen-Info')).toBeInTheDocument()
    expect(screen.getByText('Team-Mailbox')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Gruppe verwalten/i }))
    expect(onPrimary).toHaveBeenCalledTimes(1)
  })
})
