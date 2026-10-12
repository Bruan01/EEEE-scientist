import { expect, test, type Page } from '@playwright/test'

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:20999'

function appUrl(path: string) {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

async function installLandingStubs(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'ds:onboarding:v1',
      JSON.stringify({ firstRunHandled: true, completed: true, neverRemind: true, language: 'en' })
    )
    window.localStorage.setItem('ds:ui-language', 'en')
    ;(window as typeof window & { __DEEPSCIENTIST_RUNTIME__?: unknown }).__DEEPSCIENTIST_RUNTIME__ = {
      auth: { enabled: false, tokenQueryParam: 'token', storageKey: 'ds_local_auth_token' },
    }
  })
  await page.route('**/api/auth/token', async (route) => route.fulfill({ json: { token: null } }))
  await page.route('**/api/quests', async (route) => route.fulfill({ json: [] }))
  await page.route('**/api/connectors/availability', async (route) =>
    route.fulfill({
      json: {
        has_enabled_external_connector: false,
        has_bound_external_connector: false,
        should_recommend_binding: false,
        preferred_connector_name: null,
        preferred_conversation_id: null,
        available_connectors: [],
      },
    })
  )
  await page.route('**/api/system/update', async (route) =>
    route.fulfill({
      json: {
        ok: true,
        current_version: '1.6.0',
        latest_version: '1.6.0',
        update_available: false,
        prompt_recommended: false,
        busy: false,
      },
    })
  )
}

test('landing onboarding leads to the Start Research intake', async ({ page }) => {
  await installLandingStubs(page)
  await page.goto(appUrl('/'))
  await expect(page.locator('[data-onboarding-id="landing-hero"]')).toBeVisible()
  await page.locator('[data-onboarding-id="landing-replay-tutorial"]').click()

  await expect(page.getByRole('heading', { name: 'This is the launch surface' })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('heading', { name: 'These are the two main entry paths' })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('heading', { name: 'Open the Start Research intake' })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.locator('[data-onboarding-id="start-research-intake"]')).toBeVisible()
})
