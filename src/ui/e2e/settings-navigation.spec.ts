import { expect, test } from '@playwright/test'

test.describe('settings navigation', () => {
  test('switches config sections and connector detail views on the first click', async ({ page }) => {
    await page.goto('/settings')

    await expect(page.getByRole('heading', { level: 1, name: 'Runtime' })).toBeVisible({ timeout: 30_000 })

    const sections = [
      { nav: /^Models/, heading: 'Models', path: '/settings/runners' },
      { nav: /^Connectors/, heading: 'Connectors', path: '/settings/connector' },
      { nav: /^Baselines/, heading: 'Baselines', path: '/settings/baselines' },
      { nav: /^Extensions/, heading: 'Extensions', path: '/settings/plugins' },
      { nav: /^MCP/, heading: 'MCP', path: '/settings/mcp_servers' },
      { nav: /^Runtime/, heading: 'Runtime', path: '/settings/config' },
    ]

    for (const section of sections) {
      await page.getByRole('button', { name: section.nav }).first().click()
      await expect(page).toHaveURL(new RegExp(`${section.path.replace('/', '\\/')}$`))
      await expect(page.locator('section header h1').first()).toHaveText(section.heading)
    }

    await page.getByRole('button', { name: /^Connectors/ }).first().click()
    await expect(page).toHaveURL(/\/settings\/connector$/)

    const connectorCards = page.locator('section').filter({ has: page.getByRole('button', { name: 'Open setup' }) })

    await connectorCards.filter({ hasText: 'QQ' }).getByRole('button', { name: 'Open setup' }).click()
    await expect(page).toHaveURL(/\/settings\/connector\/qq$/)
    await expect(page.getByRole('heading', { level: 2, name: 'QQ' })).toBeVisible()

    await page.getByRole('button', { name: /Back to connectors/i }).click()
    await expect(page).toHaveURL(/\/settings\/connector$/)

    await connectorCards.filter({ hasText: 'Lingzhu' }).getByRole('button', { name: 'Open setup' }).click()
    await expect(page).toHaveURL(/\/settings\/connector\/lingzhu$/)
    await expect(page.getByRole('heading', { level: 2, name: 'Lingzhu' })).toBeVisible()
  })
})
