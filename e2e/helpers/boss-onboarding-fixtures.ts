/**
 * Gemeinsame Fixtures für Boss-Einstiegs-Wizard E2E (Boss bei 0 / Dev-Server).
 */
import { expect, type Page } from '@playwright/test'

/** Frische Installation — keine Keys; Tresor zuerst (Spec §4.4). */
export const BOSS_GREENFIELD_STATUS: Record<string, unknown> = {
  backendRunning: true,
  backendOnline: true,
  connected: false,
  locked: true,
  hasKeys: false,
  role: 'boss',
  myAddress: '',
  myAddressFull: '',
  packageId: '',
  mailboxId: '',
  meshNodeId: '',
  handoffLabel: '',
  rpcUrlLabel: '',
}

/** Dev-Server mit Wallet auf der Basis, Browser-Sitzung noch leer. */
export const BOSS_SERVER_READY_STATUS: Record<string, unknown> = {
  ...BOSS_GREENFIELD_STATUS,
  locked: false,
  hasKeys: true,
  connected: true,
  myAddress: '0xabc1…def2',
  myAddressFull: '0x' + 'a'.repeat(62) + 'bc',
  packageId: '0x' + '1'.repeat(64),
  mailboxId: '0x' + '2'.repeat(64),
  rpcUrlLabel: 'https://api.mainnet.iota.cafe',
}

export type BossStatusMockVariant = 'greenfield' | 'server-ready' | 'locked'

export async function installBossStatusMock(page: Page, variant: BossStatusMockVariant = 'greenfield') {
  const base =
    variant === 'server-ready'
      ? BOSS_SERVER_READY_STATUS
      : variant === 'locked'
        ? { ...BOSS_GREENFIELD_STATUS, locked: true, hasKeys: false }
        : BOSS_GREENFIELD_STATUS

  await page.route('**/api/status**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(base),
    })
  })
}

export function wizardDialog(page: Page) {
  return page.getByRole('dialog', { name: /Einsatzleitung einrichten/i })
}

export function vaultUnlockDialog(page: Page) {
  return page.getByRole('dialog', { name: /Tresor entsperren/i })
}

export function sessionSignerSyncDialog(page: Page) {
  return page.getByRole('dialog', { name: /Session-Signer laden/i })
}

export function readinessDialog(page: Page) {
  return page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: /^Einrichtung prüfen$/ }),
  })
}

/** Readiness öffnet nach Fertig (oft unter dem Tresor-Dialog). */
export async function expectReadinessAfterFertig(page: Page) {
  await page.waitForSelector('text=Einrichtung prüfen', { timeout: 20_000 })
}

export async function clearMorgendrotStorage(page: Page) {
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage).filter((x) => x.startsWith('morgendrot.'))) {
      localStorage.removeItem(k)
    }
  })
}

export async function startBossWizardFresh(page: Page) {
  const setupFromVault = page.getByRole('button', {
    name: /oder (Einsatzleitung einrichten|Messenger einrichten|set up)/i,
  })
  if (await vaultUnlockDialog(page).isVisible({ timeout: 2000 }).catch(() => false)) {
    if (await setupFromVault.isVisible({ timeout: 2000 }).catch(() => false)) {
      await setupFromVault.click()
      await expect(wizardDialog(page)).toBeVisible({ timeout: 10000 })
      return
    }
  }

  const firstStart = page.getByRole('button', { name: /Einsatzleitung.*ich starte den Einsatz/i })
  if (await firstStart.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstStart.click()
    await expect(wizardDialog(page)).toBeVisible({ timeout: 10000 })
    return
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.evaluate(() => {
      localStorage.setItem('morgendrot.standaloneOnboardingPath.v1', 'boss')
      localStorage.setItem(
        'morgendrot.onboardingProgress.v2',
        JSON.stringify({
          path: 'boss',
          currentStepIndex: 0,
          completedSteps: [],
          skippedSteps: [],
          dismissed: false,
        })
      )
      window.dispatchEvent(new CustomEvent('morgendrot.onboardingWizardOpenRequest'))
    })
    if (await wizardDialog(page).isVisible({ timeout: 1500 }).catch(() => false)) return
    await page.waitForTimeout(400)
  }
  await expect(wizardDialog(page)).toBeVisible({ timeout: 8000 })
}

export const BOSS_WIZARD_STEP_TITLES = [
  'Wallet',
  'Wo senden?',
  'Einsatz-Regeln',
  'Chain anbinden',
  'Postfächer',
  'Telegram',
  'Funk',
  'Fertig',
] as const

export async function advanceWizardToDone(page: Page) {
  const optional = new Set(['Telegram', 'Funk'])
  for (const title of BOSS_WIZARD_STEP_TITLES.slice(0, -1)) {
    await expect(wizardDialog(page).locator('h3').first()).toHaveText(title, { timeout: 10000 })
    const dialog = wizardDialog(page)
    if (title === 'Wo senden?') {
      await dialog.getByRole('button', { name: /Beides \(empfohlen\)/i }).click()
      await page.waitForTimeout(100)
    }
    if (optional.has(title)) {
      await dialog.getByRole('button', { name: 'Überspringen' }).click()
    } else {
      await dialog.getByRole('button', { name: 'Weiter' }).click()
    }
    await page.waitForTimeout(100)
  }
  await expect(wizardDialog(page).locator('h3').first()).toHaveText('Fertig', { timeout: 10000 })
}

export async function clickWizardFertig(page: Page) {
  await wizardDialog(page).getByRole('button', { name: 'Fertig' }).click()
  await expect(wizardDialog(page)).toBeHidden({ timeout: 12_000 })
}
