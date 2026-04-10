import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './button'

/** Smoke: Vitest + RTL wired; expand to Send/Partner flows per PHASE-A-QUALITY-BASELINE-AND-TESTS.md */
describe('Button (RTL smoke)', () => {
  it('renders accessible label', () => {
    render(<Button type="button">Send</Button>)
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })
})
