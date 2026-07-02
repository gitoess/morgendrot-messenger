/**
 * Tresor ↔ Wizard: Unterdrückung und erneutes Öffnen.
 *
 * UI_BASE_URL=http://127.0.0.1:3341 npx playwright test e2e/boss-vault-wizard.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test'
import {
  clearMorgendrotStorage,
  installBossStatusMock,
  startBossWizardFresh,
  vaultUnlockDialog,
  wizardDialog,
} from './helpers/boss-onboarding-fixtures'

test.describe('Tresor und Boss-Wizard', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page }) => {
    await clearMorgendrotStorage(page)
    await installBossStatusMock(page, 'locked')
  })

  test('Tresor zuerst; Setup-Link öffnet Wizard', async ({ page }) => {
    test.setTimeout(60_000)
    await installBossStatusMock(page, 'locked')

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await expect(vaultUnlockDialog(page)).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByRole('button', { name: /oder Einsatzleitung einrichten/i })
    ).toBeVisible()

    await page.getByRole('button', { name: /oder Einsatzleitung einrichten/i }).click()
    await expect(wizardDialog(page)).toBeVisible({ timeout: 10000 })
    await expect(vaultUnlockDialog(page)).toBeHidden({ timeout: 5000 })
  })

  test('Wallet einrichten → Zurück zur Einrichtung', async ({ page }) => {
    test.setTimeout(60_000)

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await startBossWizardFresh(page)

    await wizardDialog(page).getByRole('button', { name: 'Wallet einrichten' }).click()
    await expect(vaultUnlockDialog(page)).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /Zurück zur Einrichtung/i })).toBeVisible()

    await page.getByRole('button', { name: /Zurück zur Einrichtung/i }).click()
    await expect(wizardDialog(page)).toBeVisible({ timeout: 8000 })
    await expect(vaultUnlockDialog(page)).toBeHidden({ timeout: 5000 })
  })

  test('Wizard offen → Tresor unterdrückt; Wallet einrichten → Tresor sichtbar', async ({ page }) => {
    test.setTimeout(60_000)

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await expect(page.locator('header h1')).toHaveText(/Morgendrot/, { timeout: 20000 })

    await startBossWizardFresh(page)
    await expect(vaultUnlockDialog(page)).toBeHidden({ timeout: 5000 })

    await wizardDialog(page).getByRole('button', { name: 'Wallet einrichten' }).click()
    await expect(vaultUnlockDialog(page)).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /Zurück zur Einrichtung/i })).toBeVisible()
    await expect(vaultUnlockDialog(page).getByPlaceholder('Passwort')).toBeVisible()
  })

  test('Später → kein Tresor-Zwang', async ({ page }) => {
    test.setTimeout(60_000)

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await startBossWizardFresh(page)
    await expect(vaultUnlockDialog(page)).toBeHidden({ timeout: 5000 })

    await wizardDialog(page).getByRole('button', { name: 'Später' }).click()
    await expect(wizardDialog(page)).toBeHidden({ timeout: 8000 })
    await expect(vaultUnlockDialog(page)).toBeHidden({ timeout: 3000 })
  })

  test('Durchklicken bis Fertig ohne Eingaben → Tresor erscheint', async ({ page }) => {
    test.setTimeout(60_000)

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await startBossWizardFresh(page)
    await expect(wizardDialog(page)).toBeVisible({ timeout: 10000 })

    const titles = ['Wallet', 'Einsatz-Regeln', 'Chain anbinden', 'Postfächer', 'Telegram', 'Funk']
    for (const _title of titles) {
      const skip = wizardDialog(page).getByRole('button', { name: 'Überspringen' })
      const weiter = wizardDialog(page).getByRole('button', { name: 'Weiter' })
      if (await skip.isVisible().catch(() => false)) {
        await skip.click()
      } else {
        await weiter.click()
      }
      await page.waitForTimeout(150)
    }

    await expect(wizardDialog(page).locator('h3').first()).toHaveText('Fertig', { timeout: 8000 })
    await wizardDialog(page).getByRole('button', { name: 'Fertig' }).click()
    await expect(wizardDialog(page)).toBeHidden({ timeout: 8000 })
    await expect(vaultUnlockDialog(page)).toBeVisible({ timeout: 8000 })
  })

  test('Tresor-Badge klicken bei offenem Wizard → Tresor sichtbar', async ({ page }) => {
    test.setTimeout(60_000)

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await startBossWizardFresh(page)
    await expect(wizardDialog(page)).toBeVisible({ timeout: 10000 })

    const badge = page.locator('button[aria-label="Tresor entsperren"]')
    await badge.click({ force: true })
    await expect(wizardDialog(page)).toBeHidden({ timeout: 8000 })
    await expect(vaultUnlockDialog(page)).toBeVisible({ timeout: 8000 })
  })
})
