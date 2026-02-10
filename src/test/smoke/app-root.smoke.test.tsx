import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '@/app/App'

describe('App root bootstrap', () => {
  it('renders the app shell', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /greek 360/i })).toBeInTheDocument()
  })
})
