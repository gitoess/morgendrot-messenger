import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DashboardSosEmergencyButton } from '@/frontend/components/dashboard-sos-emergency-button'
import {
  DASHBOARD_SOS_PENDING_KEY,
  consumeDashboardSosPending,
  setDashboardSosPending,
} from '@/frontend/lib/dashboard-sos-pending'

describe('dashboard-sos-pending', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('speichert und konsumiert einmalig', () => {
    setDashboardSosPending('Hilfe')
    expect(sessionStorage.getItem(DASHBOARD_SOS_PENDING_KEY)).toBe('Hilfe')
    expect(consumeDashboardSosPending()).toBe('Hilfe')
    expect(consumeDashboardSosPending()).toBeNull()
  })
})

describe('DashboardSosEmergencyButton', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('speichert Text aus SOS-Sheet und öffnet Nachrichten', () => {
    const onOpenMessages = vi.fn()
    render(<DashboardSosEmergencyButton onOpenMessages={onOpenMessages} />)
    fireEvent.click(screen.getByRole('button', { name: /SOS — Hilferuf/i }))
    const textarea = screen.getByLabelText(/Was ist passiert/i)
    fireEvent.change(textarea, { target: { value: 'Brand im Gebäude' } })
    fireEvent.click(screen.getByRole('button', { name: /^SOS senden$/i }))
    expect(onOpenMessages).toHaveBeenCalledTimes(1)
    expect(consumeDashboardSosPending()).toContain('Brand im Gebäude')
  })
})
