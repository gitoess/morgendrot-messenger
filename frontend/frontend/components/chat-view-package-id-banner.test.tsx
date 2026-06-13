import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatViewPackageIdBanner } from '@/frontend/components/chat-view-package-id-banner'

const PKG = `0x${'f'.repeat(64)}`

describe('ChatViewPackageIdBanner (§ H.1a)', () => {
  it('rendert nichts wenn nicht sichtbar', () => {
    const { container } = render(
      <ChatViewPackageIdBanner visible={false} serverPackageId={PKG} busy={false} onSyncToServer={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('zeigt Update-Hinweis und gekürzte Package-ID', () => {
    render(
      <ChatViewPackageIdBanner visible serverPackageId={PKG} busy={false} onSyncToServer={vi.fn()} />
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Neue Protokoll-Version/)
    expect(screen.getByText(/0xffffffff…ffffff/)).toBeInTheDocument()
  })

  it('ruft onSyncToServer bei Klick auf', () => {
    const onSyncToServer = vi.fn()
    render(
      <ChatViewPackageIdBanner visible serverPackageId={PKG} busy={false} onSyncToServer={onSyncToServer} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Jetzt updaten/i }))
    expect(onSyncToServer).toHaveBeenCalledTimes(1)
  })

  it('deaktiviert Button bei busy', () => {
    render(
      <ChatViewPackageIdBanner visible serverPackageId={PKG} busy onSyncToServer={vi.fn()} />
    )
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('button')).toHaveTextContent('…')
  })
})
