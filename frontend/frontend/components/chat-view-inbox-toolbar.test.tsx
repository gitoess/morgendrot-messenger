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
    onExportMorgMediaZip: vi.fn(),
    onExportMorgMediaDirect: vi.fn(),
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
    onBulkMarkProtokollSelected: vi.fn(),
    onBulkCopySelected: vi.fn(),
    onBulkExportJsonSelected: vi.fn(),
    onBulkHashSelected: vi.fn(),
    onBulkForwardSelected: vi.fn(),
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

  it('schaltet Auswahl-Modus um', () => {
    const setInboxSelectMode = vi.fn()
    render(<ChatViewInboxToolbar {...makeProps({ setInboxSelectMode, inboxSelectMode: false })} />)
    fireEvent.click(screen.getByRole('button', { name: /^Auswahl$/i }))
    expect(setInboxSelectMode).toHaveBeenCalledTimes(1)
    const updater = setInboxSelectMode.mock.calls[0]?.[0]
    expect(typeof updater).toBe('function')
    expect(updater(false)).toBe(true)
  })

  it('zeigt Listenfilter als Dropdown (ohne Liste-Label)', async () => {
    render(
      <ChatViewInboxToolbar
        {...makeProps({
          onDirectionFilterChange: vi.fn(),
          onWireFilterChange: vi.fn(),
          onMediaFilterChange: vi.fn(),
        })}
      />
    )
    expect(screen.queryByText(/^Liste$/i)).not.toBeInTheDocument()
    const filterBtn = screen.getByRole('button', { name: /Listenfilter/i })
    expect(filterBtn).toHaveTextContent(/^Filter$/i)
    fireEvent.pointerDown(filterBtn, { button: 0, ctrlKey: false, pointerType: 'mouse' })
    fireEvent.click(filterBtn)
    expect(await screen.findByRole('menuitem', { name: /Beides/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Eingang/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Verschlüsselt/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /^Klartext$/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Bilder/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /^Audio$/i })).toBeInTheDocument()
  })

  it('Richtung- und Inhalt-Klick im Filter-Menü', async () => {
    const onDirectionFilterChange = vi.fn()
    const onWireFilterChange = vi.fn()
    render(
      <ChatViewInboxToolbar
        {...makeProps({
          onDirectionFilterChange,
          onWireFilterChange,
          directionFilter: 'in',
          wireFilter: 'encrypted',
        })}
      />
    )
    const filterBtn = screen.getByRole('button', { name: /Listenfilter/i })
    expect(filterBtn).toHaveTextContent(/Eingang · Verschl\./i)
    fireEvent.pointerDown(filterBtn, { button: 0, ctrlKey: false, pointerType: 'mouse' })
    fireEvent.click(filterBtn)
    fireEvent.click(await screen.findByRole('menuitem', { name: /Eingang/i }))
    expect(onDirectionFilterChange).toHaveBeenCalledWith('in')
    fireEvent.click(screen.getByRole('menuitem', { name: /Verschlüsselt/i }))
    expect(onWireFilterChange).toHaveBeenCalledWith('encrypted')
  })

  it('blendet Wire/Klartext bei Funk-pathTools aus; Optionen bleibt', () => {
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

  it('bündelt Werkzeuge unter Optionen; kein On-Chain-Button; Aktualisieren nicht in der Leiste', () => {
    render(<ChatViewInboxToolbar {...makeProps({ messageCount: 2 })} />)
    expect(screen.getByRole('button', { name: /Optionen/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /On-Chain \/ NFT/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Aktualisieren/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Pakete$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Nachrichtenverlauf$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /PWMSG entschlüsseln/i })).not.toBeInTheDocument()
  })

  it('zeigt Chain-Text, PWMSG, Hash, Passwort-JSON und Chain/Warteschlange unter Optionen', async () => {
    render(
      <ChatViewInboxToolbar
        {...makeProps({
          messageCount: 3,
          showIotaExpertInboxActions: true,
          pathTools: inboxToolbarToolsForSendPath({ activeSendPath: 'internet' }),
        })}
      />
    )
    const btn = screen.getByRole('button', { name: /Optionen/i })
    fireEvent.pointerDown(btn, { button: 0, ctrlKey: false, pointerType: 'mouse' })
    fireEvent.click(btn)
    expect(screen.queryByRole('menuitem', { name: /Posteingang-Bilder/i })).not.toBeInTheDocument()
    expect(await screen.findByRole('menuitem', { name: /Chain-Text/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /PWMSG entschlüsseln/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Hash & Prüfen/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Export Nachrichtenverlauf/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Passwort-JSON öffnen/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Chain \/ Warteschlange/i })).toBeInTheDocument()
  })

  it('hält Passwort-JSON und Chain/Warteschlange außerhalb des Export-Dialogs', async () => {
    render(
      <ChatViewInboxToolbar
        {...makeProps({
          messageCount: 2,
          showIotaExpertInboxActions: true,
          pathTools: inboxToolbarToolsForSendPath({ activeSendPath: 'internet' }),
        })}
      />
    )
    const btn = screen.getByRole('button', { name: /Optionen/i })
    fireEvent.pointerDown(btn, { button: 0, ctrlKey: false, pointerType: 'mouse' })
    fireEvent.click(btn)
    fireEvent.click(await screen.findByRole('menuitem', { name: /Export Nachrichtenverlauf/i }))
    expect(screen.queryByText(/Standard: gesamter Posteingang/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Vorhandene Passwort-JSON/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Experten · Chain/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Nachrichtenverlauf exportieren/i })).toBeInTheDocument()
  })

  it('lässt Optionen offen wenn Export gesperrt (Bilder/Pakete bleiben nutzbar)', () => {
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
