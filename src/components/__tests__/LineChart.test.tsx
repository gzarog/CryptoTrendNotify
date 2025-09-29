import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LineChart } from '../LineChart'

describe('LineChart', () => {
  it('displays the latest value badge for a single series', () => {
    render(
      <LineChart
        title="RSI"
        labels={['A', 'B', 'C']}
        data={[45.1, 47.25, 50.32]}
      />,
    )

    expect(screen.getByText(/Current 50\.32/)).toBeInTheDocument()
  })

  it('renders a friendly fallback when data is missing', () => {
    render(
      <LineChart
        title="RSI"
        labels={['A', 'B', 'C']}
        data={[null, null, null]}
      />,
    )

    expect(screen.getByText('No data available for this selection.')).toBeVisible()
  })

  it('allows collapsing and expanding the chart area', async () => {
    const user = userEvent.setup()

    render(
      <LineChart
        title="Momentum"
        labels={['A', 'B', 'C', 'D']}
        data={[30, 40, 50, 60]}
      />,
    )

    const toggle = screen.getByRole('button', { name: /Collapse/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.querySelectorAll('svg')).toHaveLength(1)

    await user.click(toggle)

    expect(toggle).toHaveTextContent('Expand')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.querySelectorAll('svg')).toHaveLength(0)
  })
})
