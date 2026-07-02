/**
 * Boss bei 0 — vollständiger Wizard-Durchlauf (frischer Kontext ≈ Inkognito).
 *
 * UI_BASE_URL=http://127.0.0.1:3341 npx playwright test e2e/boss-onboarding-live.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  BOSS_WIZARD_STEP_TITLES,
  clearMorgendrotStorage,
  installBossStatusMock,
  startBossWizardFresh,
  vaultUnlockDialog,
  wizardDialog,
} from './helpers/boss-onboarding-fixtures'

const OUT_DIR = path.join(process.cwd(), 'e2e', '.boss-live-review')

const EXPECTED_STEP_TITLES = BOSS_WIZARD_STEP_TITLES

const OPTIONAL_STEPS = new Set(['Telegram', 'Funk'])

type StepCapture = {
  index: number
  title: string
  hint: string
  progress: string
  bodyChars: number
  bodyPreview: string
  feedbackText: string
  statusLines: string[]
}

type FlowReview = {
  startedAt: string
  vaultBlocking: boolean
  stepTitles: string[]
  steps: StepCapture[]
  deployFeedback: string | null
  maxBodyChars: number
  optionalSkips: number
  reachedDone: boolean
  flowNotes: string[]
  flowAssessment: {
    feelsGuided: string
    feelsLong: string
    feedbackGaps: string[]
    strengths: string[]
  }
}

async function captureWizardStep(page: Page, index: number): Promise<StepCapture> {
  const dialog = wizardDialog(page)
  await expect(dialog).toBeVisible({ timeout: 8000 })

  const snap = await dialog.evaluate((el) => {
    const h3 = el.querySelector('h3')
    const title = h3?.textContent?.trim() ?? ''
    const hint = (h3?.nextElementSibling?.textContent ?? '').trim()
    const progressEl = [...el.querySelectorAll('span')].find((s) => /^Schritt \d+ von \d+$/.test((s.textContent ?? '').trim()))
    const progress = (progressEl?.textContent ?? '').trim()
    const panel = h3?.parentElement?.nextElementSibling
    const bodyText = (panel?.textContent ?? '').replace(/\s+/g, ' ').trim()
    const feedbackEl = panel?.querySelector('p.text-xs.text-muted-foreground, p.text-xs.text-destructive:last-of-type')
    const feedbackText = (feedbackEl?.textContent ?? '').trim()
    const statusLines = [...(panel?.querySelectorAll('.flex.items-center.gap-2.text-sm') ?? [])].map((row) =>
      (row.textContent ?? '').replace(/\s+/g, ' ').trim()
    )
    return { title, hint, progress, bodyText, feedbackText, statusLines }
  })

  await dialog
    .screenshot({
      path: path.join(
        OUT_DIR,
        `step-${String(index).padStart(2, '0')}-${snap.title.replace(/[^\wäöüÄÖÜß]+/gi, '-').slice(0, 24)}.png`
      ),
    })
    .catch(() => undefined)

  return {
    index,
    title: snap.title,
    hint: snap.hint,
    progress: snap.progress,
    bodyChars: snap.bodyText.length,
    bodyPreview: snap.bodyText.slice(0, 360),
    feedbackText: snap.feedbackText,
    statusLines: snap.statusLines.filter(Boolean),
  }
}

async function wizardNav(page: Page, action: 'weiter' | 'skip') {
  const dialog = wizardDialog(page)
  await dialog.getByRole('button', { name: action === 'skip' ? 'Überspringen' : 'Weiter' }).click()
}

function buildFlowAssessment(review: FlowReview): FlowReview['flowAssessment'] {
  const gaps: string[] = []
  const strengths: string[] = []

  if (review.vaultBlocking) {
    gaps.push(
      'Hinweis: Beim echten Erststart erscheint kurz der Tresor — er wird unterdrückt, solange der Wizard offen ist.'
    )
  }
  if (!review.deployFeedback) {
    gaps.push('Deploy: kein Inline-Feedback sichtbar (Button evtl. deaktiviert oder Backend gesperrt).')
  } else if (review.deployFeedback.includes('Backend')) {
    gaps.push('Deploy-Feedback eher technisch („Backend/Basis-URL“) statt Nutzer-Aktion.')
  } else {
    strengths.push('Deploy-Schritt zeigt Statuszeilen + Feedback-Zeile.')
  }

  if ((review.steps.find((s) => s.title === 'Postfächer')?.bodyChars ?? 999) < 200) {
    strengths.push('Postfächer kompakt mit Statuszeilen.')
  }
  const done = review.steps.find((s) => s.title === 'Fertig')
  if (done?.bodyPreview.includes('Helfer einrichten')) {
    strengths.push('Fertig-Schritt verweist auf Helfer-Provisionierung außerhalb des Wizards.')
  }
  const funk = review.steps.find((s) => s.title === 'Funk')
  if (funk?.statusLines.some((l) => l.includes('optional'))) {
    gaps.push('Funk-Status enthält noch „optional“ — prüfen.')
  }

  return {
    feelsGuided:
      'Titel + einzeiliger Hint + Fortschrittsbalken + Primäraktion pro Schritt — wirkt geführt, nicht wie Settings-Dump.',
    feelsLong:
      review.maxBodyChars > 250
        ? '5 Pflichtschritte + 2 optionale; Messenger-Contract mit klarem Testnet-Hinweis.'
        : '8 Schritte: Netzwerk-Wahl am Anfang; optional Telegram/Funk per Skip; Helfer außerhalb.',
    feedbackGaps: gaps,
    strengths,
  }
}

test.describe('Boss bei 0 — vollständiger Flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('Schritte 1–8: Flow, Kompaktheit, Feedback', async ({ page }) => {
    test.setTimeout(90_000)
    fs.mkdirSync(OUT_DIR, { recursive: true })

    await clearMorgendrotStorage(page)

    const review: FlowReview = {
      startedAt: new Date().toISOString(),
      vaultBlocking: false,
      stepTitles: [],
      steps: [],
      deployFeedback: null,
      maxBodyChars: 0,
      optionalSkips: 0,
      reachedDone: false,
      flowNotes: [],
      flowAssessment: { feelsGuided: '', feelsLong: '', feedbackGaps: [], strengths: [] },
    }

    await installBossStatusMock(page, 'greenfield')
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await expect(page.locator('header h1')).toHaveText(/Morgendrot/, { timeout: 15000 })

    review.vaultBlocking = await vaultUnlockDialog(page)
      .isVisible({ timeout: 2000 })
      .catch(() => false)

    await startBossWizardFresh(page)
    await expect(vaultUnlockDialog(page)).toBeHidden({ timeout: 15000 })
    await expect(wizardDialog(page)).toBeVisible({ timeout: 10000 })

    for (let i = 0; i < EXPECTED_STEP_TITLES.length; i++) {
      const cap = await captureWizardStep(page, i + 1)
      review.steps.push(cap)
      review.stepTitles.push(cap.title)
      review.maxBodyChars = Math.max(review.maxBodyChars, cap.bodyChars)

      expect(cap.title).toBe(EXPECTED_STEP_TITLES[i])
      expect(cap.hint.length).toBeGreaterThan(8)
      expect(cap.progress).toMatch(new RegExp(`Schritt ${i + 1} von 8`))

      if (cap.title === 'Chain anbinden' && cap.feedbackText) {
        review.deployFeedback = cap.feedbackText
      }

      if (cap.title === 'Fertig') {
        review.reachedDone = true
        break
      }

      if (OPTIONAL_STEPS.has(cap.title)) {
        review.optionalSkips++
        await wizardNav(page, 'skip')
      } else {
        await wizardNav(page, 'weiter')
      }

      const next = EXPECTED_STEP_TITLES[i + 1]
      if (next) {
        await expect(wizardDialog(page).locator('h3').first()).toHaveText(next, { timeout: 10000 })
      }
    }

    review.flowAssessment = buildFlowAssessment(review)
    review.flowNotes.push(
      review.vaultBlocking
        ? 'Echter Erststart: Tresor blockiert (nicht schließbar) — Test nutzt Status-Mock'
        : 'Kein Tresor beim Teststart'
    )

    fs.writeFileSync(path.join(OUT_DIR, 'review.json'), JSON.stringify(review, null, 2), 'utf8')

    for (const s of review.steps.filter((x) => !OPTIONAL_STEPS.has(x.title) && x.title !== 'Fertig')) {
      expect(s.bodyChars, `${s.title} zu lang`).toBeLessThan(500)
    }
    expect(review.steps.find((s) => s.title === 'Telegram')?.bodyChars ?? 999).toBeLessThan(450)
    expect(review.steps.find((s) => s.title === 'Funk')?.bodyChars ?? 999).toBeLessThan(400)
    expect(review.reachedDone).toBe(true)
    expect(review.optionalSkips).toBe(2)
    expect(review.stepTitles).toEqual([...EXPECTED_STEP_TITLES])
  })
})
