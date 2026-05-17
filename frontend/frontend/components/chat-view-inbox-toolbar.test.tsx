import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatViewInboxToolbar, type ChatViewInboxToolbarProps } from '@/frontend/components/chat-view-inbox-toolbar'

function makeProps(overrides: Partial<ChatViewInboxToolbarProps> = {}): ChatViewInboxToolbarProps {
  return {
    messageCount: 0,
    inboxRowCount: 0,
    morgPkgFileRef: createRef<HTMLInputElement>(),
    morgPkgDeviceFilesRef: createRef<HTMLInputElement>(),
    onMorgPkgImportFile: vi.fn(),
    onMorgPkgDeviceFiles: vi.fn(),
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
