import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatViewInboxCategoryChips } from '@/frontend/components/chat-view-inbox-category-chips'

const emptyCounts = { alle: 0, lagebild: 0, direkt: 0, funk: 0 }

describe('ChatViewInboxCategoryChips (§ H.1a)', () => {
  it('rendert Standard-Kategorien inkl. Pinnwand', () => {
    render(
      <ChatViewInboxCategoryChips
        category="alle"
        onCategoryChange={vi.fn()}
        unreadCounts={emptyCounts}
      />
    )
    expect(screen.getByRole('tab', { name: /^All$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Pinnwand$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Direct$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Radio$/i })).toBeInTheDocument()
  })

  it('blendet Pinnwand aus wenn showLagebild=false', () => {
    render(
      <ChatViewInboxCategoryChips
        category="alle"
        onCategoryChange={vi.fn()}
        unreadCounts={emptyCounts}
        showLagebild={false}
      />
    )
    expect(screen.queryByRole('tab', { name: /^Pinnwand$/i })).not.toBeInTheDocument()
  })

  it('ruft onCategoryChange beim Tab-Klick auf', () => {
    const onCategoryChange = vi.fn()
    render(
      <ChatViewInboxCategoryChips
        category="alle"
        onCategoryChange={onCategoryChange}
        unreadCounts={emptyCounts}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: /^Radio$/i }))
    expect(onCategoryChange).toHaveBeenCalledWith('funk')
  })

  it('zeigt Unread-Badge nur auf inaktiven Tabs', () => {
    const onCategoryChange = vi.fn()
    const { rerender } = render(
      <ChatViewInboxCategoryChips
        category="alle"
        onCategoryChange={onCategoryChange}
        unreadCounts={{ alle: 0, lagebild: 0, direkt: 3, funk: 0 }}
      />
    )
    expect(screen.getByLabelText('3 unread')).toBeInTheDocument()
    rerender(
      <ChatViewInboxCategoryChips
        category="direkt"
        onCategoryChange={onCategoryChange}
        unreadCounts={{ alle: 0, lagebild: 0, direkt: 3, funk: 0 }}
      />
    )
    expect(screen.queryByLabelText('3 unread')).not.toBeInTheDocument()
  })

  it('kürzt Unread >99 als 99+', () => {
    render(
      <ChatViewInboxCategoryChips
        category="alle"
        onCategoryChange={vi.fn()}
        unreadCounts={{ alle: 0, lagebild: 0, direkt: 0, funk: 120 }}
      />
    )
    expect(screen.getByRole('tab', { name: /Radio/ })).toHaveTextContent('99+')
  })
})
