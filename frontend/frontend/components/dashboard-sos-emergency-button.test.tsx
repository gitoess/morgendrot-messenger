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
    vi.spyOn(window, 'prompt').mockReturnValue('Brand im Gebäude')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('speichert Text und öffnet Nachrichten', () => {
    const onOpenMessages = vi.fn()
    render(<DashboardSosEmergencyButton onOpenMessages={onOpenMessages} />)
    fireEvent.click(screen.getByRole('button', { name: /SOS — Hilferuf/i }))
    expect(onOpenMessages).toHaveBeenCalledTimes(1)
    expect(consumeDashboardSosPending()).toBe('Brand im Gebäude')
  })
})
