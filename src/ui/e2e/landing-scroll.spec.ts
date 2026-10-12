import { expect, test } from '@playwright/test'

test.describe('landing page scroll', () => {
  test('allows scrolling the landing page without trapping the first wheel gesture', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'ds:onboarding:v1',
        JSON.stringify({
          firstRunHandled: true,
          completed: true,
          neverRemind: true,
          language: 'en',
        })
      )
    })

    await page.route('**/api/connectors/availability', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          has_enabled_external_connector: false,
          has_bound_external_connector: false,
          should_recommend_binding: false,
          preferred_connector_name: null,
          preferred_conversation_id: null,
          available_connectors: [],
        }),
      })
    })

    await page.route('**/api/system/update', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          current_version: '1.0.0',
          latest_version: '1.0.0',
          update_available: false,
          busy: false,
          manual_update_command: 'npm install -g @researai/deepscientist@latest',
        }),
      })
    })

    await page.goto('/')
    await expect(page.locator('[data-onboarding-id="landing-hero"]')).toBeVisible({ timeout: 30_000 })

    const readProgressPercent = () =>
      page.evaluate(() => {
        const style = Array.from(document.querySelectorAll('div'))
          .map((element) => element.getAttribute('style') || '')
          .find((value) => /^width:\s*\d+%/.test(value.trim()))
        if (!style) {
          return -1
        }
        const match = style.match(/width:\s*(\d+)%/)
        return match ? Number(match[1]) : -1
      })

    await expect.poll(readProgressPercent).toBe(0)

    await page.mouse.wheel(0, 1400)

    await expect
      .poll(() =>
        page.evaluate(() =>
          Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop)
        )
      )
      .toBeGreaterThan(0)

    await expect.poll(readProgressPercent).toBeGreaterThan(0)
  })
})
