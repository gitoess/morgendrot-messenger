import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardRolePill } from '@/frontend/components/dashboard-role-pill'

describe('DashboardRolePill', () => {
  it('zeigt Messenger bei ROLE=messenger (auch ohne Edition-Build)', () => {
    render(<DashboardRolePill role="messenger" />)
    expect(screen.getByText('Messenger')).toBeInTheDocument()
  })

  it('zeigt Boss bei ROLE=boss im Morgendrot-Default', () => {
    render(<DashboardRolePill role="boss" />)
    expect(screen.getByText(/Boss/i)).toBeInTheDocument()
  })
})
