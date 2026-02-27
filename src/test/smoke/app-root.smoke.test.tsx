import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '@/app/App'

describe('App root bootstrap', () => {
  it('routes root users into sign-in flow', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })
})
