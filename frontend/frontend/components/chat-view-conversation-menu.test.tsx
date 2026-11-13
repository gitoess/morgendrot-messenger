import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  ChatConversationMenuItems,
  ChatViewConversationMenu,
} from '@/frontend/components/chat-view-conversation-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

describe('ChatViewConversationMenu Info', () => {
  it('Gruppen-Titel öffnet Info (aria Gruppen-Info)', () => {
    const onViewInfo = vi.fn()
    render(
      <ChatViewConversationMenu
        title="Alpha"
        subtitle="2 Mitglieder"
        canClearHistory
        canExport
        onViewInfo={onViewInfo}
        onManageGroup={vi.fn()}
        showChainSecurityTools={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Gruppen-Info öffnen/i }))
    expect(onViewInfo).toHaveBeenCalledTimes(1)
  })

  it('1:1-Titel öffnet Info (nicht Gruppen-Info)', () => {
    const onViewInfo = vi.fn()
    render(
      <ChatViewConversationMenu
        title="Direktchat"
        canClearHistory
        canExport
        onViewInfo={onViewInfo}
        showChainSecurityTools={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^Info öffnen$/i }))
    expect(onViewInfo).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /Gruppen-Info öffnen/i })).not.toBeInTheDocument()
  })

  it('Info-Entry Points gesetzt: Chat-Optionen + Titel-Labels Info / Gruppen-Info', () => {
    const onViewInfo = vi.fn()
    const { rerender } = render(
      <ChatViewConversationMenu
        title="Direktchat"
        canClearHistory
        canExport
        onViewInfo={onViewInfo}
        showChainSecurityTools={false}
      />
    )
    expect(screen.getByRole('button', { name: /Chat-Optionen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Info öffnen$/i })).toBeInTheDocument()

    rerender(
      <ChatViewConversationMenu
        title="Alpha"
        canClearHistory
        canExport
        onViewInfo={onViewInfo}
        onManageGroup={vi.fn()}
        showChainSecurityTools={false}
      />
    )
    expect(screen.getByRole('button', { name: /Chat-Optionen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gruppen-Info öffnen/i })).toBeInTheDocument()
  })

  it('toolbar-Variante: nur ⋮, kein Direktchat-Banner', () => {
    render(
      <ChatViewConversationMenu
        title="Direktchat"
        subtitle="Kontakt wählen oder Telefonbuch öffnen"
        canClearHistory
        canExport
        variant="toolbar"
        showChainSecurityTools={false}
      />
    )
    expect(screen.getByRole('button', { name: /Chat-Optionen/i })).toBeInTheDocument()
    expect(screen.queryByText(/^Direktchat$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Kontakt wählen/i)).not.toBeInTheDocument()
  })
})

describe('ChatConversationMenuItems', () => {
  it('rendert Info ohne ⋮-Trigger', () => {
    const onViewInfo = vi.fn()
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger asChild>
          <button type="button">open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <ChatConversationMenuItems
            title="Direktchat"
            canClearHistory
            canExport
            onViewInfo={onViewInfo}
            showChainSecurityTools={false}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    )
    expect(screen.getByText(/^Info$/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Chat-Optionen/i })).not.toBeInTheDocument()
  })
})
