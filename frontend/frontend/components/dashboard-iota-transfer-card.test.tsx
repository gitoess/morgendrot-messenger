import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { transferCoins } from '@/frontend/lib/api'
import { DashboardIotaTransferCard } from './dashboard-iota-transfer-card'

vi.mock('@/frontend/lib/api', () => ({
  transferCoins: vi.fn(),
  saveContactEntry: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/frontend/hooks/use-contact-directory', () => ({
  useContactDirectory: () => ({ directory: {}, refresh: vi.fn() }),
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

vi.mock('@/frontend/lib/iota-activity-local-log', () => ({
  recordIotaActivity: vi.fn(),
}))

vi.mock('@/frontend/components/qr-camera-scan-dialog', () => ({
  QrCameraScanDialog: () => null,
}))

vi.mock('@/frontend/lib/nft-vault-discover-onchain', () => ({
  syncDiscoveredVaultsIntoLocalIndex: vi.fn().mockResolvedValue({ ok: true, guarded: 0, bearer: 0 }),
}))

vi.mock('@/frontend/components/dashboard-nft-secured-spend-panel', async () => {
  const React = await import('react')
  return {
    DashboardNftSecuredSpendPanel: React.forwardRef(function MockSecured(
      p: { interactive?: boolean },
      _ref: unknown
    ) {
      return (
        <div aria-disabled={p.interactive === false}>
          <span>NFT / Schlüsselkarte</span>
          <span>Guthaben</span>
        </div>
      )
    }),
  }
})

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
    expect(screen.getByRole('button', { name: /Saldo \+ Vault-Index aktualisieren/i })).toBeInTheDocument()
  })

  it('ruft transferCoins auf und zeigt Erfolg', async () => {
    const { recordIotaActivity } = await import('@/frontend/lib/iota-activity-local-log')
    vi.mocked(transferCoins).mockResolvedValue({ ok: true, txDigest: 'digest1' })
    render(<DashboardIotaTransferCard />)
    fireEvent.change(screen.getByPlaceholderText(/0x/i), { target: { value: '0xabc' } })
    fireEvent.change(screen.getByPlaceholderText('0.1'), { target: { value: '1.5' } })
    fireEvent.change(screen.getByPlaceholderText('optional'), { target: { value: 'Miete' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Überweisen/i }))
    })

    expect(transferCoins).toHaveBeenCalledWith('0xabc', 1.5)
    expect(screen.getByText(/Transfer erfolgreich/i)).toBeInTheDocument()
    expect(recordIotaActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'coin_out',
        counterparty: '0xabc',
        digest: 'digest1',
        summary: expect.stringContaining('Notiz: Miete'),
      })
    )
  })

  it('ruft nach erfolgreichem Transfer onRefreshStatus auf', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    render(<DashboardIotaTransferCard onRefreshStatus={onRefresh} />)
    fireEvent.change(screen.getByPlaceholderText(/0x/i), { target: { value: '0xabc' } })
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
    fireEvent.change(screen.getByPlaceholderText(/0x/i), { target: { value: '0x1' } })
    fireEvent.change(screen.getByPlaceholderText('0.1'), { target: { value: '2' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Überweisen/i }))
    })

    expect(screen.getByText('Gas')).toBeInTheDocument()
  })

  it('NFT gesichert zeigt NFT-Block inline (sonst unsichtbar)', () => {
    render(<DashboardIotaTransferCard />)
    expect(screen.queryByText('NFT / Schlüsselkarte')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^NFT gesichert$/i }))
    expect(screen.getByText('NFT / Schlüsselkarte')).toBeInTheDocument()
    expect(screen.getByText('Guthaben')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/0x… oder oben wählen/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aus Vault senden/i })).toBeInTheDocument()
  })

  it('Aktualisieren refresht auch ohne onRefreshStatus (Purse-Summe)', async () => {
    const { requestNftVaultBalanceRefresh } = await import(
      '@/frontend/components/dashboard-nft-secured-balances'
    )
    render(<DashboardIotaTransferCard />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Saldo \+ Vault-Index aktualisieren/i }))
    })
    expect(requestNftVaultBalanceRefresh).toHaveBeenCalled()
  })
})
