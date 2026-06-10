import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
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
    expect(screen.getByText(/Saldo nach gültiger MY_ADDRESS/i)).toBeInTheDocument()
  })

  it('zeigt Lade-Hinweis wenn MY_ADDRESS da ist aber noch kein Saldo', () => {
    render(<DashboardIotaTransferCard hasValidMyAddressForBalance onRefreshStatus={vi.fn()} />)
    expect(screen.getByText(/Saldo wird geladen/i)).toBeInTheDocument()
  })

  it('zeigt Wallet-Saldo aus Status', () => {
    render(
      <DashboardIotaTransferCard
        compact
        walletNativeIotaBalance={{ mist: '1500000000', displayIota: '1,5' }}
        hasValidMyAddressForBalance
        onRefreshStatus={vi.fn()}
      />
    )
    expect(screen.getByTitle('Exakt: 1500000000 MIST')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Saldo aktualisieren/i })).toBeInTheDocument()
  })

  it('ruft transferCoins auf und zeigt Erfolg', async () => {
    render(<DashboardIotaTransferCard />)
    fireEvent.change(screen.getByPlaceholderText('0x…'), { target: { value: '0xabc' } })
    fireEvent.change(screen.getByPlaceholderText('0.1'), { target: { value: '1.5' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Überweisen/i }))
    })

    expect(transferCoins).toHaveBeenCalledWith('0xabc', 1.5)
    expect(screen.getByText('Transfer erfolgreich!')).toBeInTheDocument()
  })

  it('ruft nach erfolgreichem Transfer onRefreshStatus auf', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    render(<DashboardIotaTransferCard onRefreshStatus={onRefresh} />)
    fireEvent.change(screen.getByPlaceholderText('0x…'), { target: { value: '0xabc' } })
    fireEvent.change(screen.getByPlaceholderText('0.1'), { target: { value: '1.5' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Überweisen/i }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onRefresh).toHaveBeenCalled()
  })

  it('zeigt Fehlermeldung bei Fehlschlag', async () => {
    vi.mocked(transferCoins).mockResolvedValue({ ok: false, error: 'Gas' })
    render(<DashboardIotaTransferCard />)
    fireEvent.change(screen.getByPlaceholderText('0x…'), { target: { value: '0x1' } })
    fireEvent.change(screen.getByPlaceholderText('0.1'), { target: { value: '2' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Überweisen/i }))
    })

    expect(screen.getByText('Gas')).toBeInTheDocument()
  })
})
