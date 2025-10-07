import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LineChart } from '../LineChart'

describe('LineChart', () => {
  it('renders a fallback message when no data is provided', () => {
    render(<LineChart title="RSI" labels={[]} />)

    expect(
      screen.getByText('No data available for this selection.'),
    ).toBeInTheDocument()
  })

  it('shows the current value badge for a single data series', () => {
    render(
      <LineChart title="RSI" labels={['A', 'B', 'C']} data={[null, 123.456, 100]} />,
    )

    expect(screen.getByText('Current 100.0')).toBeInTheDocument()
  })

  it('allows collapsing and expanding the chart panel', async () => {
    const user = userEvent.setup()

    const { container } = render(
      <LineChart title="RSI" labels={['A', 'B', 'C']} data={[0, 1, 2, 3]} />,
    )

    const toggleButton = screen.getByRole('button', { name: /collapse/i })

    expect(container.querySelector('svg')).not.toBeNull()

    await user.click(toggleButton)

    expect(toggleButton).toHaveTextContent('Expand')
    expect(container.querySelector('svg')).toBeNull()

    await user.click(toggleButton)

    expect(toggleButton).toHaveTextContent('Collapse')
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders loading feedback when new data is requested', () => {
    render(
      <LineChart
        title="RSI"
        labels={['A', 'B', 'C']}
        data={[0, 1, 2]}
        isLoading
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Reloading chart data…')
  })

  it('renders guideline labels and multi-series summaries', () => {
    render(
      <LineChart
        title="MACD"
        labels={['Jan', 'Feb', 'Mar']}
        series={[
          { name: 'MACD', data: [1, 2, 3], color: '#fff' },
          { name: 'Signal', data: [1, null, 2], color: '#0ff' },
        ]}
        guideLines={[{ value: 2, label: 'Neutral zone', color: '#888' }]}
      />,
    )

    expect(screen.getByText('Neutral zone')).toBeInTheDocument()

    const macdBadge = screen.getByText('MACD', { selector: 'span' })
    const signalBadge = screen.getByText('Signal', { selector: 'span' })

    expect(macdBadge).toBeInTheDocument()
    expect(signalBadge).toBeInTheDocument()
  })
})
