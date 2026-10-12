import { expect, test, type Page } from '@playwright/test'

async function installStubs(
  page: Page,
  options: {
    createDelayMs?: number
    includePreviewPlan?: boolean
  } = {}
) {
  const questCreateRequests: Array<Record<string, unknown>> = []
  const createDelayMs = options.createDelayMs ?? 5000
  const previewPlan = options.includePreviewPlan
    ? {
        summary: 'SetupAgent 已经整理出一版启动预览。',
        markdown: '## 启动规划\\n\\n- 第一步\\n- 第二步',
      }
    : undefined
  page.on('pageerror', (error) => {
    throw error
  })

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'ds:onboarding:v1',
      JSON.stringify({ firstRunHandled: true, completed: true, neverRemind: true, language: 'zh' })
    )
    window.localStorage.setItem('ds:ui-language', 'zh')
    ;(window as typeof window & { __DEEPSCIENTIST_RUNTIME__?: unknown }).__DEEPSCIENTIST_RUNTIME__ = {
      auth: { enabled: false, tokenQueryParam: 'token', storageKey: 'ds_local_auth_token' },
    }
  })

  await Promise.all([
    page.route('**/api/connectors/availability', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        has_enabled_external_connector: false,
        has_bound_external_connector: false,
        should_recommend_binding: false,
        preferred_connector_name: null,
        preferred_conversation_id: null,
        available_connectors: [],
      }) })
    }),
    page.route('**/api/system/update', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true,
        current_version: '1.0.0',
        latest_version: '1.0.0',
        update_available: false,
        prompt_recommended: false,
        busy: false,
      }) })
    }),
    page.route('**/api/auth/token', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: null }) })
    }),
    page.route('**/api/quest-id/next', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quest_id: '931' }) })
    }),
    page.route('**/api/connectors', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }),
    page.route('**/api/baselines', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }),
    page.route('**/api/quests', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, quests: [] }) })
        return
      }
      questCreateRequests.push(route.request().postDataJSON() as Record<string, unknown>)
      await new Promise((resolve) => setTimeout(resolve, createDelayMs))
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true,
        snapshot: {
          quest_id: 'B-931',
          title: 'SetupAgent · slow setup',
          status: 'idle',
          workspace_mode: 'copilot',
          active_anchor: 'decision',
          continuation_policy: 'wait_for_user_or_resume',
          startup_contract: { start_setup_session: { suggested_form: {}, ...(previewPlan ? { preview_plan: previewPlan } : {}) } },
          counts: { bash_running_count: 0 },
        },
      }) })
    }),
    page.route('**/api/quests/B-931/session', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true,
        quest_id: 'B-931',
        snapshot: {
          quest_id: 'B-931',
          title: 'SetupAgent · slow setup',
          status: 'idle',
          workspace_mode: 'copilot',
          continuation_policy: 'wait_for_user_or_resume',
          startup_contract: { start_setup_session: { suggested_form: {}, ...(previewPlan ? { preview_plan: previewPlan } : {}) } },
          counts: { bash_running_count: 0 },
        },
        acp_session: { session_id: 'quest:B-931', slash_commands: [], meta: { default_reply_interaction_id: null } },
      }) })
    }),
    page.route('**/api/quests/B-931/events**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cursor: 0, acp_updates: [], has_more: false }) })
    }),
    page.route('**/api/quests/B-931/chat', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, message: { delivery_state: 'sent', attachments: [] } }) })
    }),
  ])

  return { questCreateRequests }
}

test('Start Research intake immediately switches to autonomous form while SetupAgent quest is created in background', async ({ page }) => {
  const stubs = await installStubs(page)
  await page.goto('/')
  await expect(page.locator('[data-onboarding-id="landing-hero"]')).toBeVisible({ timeout: 30_000 })
  await page.locator('[data-onboarding-id="landing-start-research"]').click()

  await expect(page.getByText('你想研究什么？')).toBeVisible({ timeout: 20_000 })
  await page.locator('[data-copilot-textarea="true"]').fill('我想做一个 vLLM benchmark 优化任务。')
  await page.getByRole('button', { name: /交给 SetupAgent/ }).click()

  await expect(page.locator('[data-onboarding-id="start-research-dialog"]')).toBeVisible({ timeout: 1000 })
  await expect(page.getByText('收到啦，正在认真规划')).toBeVisible({ timeout: 1000 })
  await expect(page.getByText('你想研究什么？')).toHaveCount(0, { timeout: 1000 })
  await expect(page.locator('[data-onboarding-id="start-research-planning-preview"]')).toHaveCount(0)
  await expect.poll(() => stubs.questCreateRequests.length, { timeout: 7000 }).toBe(1)
  expect(stubs.questCreateRequests[0]).toMatchObject({
    auto_start: true,
    initial_message: '我想做一个 vLLM benchmark 优化任务。',
  })
})

test('Planning preview appears only after SetupAgent writes preview_plan back through MCP', async ({ page }) => {
  await installStubs(page, { createDelayMs: 0, includePreviewPlan: true })
  await page.goto('/')
  await expect(page.locator('[data-onboarding-id="landing-hero"]')).toBeVisible({ timeout: 30_000 })
  await page.locator('[data-onboarding-id="landing-start-research"]').click()

  await expect(page.getByText('你想研究什么？')).toBeVisible({ timeout: 20_000 })
  await page.locator('[data-copilot-textarea="true"]').fill('请先帮我整理一个启动计划。')
  await page.getByRole('button', { name: /交给 SetupAgent/ }).click()

  const planningPreview = page.locator('[data-onboarding-id="start-research-planning-preview"]')
  await expect(planningPreview).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('heading', { name: '启动规划' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('第一步')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('第二步')).toBeVisible({ timeout: 20_000 })
  await expect
    .poll(async () => (await planningPreview.textContent()) || '', { timeout: 20_000 })
    .not.toContain('\\n')
})

test('Planning preview can return to pure SetupAgent conversation', async ({ page }) => {
  await installStubs(page, { createDelayMs: 0, includePreviewPlan: true })
  await page.goto('/')
  await expect(page.locator('[data-onboarding-id="landing-hero"]')).toBeVisible({ timeout: 30_000 })
  await page.locator('[data-onboarding-id="landing-start-research"]').click()

  await expect(page.getByText('你想研究什么？')).toBeVisible({ timeout: 20_000 })
  await page.locator('[data-copilot-textarea="true"]').fill('请先生成一个启动规划。')
  await page.getByRole('button', { name: /交给 SetupAgent/ }).click()

  const planningPreview = page.locator('[data-onboarding-id="start-research-planning-preview"]')
  await expect(planningPreview).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: '继续询问 SetupAgent' }).click()
  await expect(planningPreview).toHaveCount(0)
  await expect(page.locator('[data-onboarding-id="start-research-assistant-surface"]')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('SetupAgent')).toBeVisible({ timeout: 20_000 })
})
