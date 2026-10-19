import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'

function BackControl() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>History back</button>
}
function setup() {
  render(<MemoryRouter><Routes><Route element={<Layout />}>
    <Route index element={<p>Home content</p>} />
    <Route path="about" element={<BackControl />} />
  </Route></Routes></MemoryRouter>)
  return userEvent.setup()
}

describe('mobile navigation disclosure', () => {
  it('opens by keyboard, closes with Escape, and restores toggle focus', async () => {
    const user = setup()
    const toggle = screen.getByRole('button', { name: 'Open navigation' })
    toggle.focus(); await user.keyboard('{Enter}')
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()
    await user.tab()
    expect(within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('link', { name: 'Home' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(toggle).toHaveFocus()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
  })
  it('handles Escape while focus is still on the toggle', async () => {
    const user = setup()
    const toggle = screen.getByRole('button', { name: 'Open navigation' })
    await user.click(toggle); await user.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
  it('does not resurrect an open menu after route navigation and browser Back', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    // Navigate outside the disclosure: route changes must still close it.
    await user.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'About' }))
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'History back' }))
    expect(screen.getByText('Home content')).toBeVisible()
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
  })
})
