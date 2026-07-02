/**
 * Boss bei 0 — Greenfield + Dev-Server (Browser ohne Session-Signer).
 *
 * UI_BASE_URL=http://127.0.0.1:3341 npx playwright test e2e/boss-onboarding-greenfield.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test'
import {
  advanceWizardToDone,
  clearMorgendrotStorage,
  clickWizardFertig,
  installBossStatusMock,
  sessionSignerSyncDialog,
  startBossWizardFresh,
  vaultUnlockDialog,
  wizardDialog,
} from './helpers/boss-onboarding-fixtures'

test.describe('Boss bei 0 — Greenfield', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page }) => {
    await clearMorgendrotStorage(page)
  })

  test('Greenfield: Wallet einrichten, Badge, Tresor nach Fertig', async ({ page }) => {
    test.setTimeout(60_000)
    await installBossStatusMock(page, 'greenfield')

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await expect(page.locator('header h1')).toHaveText(/Morgendrot/, { timeout: 15000 })

    await startBossWizardFresh(page)
    await expect(vaultUnlockDialog(page)).toBeHidden({ timeout: 5000 })

    await expect(page.getByText(/Tresor:/)).toBeVisible({ timeout: 5000 })

    await expect(wizardDialog(page).locator('h3').first()).toHaveText('Wallet')
    await expect(wizardDialog(page).getByText('Wallet fehlt')).toBeVisible()
    await expect(wizardDialog(page).getByRole('button', { name: 'Wallet einrichten' })).toBeVisible()

    await advanceWizardToDone(page)
    await clickWizardFertig(page)
    await expect(vaultUnlockDialog(page)).toBeVisible({ timeout: 8000 })
  })

  test('Dev-Server: Tresor entsperren, Session-Signer nach Fertig', async ({ page }) => {
    test.setTimeout(60_000)
    await installBossStatusMock(page, 'server-ready')

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await startBossWizardFresh(page)
    await expect(wizardDialog(page)).toBeVisible({ timeout: 10000 })

    await expect(wizardDialog(page).getByText(/Browser noch nicht entsperrt/i)).toBeVisible()
    await expect(wizardDialog(page).getByRole('button', { name: 'Tresor entsperren' })).toBeVisible()

    await advanceWizardToDone(page)
    await clickWizardFertig(page)
    await expect(sessionSignerSyncDialog(page)).toBeVisible({ timeout: 8000 })
  })
})
