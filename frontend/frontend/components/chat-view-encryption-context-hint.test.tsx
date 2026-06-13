import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ChatViewEncryptionContextHint } from '@/frontend/components/chat-view-encryption-context-hint'

describe('ChatViewEncryptionContextHint', () => {
  it('rendert nichts', () => {
    const { container } = render(<ChatViewEncryptionContextHint forcedTransport="internet" encrypted />)
    expect(container.firstChild).toBeNull()
  })
})
