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
    expect(screen.getByText(/Für den Saldo braucht/i)).toBeInTheDocument()
  })

  it('zeigt Lade-Hinweis wenn MY_ADDRESS da ist aber noch kein Saldo', () => {
    render(<DashboardIotaTransferCard hasValidMyAddressForBalance onRefreshStatus={vi.fn()} />)
    expect(screen.getByText(/Saldo wird über die IOTA-RPC/i)).toBeInTheDocument()
  })

  it('zeigt Wallet-Saldo aus Status', () => {
    render(
      <DashboardIotaTransferCard
        walletNativeIotaBalance={{ mist: '1500000000', displayIota: '1,5' }}
        hasValidMyAddressForBalance
        onRefreshStatus={vi.fn()}
      />
    )
    expect(screen.getByText(/1,5 IOTA/)).toBeInTheDocument()
    expect(screen.getByTitle(/1500000000 MIST/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aktualisieren/i })).toBeInTheDocument()
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

  it('ruft nach erfolgreichem Transfer onRefreshStatus auf', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    render(<DashboardIotaTransferCard onRefreshStatus={onRefresh} />)
    fireEvent.change(screen.getByPlaceholderText('0x...'), { target: { value: '0xabc' } })
    fireEvent.change(screen.getByPlaceholderText('0.1'), { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: /Überweisen/i }))

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled()
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
