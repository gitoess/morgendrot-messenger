import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EinsatzleitungHelferFlowPanel } from './einsatzleitung-helfer-flow-panel'

describe('EinsatzleitungHelferFlowPanel', () => {
  it('ruft onSelectStep bei Klick auf Handoff auf', () => {
    const onSelectStep = vi.fn()
    render(<EinsatzleitungHelferFlowPanel onSelectStep={onSelectStep} />)
    fireEvent.click(screen.getByRole('listitem', { name: /Handoff-ZIP/i }))
    expect(onSelectStep).toHaveBeenCalledWith('handoff')
  })

  it('markiert aktiven Schritt', () => {
    render(<EinsatzleitungHelferFlowPanel activeStep="join" onSelectStep={vi.fn()} />)
    expect(screen.getByRole('listitem', { name: /Spontan beitreten/i })).toHaveAttribute('aria-pressed', 'true')
  })
})
