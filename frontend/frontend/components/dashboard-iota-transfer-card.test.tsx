import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { transferCoins } from '@/frontend/lib/api'
import { DashboardIotaTransferCard } from './dashboard-iota-transfer-card'

vi.mock('@/frontend/lib/api', () => ({
  transferCoins: vi.fn(),
}))

vi.mock('@/frontend/components/chat-view-evidence-image-viewer', () => ({
  ChatViewEvidenceImageViewerButton: (p: { triggerLabel?: string }) => (
    <button type="button">{p.triggerLabel ?? 'NFT'}</button>
  ),
  NFT_WALLET_MODES: ['owner', 'object', 'mint', 'guthaben', 'zeitkapsel'],
}))

vi.mock('@/frontend/components/dashboard-nft-secured-balances', () => ({
  DashboardNftSecuredBalanceAmount: () => <span>0 IOTA</span>,
  requestNftVaultBalanceRefresh: vi.fn(),
  countSecuredNftObjects: () => 0,
}))

vi.mock('@/frontend/lib/nft-vault-discover-onchain', () => ({
  syncDiscoveredVaultsIntoLocalIndex: vi.fn().mockResolvedValue({ ok: true, guarded: 0, bearer: 0 }),
}))

vi.mock('@/frontend/components/dashboard-nft-secured-spend-panel', () => ({
  DashboardNftSecuredSpendPanel: () => (
    <div>
      <span>1. NFT / Schlüsselkarte</span>
      <input placeholder="0x… Empfänger-Adresse" />
      <button type="button">Jetzt senden</button>
    </div>
  ),
}))

describe('DashboardIotaTransferCard', () => {
  beforeEach(() => {
    vi.mocked(transferCoins).mockReset()
    vi.mocked(transferCoins).mockResolvedValue({ ok: true })
  })

  it('zeigt Titel und deaktiviert Überweisen ohne Eingaben', () => {
    render(<DashboardIotaTransferCard />)
    expect(screen.getByRole('heading', { name: /IOTA Wallet/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Überweisen/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^NFT$/i })).toBeInTheDocument()
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

  it('öffnet Gesichert (NFT) senden inline mit Empfängerfeld', () => {
    render(<DashboardIotaTransferCard />)
    fireEvent.click(screen.getByRole('button', { name: /^Gesichert \(NFT\) senden$/i }))
    expect(screen.getByText('1. NFT / Schlüsselkarte')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('0x… Empfänger-Adresse')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Jetzt senden|Zuerst Guthaben anlegen/i })).toBeInTheDocument()
  })

  it('Aktualisieren refresht auch ohne onRefreshStatus (Purse-Summe)', async () => {
    const { requestNftVaultBalanceRefresh } = await import(
      '@/frontend/components/dashboard-nft-secured-balances'
    )
    render(<DashboardIotaTransferCard />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Saldo aktualisieren/i }))
    })
    expect(requestNftVaultBalanceRefresh).toHaveBeenCalled()
  })
})
