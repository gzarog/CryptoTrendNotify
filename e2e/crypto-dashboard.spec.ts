import { expect, test } from '@playwright/test'

type CandleTuple = [string, string, string, string, string, string, string]

function buildCandleSeries(limit: number, intervalMinutes: number): CandleTuple[] {
  const now = Date.now()
  const intervalMs = intervalMinutes * 60_000
  const startTime = Math.floor(now / intervalMs) * intervalMs

  return Array.from({ length: limit }, (_, index) => {
    const timestamp = startTime - index * intervalMs
    const open = 100 + index * 0.5
    const close = open + Math.sin(index / 3) * 2
    const high = Math.max(open, close) + 0.5
    const low = Math.min(open, close) - 0.5
    const volume = 1000 + index * 10
    const turnover = 500 + index * 5

    return [
      String(timestamp),
      open.toFixed(2),
      high.toFixed(2),
      low.toFixed(2),
      close.toFixed(2),
      volume.toFixed(2),
      turnover.toFixed(2),
    ]
  })
}

test.describe('Crypto momentum dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://api.bybit.com/v5/market/kline**', async (route) => {
      const url = new URL(route.request().url())
      const limit = Number.parseInt(url.searchParams.get('limit') ?? '200', 10)
      const interval = Number.parseInt(url.searchParams.get('interval') ?? '1', 10)
      const candles = buildCandleSeries(limit, interval)

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          retCode: 0,
          retMsg: 'OK',
          result: {
            list: candles,
          },
        }),
      })
    })
  })

  test('allows configuring the market view', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1, name: 'Crypto momentum dashboard' })).toBeVisible()

    const symbolSelect = page.getByLabel('Crypto')
    await expect(symbolSelect).toHaveValue('DOGEUSDT')
    await symbolSelect.selectOption('BTCUSDT')
    await expect(symbolSelect).toHaveValue('BTCUSDT')

    const timeframeSelect = page.getByLabel('Timeframe')
    await timeframeSelect.selectOption('120')
    await expect(timeframeSelect).toHaveValue('120')

    const marketSummaryHeading = page.getByRole('heading', { level: 2, name: 'Market snapshot' })
    const marketSummaryToggle = marketSummaryHeading.locator('..').locator('..').getByRole('button')
    await expect(marketSummaryHeading).toBeVisible()
    await marketSummaryToggle.click()
    await expect(marketSummaryToggle).toHaveText(/Expand/)

    await expect(page.getByRole('button', { name: /Refresh now/i })).toBeEnabled()
  })
})
