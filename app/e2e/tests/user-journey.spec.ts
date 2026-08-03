import { test, expect } from '@playwright/test'

// サインアップ → 映画登録（本物のTMDB API）→ レビュー作成 → 一覧表示、という
// mymovieの中核的なユーザージャーニーを実ブラウザ操作で通しで検証する。
test('サインアップして映画を登録しレビューが一覧に表示される', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`
  const password = 'password123'

  await page.goto('/signup')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').nth(0).fill(password)
  await page.locator('input[type="password"]').nth(1).fill(password)
  await page.getByRole('button', { name: '登録する' }).click()

  await expect(page).toHaveURL('/')

  await page.getByRole('link', { name: '+ 映画を登録' }).click()
  await expect(page).toHaveURL('/movies/register')

  await page.getByPlaceholder('映画タイトルを入力...').fill('Matrix')
  const firstResult = page.locator('ul li').first()
  await expect(firstResult).toBeVisible({ timeout: 10_000 })
  const movieTitle = await firstResult.locator('p.font-medium').textContent()
  await firstResult.click()

  await page.getByPlaceholder('スコアを入力（0.0〜5.0）').fill('4.5')
  await page.getByRole('button', { name: '登録する' }).click()

  await expect(page).toHaveURL('/', { timeout: 10_000 })
  await expect(page.getByText(movieTitle!, { exact: true })).toBeVisible()
})
