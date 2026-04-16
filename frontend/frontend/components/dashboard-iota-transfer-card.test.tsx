import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { transferCoins } from '@/frontend/lib/api'
import { DashboardIotaTransferCard } from './dashboard-iota-transfer-card'

vi.mock('@/frontend/lib/api', () => ({
  transferCoins: vi.fn(),
}))

describe('DashboardIotaTransferCard', () => {
  beforeEach(() => {
    vi.mocked(transferCoins).mockReset()
    vi.mocked(transferCoins).mockResolvedValue({ ok: true })
  })

  it('zeigt Titel und deaktiviert Überweisen ohne Eingaben', () => {
    render(<DashboardIotaTransferCard />)
    expect(screen.getByRole('heading', { name: /IOTA überweisen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Überweisen/i })).toBeDisabled()
  })

  it('ruft transferCoins auf und zeigt Erfolg', async () => {
    render(<DashboardIotaTransferCard />)
    fireEvent.change(screen.getByPlaceholderText('0x...'), { target: { value: '0xabc' } })
    fireEvent.change(screen.getByPlaceholderText('0.1'), { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: /Überweisen/i }))

    await waitFor(() => {
      expect(transferCoins).toHaveBeenCalledWith('0xabc', 1.5)
    })
    await waitFor(() => {
      expect(screen.getByText('Transfer erfolgreich!')).toBeInTheDocument()
    })
  })

  it('zeigt Fehlermeldung bei Fehlschlag', async () => {
    vi.mocked(transferCoins).mockResolvedValue({ ok: false, error: 'Gas' })
    render(<DashboardIotaTransferCard />)
    fireEvent.change(screen.getByPlaceholderText('0x...'), { target: { value: '0x1' } })
    fireEvent.change(screen.getByPlaceholderText('0.1'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /Überweisen/i }))

    await waitFor(() => {
      expect(screen.getByText('Gas')).toBeInTheDocument()
    })
  })
})
