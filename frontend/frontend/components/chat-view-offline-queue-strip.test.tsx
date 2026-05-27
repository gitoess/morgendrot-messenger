import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewOfflineQueueStrip } from '@/frontend/components/chat-view-offline-queue-strip'

describe('ChatViewOfflineQueueStrip', () => {
  it('rendert nichts bei pending=0 ohne alwaysVisible', () => {
    const { container } = render(<ChatViewOfflineQueueStrip pending={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('zeigt Idle-Hinweis bei alwaysVisible', () => {
    render(<ChatViewOfflineQueueStrip pending={0} alwaysVisible />)
    expect(screen.getByText(/Offline-Warteschlange/)).toBeInTheDocument()
  })

  it('zeigt Einzahl und Erneut-versuchen', () => {
    const onRefresh = vi.fn()
    render(<ChatViewOfflineQueueStrip pending={1} errorHint="rpc timeout" onManualRefresh={onRefresh} />)
    expect(screen.getByText(/1 Nachricht wartet/)).toBeInTheDocument()
    expect(screen.getByText(/rpc timeout/)).toBeInTheDocument()
    screen.getByRole('button', { name: /Erneut versuchen/i }).click()
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('zeigt Mehrzahl', () => {
    render(<ChatViewOfflineQueueStrip pending={3} />)
    expect(screen.getByText(/3 Nachrichten warten/)).toBeInTheDocument()
  })
})
