import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatViewInboxToolbar, type ChatViewInboxToolbarProps } from '@/frontend/components/chat-view-inbox-toolbar'
import { exportDataDeniedReason } from '@/frontend/lib/messenger-capability-gates'
import { inboxToolbarToolsForSendPath } from '@/frontend/lib/send-path-inbox-source-filter'
import { TEST_MESSENGER_CAPABILITIES_ALL_WRITE } from '@/frontend/lib/test-fixtures/messenger-capabilities'

function makeProps(overrides: Partial<ChatViewInboxToolbarProps> = {}): ChatViewInboxToolbarProps {
  return {
    messageCount: 0,
    inboxRowCount: 0,
    morgPkgFileRef: createRef<HTMLInputElement>(),
    morgPkgDeviceFilesRef: createRef<HTMLInputElement>(),
    onMorgPkgImportFile: vi.fn(),
    onMorgPkgDeviceFiles: vi.fn(),
    onMorgPkgDeviceExportPick: vi.fn(),
    morgPkgDeviceBusy: false,
    apiStatus: { connected: true, locked: false, connectedAddresses: [] },
    onRefresh: vi.fn(),
    loading: false,
    onExportEinsatzberichtJson: vi.fn(),
    onExportEinsatzberichtTxt: vi.fn(),
    onExportEinsatzberichtTxtFull: vi.fn(),
    onExportEinsatzberichtEncrypted: vi.fn(),
    onExportEinsatzprotokoll: vi.fn(),
    onExportEinsatzprotokollPlainZip: vi.fn(),
    onExportEinsatzprotokollMarked: vi.fn(),
    protokollMarkedCount: 0,
    recipient: '',
    setStatus: vi.fn(),
    setStatusMsg: vi.fn(),
    inboxSelectMode: false,
    setInboxSelectMode: vi.fn(),
    selectedInboxCount: 0,
    showWireControls: false,
    onToggleWireControls: vi.fn(),
    showChannelControls: false,
    onToggleChannelControls: vi.fn(),
    showPartnerControls: false,
    onTogglePartnerControls: vi.fn(),
    directionFilter: 'all',
    onDirectionFilterChange: vi.fn(),
    onSelectAllVisible: vi.fn(),
    onClearInboxSelection: vi.fn(),
    onBulkHideSelected: vi.fn(),
    onBulkPurgeSelected: vi.fn(),
    hasHiddenMessages: false,
    onToggleHideAllVisibleLocal: vi.fn(),
    messages: [],
    myAddress: '',
    messagingPersistenceMode: 'event',
    ...overrides,
  }
}

describe('ChatViewInboxToolbar counter', () => {
  it('does not show total count badge', () => {
    render(<ChatViewInboxToolbar {...makeProps({ messageCount: 12, inboxRowCount: 12 })} />)
    expect(screen.queryByText(/^12$/)).toBeNull()
  })

  it('shows visible count hint when filtered rows differ', () => {
    render(<ChatViewInboxToolbar {...makeProps({ messageCount: 12, inboxRowCount: 4 })} />)
    expect(screen.getByText(/4 von 12 sichtbar/)).toBeInTheDocument()
  })

  it('hides visible count hint when all rows are visible', () => {
    render(<ChatViewInboxToolbar {...makeProps({ messageCount: 3, inboxRowCount: 3 })} />)
    expect(screen.queryByText(/\d+ von \d+ sichtbar/)).toBeNull()
  })
})

describe('ChatViewInboxToolbar Simple Mode', () => {
  it('zeigt Wartende Sendungen ohne Expert-Menü wenn Queue pending', () => {
    render(
      <ChatViewInboxToolbar
        {...makeProps({
          showIotaExpertInboxActions: false,
          offlineMailboxQueuePending: 2,
        })}
      />
    )
    expect(screen.getByRole('button', { name: /Ausstehend \(2\)/i })).toBeInTheDocument()
  })

  it('blendet Wartende Sendungen aus wenn pending=0 und kein Expert-Menü', () => {
    render(
      <ChatViewInboxToolbar
        {...makeProps({
          showIotaExpertInboxActions: false,
          offlineMailboxQueuePending: 0,
        })}
      />
    )
    expect(screen.queryByRole('button', { name: /Ausstehend/i })).not.toBeInTheDocument()
  })
})

describe('ChatViewInboxToolbar actions (§ H.1a)', () => {
  it('zeigt Handshake-Badge bei pendingHandshakeCount', () => {
    render(<ChatViewInboxToolbar {...makeProps({ pendingHandshakeCount: 3 })} />)
    expect(screen.getByTitle(/3 ausstehende Handshake-Anfrage/i)).toHaveTextContent('3')
  })

  it('ruft onRefresh bei Aktualisieren auf', () => {
    const onRefresh = vi.fn()
    render(<ChatViewInboxToolbar {...makeProps({ onRefresh })} />)
    fireEvent.click(screen.getByRole('button', { name: /Aktualisieren/i }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('deaktiviert Aktualisieren während loading', () => {
    render(<ChatViewInboxToolbar {...makeProps({ loading: true })} />)
    expect(screen.getByRole('button', { name: /Aktualisieren/i })).toBeDisabled()
  })

  it('schaltet Auswahl-Modus um', () => {
    const setInboxSelectMode = vi.fn()
    render(<ChatViewInboxToolbar {...makeProps({ setInboxSelectMode, inboxSelectMode: false })} />)
    fireEvent.click(screen.getByRole('button', { name: /^Auswahl$/i }))
    expect(setInboxSelectMode).toHaveBeenCalledTimes(1)
    const updater = setInboxSelectMode.mock.calls[0]?.[0]
    expect(typeof updater).toBe('function')
    expect(updater(false)).toBe(true)
  })

  it('zeigt Filter-Dropdown und Beides/Eingang/Ausgang', () => {
    render(<ChatViewInboxToolbar {...makeProps()} />)
    expect(screen.getByRole('button', { name: /^Filter$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Beides$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Eingang$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ausgang$/i })).toBeInTheDocument()
  })

  it('Richtung-Klick filtert die Liste', () => {
    const onDirectionFilterChange = vi.fn()
    render(<ChatViewInboxToolbar {...makeProps({ onDirectionFilterChange })} />)
    fireEvent.click(screen.getByRole('button', { name: /^Eingang$/i }))
    expect(onDirectionFilterChange).toHaveBeenCalledWith('in')
  })

  it('blendet On-Chain bei Funk-pathTools aus; Optionen bleibt', () => {
    render(
      <ChatViewInboxToolbar
        {...makeProps({
          pathTools: inboxToolbarToolsForSendPath({ activeSendPath: 'mesh' }),
        })}
      />
    )
    expect(screen.queryByRole('button', { name: /On-Chain \/ NFT/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Optionen/i })).toBeInTheDocument()
  })

  it('zeigt Kontakte-verwalten-Button wenn aktiviert', () => {
    const onOpenPhonebook = vi.fn()
    render(
      <ChatViewInboxToolbar
        {...makeProps({ showPhonebookButton: true, onOpenPhonebook })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Telefonbuch/i }))
    expect(onOpenPhonebook).toHaveBeenCalledTimes(1)
  })

  it('bündelt Werkzeuge unter Optionen; On-Chain und Aktualisieren bleiben oben', () => {
    render(<ChatViewInboxToolbar {...makeProps({ messageCount: 2 })} />)
    expect(screen.getByRole('button', { name: /Optionen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /On-Chain \/ NFT/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aktualisieren/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Pakete$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Nachrichtenverlauf$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Wire einfügen$/i })).not.toBeInTheDocument()
  })

  it('lässt Optionen offen wenn Export gesperrt (Wire/Pakete bleiben nutzbar)', () => {
    render(
      <ChatViewInboxToolbar
        {...makeProps({
          messageCount: 5,
          apiStatus: {
            connected: true,
            locked: false,
            connectedAddresses: [],
            capabilities: {
              ...TEST_MESSENGER_CAPABILITIES_ALL_WRITE,
              product: { ...TEST_MESSENGER_CAPABILITIES_ALL_WRITE.product, canExportData: false },
            },
          },
        })}
      />
    )
    expect(screen.getByRole('button', { name: /Optionen/i })).not.toBeDisabled()
    expect(exportDataDeniedReason({
      connected: true,
      locked: false,
      connectedAddresses: [],
      capabilities: {
        ...TEST_MESSENGER_CAPABILITIES_ALL_WRITE,
        product: { ...TEST_MESSENGER_CAPABILITIES_ALL_WRITE.product, canExportData: false },
      },
    })).toBeTruthy()
  })
})
