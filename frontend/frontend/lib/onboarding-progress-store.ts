'use client'

/**
 * § H.36 P0 — linearer Einstiegs-Wizard (Boss / Helfer / Wanderer).
 * @see docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md §4–6, §9
 */
import { hasPersistedDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-mnemonic-session'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { getStandaloneHelperReadiness } from '@/frontend/lib/handoff-standalone-ready'
import { readTelegramInviteFromHandoffExtras } from '@/frontend/lib/handoff-extras'
import {
  isStandaloneSoloPath,
  readStandaloneOnboardingPath,
  type StandaloneOnboardingPath,
} from '@/frontend/lib/standalone-onboarding'
import { isTelegramAlarmGroupWizardDismissed } from '@/frontend/lib/telegram-alarm-group-prefs'

export type OnboardingPath = 'boss' | 'helper' | 'wanderer'

export type BossStepId = 'identity' | 'iota' | 'funk' | 'team' | 'helpers' | 'done'
export type HelperStepId = 'handoff' | 'telegram' | 'wallet' | 'team-self' | 'peering' | 'done'
export type WandererStepId = 'solo-intro' | 'wallet' | 'funk' | 'done'

export type OnboardingStepId = BossStepId | HelperStepId | WandererStepId

export type OnboardingProgress = {
  path: OnboardingPath
  currentStepIndex: number
  completedSteps: OnboardingStepId[]
  skippedSteps: OnboardingStepId[]
  dismissed: boolean
  finishedAtMs?: number
}

export const ONBOARDING_PROGRESS_CHANGED_EVENT = 'morgendrot.onboardingProgressChanged' as const
export const ONBOARDING_WIZARD_OPEN_REQUEST_EVENT = 'morgendrot.onboardingWizardOpenRequest' as const

const LS_KEY = 'morgendrot.onboardingProgress.v1'

export const BOSS_STEP_ORDER: BossStepId[] = ['identity', 'iota', 'funk', 'team', 'helpers', 'done']
export const HELPER_STEP_ORDER: HelperStepId[] = ['handoff', 'telegram', 'wallet', 'team-self', 'peering', 'done']
export const WANDERER_STEP_ORDER: WandererStepId[] = ['solo-intro', 'wallet', 'funk', 'done']

export function stepOrderForPath(path: OnboardingPath): OnboardingStepId[] {
  if (path === 'boss') return BOSS_STEP_ORDER
  if (path === 'helper') return HELPER_STEP_ORDER
  return WANDERER_STEP_ORDER
}

export function resolveOnboardingPath(opts: {
  role?: string | null
  standalonePath?: StandaloneOnboardingPath | null
}): OnboardingPath {
  const standalone = opts.standalonePath ?? readStandaloneOnboardingPath()
  if (standalone === 'solo' || isStandaloneSoloPath()) return 'wanderer'
  const role = (opts.role || '').trim().toLowerCase()
  if (role === 'boss' || role === 'kommandant') return 'boss'
  return 'helper'
}

export function readOnboardingProgress(): OnboardingProgress | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as OnboardingProgress
    if (!o?.path || !Array.isArray(o.completedSteps)) return null
    return o
  } catch {
    return null
  }
}

function writeOnboardingProgress(progress: OnboardingProgress): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(progress))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(ONBOARDING_PROGRESS_CHANGED_EVENT))
}

export function notifyOnboardingProgressChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ONBOARDING_PROGRESS_CHANGED_EVENT))
}

export function startOnboarding(path: OnboardingPath): OnboardingProgress {
  const progress: OnboardingProgress = {
    path,
    currentStepIndex: 0,
    completedSteps: [],
    skippedSteps: [],
    dismissed: false,
  }
  writeOnboardingProgress(progress)
  return progress
}

export function dismissOnboarding(): void {
  const prev = readOnboardingProgress()
  if (!prev) return
  writeOnboardingProgress({ ...prev, dismissed: true })
}

export function finishOnboarding(): void {
  const prev = readOnboardingProgress()
  if (!prev) return
  const order = stepOrderForPath(prev.path)
  writeOnboardingProgress({
    ...prev,
    currentStepIndex: order.length - 1,
    completedSteps: order,
    finishedAtMs: Date.now(),
    dismissed: false,
  })
}

export function markOnboardingStepComplete(stepId: OnboardingStepId): void {
  const prev = readOnboardingProgress()
  if (!prev) return
  const order = stepOrderForPath(prev.path)
  const completed = prev.completedSteps.includes(stepId)
    ? prev.completedSteps
    : [...prev.completedSteps, stepId]
  const idx = order.indexOf(stepId)
  const nextIndex = idx >= 0 ? Math.min(idx + 1, order.length - 1) : prev.currentStepIndex
  writeOnboardingProgress({
    ...prev,
    completedSteps: completed,
    currentStepIndex: nextIndex,
  })
}

export function skipOnboardingStep(stepId: OnboardingStepId): void {
  const prev = readOnboardingProgress()
  if (!prev) return
  const order = stepOrderForPath(prev.path)
  const skipped = prev.skippedSteps.includes(stepId) ? prev.skippedSteps : [...prev.skippedSteps, stepId]
  const idx = order.indexOf(stepId)
  const nextIndex = idx >= 0 ? Math.min(idx + 1, order.length - 1) : prev.currentStepIndex
  writeOnboardingProgress({
    ...prev,
    skippedSteps: skipped,
    currentStepIndex: nextIndex,
  })
}

export function setOnboardingStepIndex(index: number): void {
  const prev = readOnboardingProgress()
  if (!prev) return
  const order = stepOrderForPath(prev.path)
  writeOnboardingProgress({
    ...prev,
    currentStepIndex: Math.max(0, Math.min(index, order.length - 1)),
  })
}

export function requestOpenOnboardingWizard(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ONBOARDING_WIZARD_OPEN_REQUEST_EVENT))
}

export type OnboardingSkipContext = {
  role?: string | null
  hasPackageId?: boolean
  hasMailboxId?: boolean
  hasMeshNodeId?: boolean
  hasTeamId?: boolean
}

export function shouldSkipOnboardingStep(
  path: OnboardingPath,
  stepId: OnboardingStepId,
  ctx: OnboardingSkipContext = {}
): boolean {
  const handoff = readLocalHandoffAppliedSnapshot()
  const readiness = getStandaloneHelperReadiness()
  const hasMnemonic = hasPersistedDirectIotaSessionSigner()

  if (path === 'boss') {
    switch (stepId as BossStepId) {
      case 'identity':
        return Boolean(ctx.role?.trim())
      case 'iota':
        return Boolean(ctx.hasPackageId && ctx.hasMailboxId)
      case 'funk':
        return Boolean(ctx.hasMeshNodeId)
      case 'team':
        return Boolean(ctx.hasTeamId || handoff?.handoffLabel)
      case 'helpers':
        return false
      case 'done':
        return false
      default:
        return false
    }
  }

  if (path === 'helper') {
    switch (stepId as HelperStepId) {
      case 'handoff':
        return readiness.hasHandoff
      case 'telegram': {
        const invite = readTelegramInviteFromHandoffExtras()
        if (!invite) return true
        return isTelegramAlarmGroupWizardDismissed()
      }
      case 'wallet':
        return hasMnemonic || !readiness.needsMnemonic
      case 'team-self':
        return Boolean(handoff?.handoffLabel)
      case 'peering':
        return Boolean(handoff?.bossAddress)
      case 'done':
        return false
      default:
        return false
    }
  }

  switch (stepId as WandererStepId) {
    case 'solo-intro':
      return isStandaloneSoloPath()
    case 'wallet':
      return hasMnemonic
    case 'funk':
      return Boolean(ctx.hasMeshNodeId)
    case 'done':
      return false
    default:
      return false
  }
}

export function getActiveOnboardingStep(
  progress: OnboardingProgress,
  ctx: OnboardingSkipContext = {}
): { stepId: OnboardingStepId; index: number; total: number } {
  const order = stepOrderForPath(progress.path)
  for (let i = progress.currentStepIndex; i < order.length; i++) {
    const stepId = order[i]!
    if (progress.completedSteps.includes(stepId) || progress.skippedSteps.includes(stepId)) continue
    if (shouldSkipOnboardingStep(progress.path, stepId, ctx)) continue
    return { stepId, index: i, total: order.length }
  }
  const last = order[order.length - 1]!
  return { stepId: last, index: order.length - 1, total: order.length }
}

export function needsOnboardingResume(ctx: OnboardingSkipContext = {}): boolean {
  const progress = readOnboardingProgress()
  if (!progress || progress.dismissed || progress.finishedAtMs) return false
  const { stepId } = getActiveOnboardingStep(progress, ctx)
  return stepId !== 'done'
}

export function onboardingProgressPercent(progress: OnboardingProgress, ctx: OnboardingSkipContext = {}): number {
  const order = stepOrderForPath(progress.path)
  const done = order.filter(
    (id) =>
      progress.completedSteps.includes(id) ||
      progress.skippedSteps.includes(id) ||
      shouldSkipOnboardingStep(progress.path, id, ctx)
  ).length
  return Math.round((done / Math.max(order.length, 1)) * 100)
}
