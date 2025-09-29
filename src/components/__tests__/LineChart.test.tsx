import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { LineChart } from '../LineChart'

afterEach(() => {
  cleanup()
})

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

    const { container } = render(
      <LineChart
        title="Momentum"
        labels={['A', 'B', 'C', 'D']}
        data={[30, 40, 50, 60]}
      />,
    )

    const toggle = screen.getByRole('button', { name: /Collapse/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(container.querySelectorAll('svg')).toHaveLength(1)

    await user.click(toggle)

    expect(toggle).toHaveTextContent('Expand')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelectorAll('svg')).toHaveLength(0)
  })

  it('summarizes the latest values for multiple series', () => {
    render(
      <LineChart
        title="Momentum"
        labels={['A', 'B', 'C']}
        series={[
          { name: 'Fast', color: '#ef4444', data: [1, 2, 3] },
          { name: 'Slow', color: '#22c55e', data: [null, 4, 5] },
        ]}
      />,
    )

    expect(screen.getByText('Fast')).toBeVisible()
    expect(screen.getByText('Slow')).toBeVisible()
    expect(screen.getByText('3.00')).toBeInTheDocument()
    expect(screen.getByText('5.00')).toBeInTheDocument()
  })

  it('shows a loading status overlay when re-fetching data', () => {
    const { container } = render(
      <LineChart
        title="RSI"
        labels={['A', 'B']}
        data={[30, 40]}
        isLoading
      />,
    )

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Reloading chart data…')
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })
})
