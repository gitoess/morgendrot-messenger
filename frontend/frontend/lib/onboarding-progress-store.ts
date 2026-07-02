'use client'

/**
 * § H.36 P0 — linearer Einstiegs-Wizard (Boss / Helfer / Wanderer).
 * @see docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md §4–6, §9
 */
import { isBrowserSessionSignerReady } from '@/frontend/lib/messenger-session-keys-ready'
import {
  inferNetworkSetupPlanFromProfiles,
  isBossChainStepSatisfied,
  isBossNetworkPlanStepChosen,
} from '@/frontend/lib/boss-wizard-network-plan'
import { readNetworkProfilesState } from '@/frontend/lib/einsatz-network-profiles'
import { hasPersistedDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-mnemonic-session'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { getStandaloneHelperReadiness } from '@/frontend/lib/handoff-standalone-ready'
import { readTelegramInviteFromHandoffExtras } from '@/frontend/lib/handoff-extras'
import { readMyTeamMailboxes } from '@/frontend/lib/my-team-mailbox-store'
import { isTelegramAlarmGroupWizardDismissed } from '@/frontend/lib/telegram-alarm-group-prefs'

/** Sync mit `standalone-onboarding.ts` — bewusst inline, kein Zirkelimport. */
const STANDALONE_ONBOARDING_PATH_LS_KEY = 'morgendrot.standaloneOnboardingPath.v1'

export type OnboardingPath = 'boss' | 'helper' | 'wanderer'

export type BossStepId =
  | 'wallet'
  | 'network-plan'
  | 'einsatz-rules'
  | 'chain'
  | 'package'
  | 'mailboxes'
  | 'telegram'
  | 'meshtastic'
  | 'helpers'
  | 'done'
export type WandererStepId = 'wallet' | 'address' | 'private-mailbox' | 'meshtastic' | 'done'
/** Legacy — nicht mehr im Wizard angeboten; nur für alte localStorage-Einträge. */
export type HelperStepId = 'handoff' | 'telegram' | 'wallet' | 'team-self' | 'peering' | 'done'

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

const LS_KEY = 'morgendrot.onboardingProgress.v2'

export const BOSS_STEP_ORDER: BossStepId[] = [
  'wallet',
  'network-plan',
  'einsatz-rules',
  'chain',
  'mailboxes',
  'telegram',
  'meshtastic',
  'done',
]
export const HELPER_STEP_ORDER: HelperStepId[] = ['handoff', 'telegram', 'wallet', 'team-self', 'peering', 'done']
export const WANDERER_STEP_ORDER: WandererStepId[] = ['wallet', 'address', 'private-mailbox', 'meshtastic', 'done']

export function stepOrderForPath(path: OnboardingPath): OnboardingStepId[] {
  if (path === 'boss') return BOSS_STEP_ORDER
  if (path === 'helper') return HELPER_STEP_ORDER
  return WANDERER_STEP_ORDER
}

function readStandalonePathKey(): 'boss' | 'einsatz' | 'solo' | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STANDALONE_ONBOARDING_PATH_LS_KEY)?.trim()
    if (raw === 'boss' || raw === 'einsatz' || raw === 'solo') return raw
    return null
  } catch {
    return null
  }
}

export function resolveOnboardingPath(opts: {
  role?: string | null
  standalonePath?: 'boss' | 'einsatz' | 'solo' | null
}): OnboardingPath {
  const standalone = opts.standalonePath ?? readStandalonePathKey()
  if (standalone === 'solo') return 'wanderer'
  if (standalone === 'boss') return 'boss'
  const role = (opts.role || '').trim().toLowerCase()
  if (role === 'boss' || role === 'kommandant') return 'boss'
  return 'helper'
}

/** Wizard-Dialog: Boss, Wanderer oder Helfer (Einsatz mit Handoff). */
export function resolveOnboardingDialogPath(opts: {
  role?: string | null
  standalonePath?: 'boss' | 'einsatz' | 'solo' | null
}): OnboardingPath | null {
  const progress = readOnboardingProgress()
  if (progress?.path === 'helper') return 'helper'
  const standalone = opts.standalonePath ?? readStandalonePathKey()
  if (standalone === 'einsatz') return 'helper'
  return resolveWizardOnboardingPath(opts)
}

/** Wizard nur Boss + Wanderer (Einstellungen-Kachel ohne Helfer-Handoff). */
export function resolveWizardOnboardingPath(opts: {
  role?: string | null
  standalonePath?: 'boss' | 'einsatz' | 'solo' | null
}): 'boss' | 'wanderer' | null {
  const progress = readOnboardingProgress()
  if (progress?.path === 'boss') return 'boss'
  const standalone = opts.standalonePath ?? readStandalonePathKey()
  if (standalone === 'solo') return 'wanderer'
  if (standalone === 'boss') return 'boss'
  const role = (opts.role || '').trim().toLowerCase()
  if (role === 'boss' || role === 'kommandant') return 'boss'
  if (role === 'wanderer' || role === 'messenger') return 'wanderer'
  return null
}

const LEGACY_BOSS_MAILBOX_STEPS = ['server-mailbox', 'team'] as const
const LEGACY_BOSS_TELEGRAM_STEPS = ['telegram-bot', 'telegram-group'] as const

function migrateBossStepId(stepId: OnboardingStepId): OnboardingStepId {
  if ((LEGACY_BOSS_MAILBOX_STEPS as readonly string[]).includes(stepId)) return 'mailboxes'
  if ((LEGACY_BOSS_TELEGRAM_STEPS as readonly string[]).includes(stepId)) return 'telegram'
  if (stepId === 'package') return 'chain'
  if (stepId === 'address') return 'wallet'
  return stepId
}

function bossStepTouched(
  stepId: string,
  completed: OnboardingStepId[],
  skipped: OnboardingStepId[]
): boolean {
  return completed.includes(stepId as OnboardingStepId) || skipped.includes(stepId as OnboardingStepId)
}

function reconcileBossProgressSteps(
  completed: OnboardingStepId[],
  skipped: OnboardingStepId[]
): { completed: OnboardingStepId[]; skipped: OnboardingStepId[] } {
  let nextCompleted = completed
  let nextSkipped = skipped
  if (
    nextCompleted.includes('chain') &&
    !nextCompleted.includes('einsatz-rules') &&
    !nextSkipped.includes('einsatz-rules')
  ) {
    nextSkipped = [...nextSkipped, 'einsatz-rules']
  }
  if (
    nextCompleted.includes('chain') &&
    !nextCompleted.includes('network-plan') &&
    !nextSkipped.includes('network-plan')
  ) {
    nextSkipped = [...nextSkipped, 'network-plan']
  }
  return { completed: nextCompleted, skipped: nextSkipped }
}

function bossProgressCursor(
  completed: OnboardingStepId[],
  skipped: OnboardingStepId[]
): number {
  const order = BOSS_STEP_ORDER
  for (let i = 0; i < order.length; i++) {
    const sid = order[i]!
    if (!completed.includes(sid) && !skipped.includes(sid)) return i
  }
  return order.length - 1
}

function migrateRemovedBossHelpersStep(o: OnboardingProgress): OnboardingProgress {
  if (o.path !== 'boss') return o
  const hasHelpers =
    o.completedSteps.includes('helpers') || o.skippedSteps.includes('helpers')
  const needsCursorFix = o.currentStepIndex >= BOSS_STEP_ORDER.length
  if (!hasHelpers && !needsCursorFix) return o
  const completed = o.completedSteps.filter((s) => s !== 'helpers')
  const skipped = hasHelpers
    ? [...new Set([...o.skippedSteps.filter((s) => s !== 'helpers'), 'helpers' as BossStepId])]
    : o.skippedSteps.filter((s) => s !== 'helpers')
  const cursor = bossProgressCursor(completed, skipped)
  return {
    ...o,
    completedSteps: completed,
    skippedSteps: skipped,
    currentStepIndex: Math.max(0, Math.min(cursor, BOSS_STEP_ORDER.length - 1)),
  }
}

function stripRemovedBossSteps(o: OnboardingProgress): OnboardingProgress {
  const needsCursorReset =
    o.completedSteps.includes('address') ||
    o.skippedSteps.includes('address') ||
    o.completedSteps.includes('package') ||
    o.skippedSteps.includes('package')
  const migratedCompleted = [...new Set(o.completedSteps.map(migrateBossStepId).filter((s) => s !== 'address'))]
  const migratedSkipped = [...new Set(o.skippedSteps.map(migrateBossStepId).filter((s) => s !== 'address'))]
  const { completed, skipped } = reconcileBossProgressSteps(migratedCompleted, migratedSkipped)
  const order = BOSS_STEP_ORDER
  const cursor = needsCursorReset ? bossProgressCursor(completed, skipped) : o.currentStepIndex
  return migrateRemovedBossHelpersStep({
    ...o,
    completedSteps: completed,
    skippedSteps: skipped,
    currentStepIndex: Math.max(0, Math.min(cursor, order.length - 1)),
  })
}

function normalizeOnboardingProgress(o: OnboardingProgress): OnboardingProgress {
  if (o.path !== 'boss') return o

  const hadServer = bossStepTouched('server-mailbox', o.completedSteps, o.skippedSteps)
  const hadTeam = bossStepTouched('team', o.completedSteps, o.skippedSteps)
  const mailboxesDone = hadServer && hadTeam

  const hadTgBot = bossStepTouched('telegram-bot', o.completedSteps, o.skippedSteps)
  const hadTgGroup = bossStepTouched('telegram-group', o.completedSteps, o.skippedSteps)
  const telegramDone = hadTgBot && hadTgGroup

  const legacyBoss =
    o.completedSteps.some(
      (s) =>
        (LEGACY_BOSS_MAILBOX_STEPS as readonly string[]).includes(s as string) ||
        (LEGACY_BOSS_TELEGRAM_STEPS as readonly string[]).includes(s as string)
    ) ||
    o.skippedSteps.some(
      (s) =>
        (LEGACY_BOSS_MAILBOX_STEPS as readonly string[]).includes(s as string) ||
        (LEGACY_BOSS_TELEGRAM_STEPS as readonly string[]).includes(s as string)
    )

  if (!legacyBoss) {
    return migrateRemovedBossHelpersStep(
      stripRemovedBossSteps({
        ...o,
        currentStepIndex: Math.max(0, Math.min(o.currentStepIndex, BOSS_STEP_ORDER.length - 1)),
      })
    )
  }

  const completed = [
    ...new Set(
      o.completedSteps
        .filter(
          (s) =>
            !(LEGACY_BOSS_MAILBOX_STEPS as readonly string[]).includes(s as string) &&
            !(LEGACY_BOSS_TELEGRAM_STEPS as readonly string[]).includes(s as string)
        )
        .map(migrateBossStepId)
        .concat(mailboxesDone ? (['mailboxes'] as OnboardingStepId[]) : [])
        .concat(telegramDone ? (['telegram'] as OnboardingStepId[]) : [])
    ),
  ]
  const skipped = [
    ...new Set(
      o.skippedSteps
        .filter(
          (s) =>
            !(LEGACY_BOSS_MAILBOX_STEPS as readonly string[]).includes(s as string) &&
            !(LEGACY_BOSS_TELEGRAM_STEPS as readonly string[]).includes(s as string)
        )
        .map(migrateBossStepId)
    ),
  ]
  const { completed: reconciledCompleted, skipped: reconciledSkipped } = reconcileBossProgressSteps(
    completed,
    skipped
  )
  const order = BOSS_STEP_ORDER
  let currentStepIndex = order.length - 1
  for (let i = 0; i < order.length; i++) {
    const sid = order[i]!
    if (!reconciledCompleted.includes(sid) && !reconciledSkipped.includes(sid)) {
      currentStepIndex = i
      break
    }
  }
  return migrateRemovedBossHelpersStep(
    stripRemovedBossSteps({
      ...o,
      completedSteps: reconciledCompleted,
      skippedSteps: reconciledSkipped,
      currentStepIndex,
    })
  )
}

export function readOnboardingProgress(): OnboardingProgress | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as OnboardingProgress
    if (!o?.path || !Array.isArray(o.completedSteps)) return null
    return normalizeOnboardingProgress(o)
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

export function clearOnboardingDismissed(): void {
  const prev = readOnboardingProgress()
  if (!prev?.dismissed) return
  writeOnboardingProgress({ ...prev, dismissed: false })
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

export function isOnboardingFinished(): boolean {
  return Boolean(readOnboardingProgress()?.finishedAtMs)
}

/** Fertig-Flag löschen — Wizard ab Schritt 1 wieder durchgehbar (Fortschritt bleibt). */
export function reopenOnboardingAfterFinish(): void {
  const prev = readOnboardingProgress()
  if (!prev?.finishedAtMs) return
  writeOnboardingProgress({
    ...prev,
    finishedAtMs: undefined,
    dismissed: false,
    currentStepIndex: 0,
    completedSteps: [],
    skippedSteps: [],
  })
}

/** Wizard öffnen: neu starten, fertigen Durchlauf wieder öffnen oder laufenden Fortschritt behalten. */
export function prepareOnboardingWizardOpen(path: OnboardingPath): OnboardingProgress {
  const progress = readOnboardingProgress()
  if (!progress || progress.path !== path) {
    return startOnboarding(path)
  }
  if (progress.finishedAtMs) {
    reopenOnboardingAfterFinish()
  }
  return readOnboardingProgress() ?? progress
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

/**
 * Tresor sichtbar lassen; Link „Messenger einrichten“ anbieten bis Wizard abgeschlossen.
 */
export function resolveMessengerSetupOnboardingPath(role?: string | null): 'boss' | 'wanderer' | null {
  const progress = readOnboardingProgress()
  if (progress?.path === 'boss' || progress?.path === 'wanderer') return progress.path
  return resolveWizardOnboardingPath({ role })
}

export function shouldOfferMessengerSetupFromVault(role?: string | null): boolean {
  if (isOnboardingFinished()) return false
  return resolveMessengerSetupOnboardingPath(role) !== null
}

/** @deprecated Nutze shouldOfferMessengerSetupFromVault — Tresor wird nicht mehr pauschal unterdrückt. */
export function shouldSuppressVaultForBossOnboarding(role?: string | null): boolean {
  return shouldOfferMessengerSetupFromVault(role)
}

export type OnboardingSkipContext = {
  role?: string | null
  hasWallet?: boolean
  hasAddress?: boolean
  hasPackageId?: boolean
  hasMailboxId?: boolean
  serverMailboxId?: string | null
  inboxUnionMailboxIds?: string[] | null
  hasTeamId?: boolean
  hasTeamMailbox?: boolean
  hasMeshNodeId?: boolean
  hasHandoffConfig?: boolean
  hasBossPartner?: boolean
}

export function buildOnboardingSkipContext(api?: {
  role?: string | null
  myAddress?: string | null
  myAddressFull?: string | null
  hasKeys?: boolean
  locked?: boolean
  packageId?: string | null
  mailboxId?: string | null
  handoffLabel?: string | null
  meshNodeId?: string | null
  bossAddress?: string | null
  inboxUnionMailboxIds?: string[] | null
} | null, opts?: { uiLocked?: boolean }): OnboardingSkipContext {
  const addr = (api?.myAddressFull || api?.myAddress || '').trim()
  const handoff = readLocalHandoffAppliedSnapshot()
  const serverMb = (api?.mailboxId ?? '').trim()
  const union = api?.inboxUnionMailboxIds ?? []
  const hasTeamMailbox =
    readMyTeamMailboxes().length > 0 ||
    union.some((id) => id.trim().toLowerCase() !== serverMb.toLowerCase() && Boolean(id.trim()))
  return {
    role: api?.role,
    hasWallet: isBrowserSessionSignerReady(opts?.uiLocked ?? false),
    hasAddress: Boolean(addr),
    hasPackageId: Boolean(api?.packageId?.trim()),
    hasMailboxId: Boolean(serverMb),
    serverMailboxId: serverMb || null,
    inboxUnionMailboxIds: union,
    hasTeamId:
      Boolean(api?.handoffLabel?.trim()) ||
      readMyTeamMailboxes().length > 0 ||
      (union.length ?? 0) > 1,
    hasTeamMailbox,
    hasMeshNodeId: Boolean(api?.meshNodeId?.trim()),
    hasHandoffConfig: Boolean(handoff) || Boolean(api?.packageId?.trim() && api?.mailboxId?.trim()),
    hasBossPartner: Boolean(handoff?.bossAddress?.trim() || api?.bossAddress?.trim()),
  }
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
      case 'wallet':
        return Boolean(ctx.hasWallet)
      case 'network-plan':
        if (isBossNetworkPlanStepChosen()) return true
        return (
          inferNetworkSetupPlanFromProfiles(readNetworkProfilesState(), {
            hasPackageId: ctx.hasPackageId,
          }) !== null
        )
      case 'einsatz-rules':
        return false
      case 'chain':
      case 'package':
        return isBossChainStepSatisfied({
          hasPackageId: ctx.hasPackageId,
        })
      case 'mailboxes':
        return Boolean(ctx.hasMailboxId && (ctx.hasTeamMailbox || readMyTeamMailboxes().length > 0))
      case 'telegram':
        return false
      case 'meshtastic':
        return Boolean(ctx.hasMeshNodeId)
      case 'helpers':
        return true
      case 'done':
        return false
      default:
        return false
    }
  }

  if (path === 'helper') {
    switch (stepId as HelperStepId) {
      case 'handoff':
        return readiness.hasHandoff || Boolean(ctx.hasHandoffConfig)
      case 'telegram': {
        const invite = readTelegramInviteFromHandoffExtras()
        if (!invite) return true
        return isTelegramAlarmGroupWizardDismissed()
      }
      case 'wallet':
        return hasMnemonic || !readiness.needsMnemonic || Boolean(ctx.hasWallet)
      case 'team-self':
        return Boolean(handoff?.handoffLabel)
      case 'peering':
        return Boolean(handoff?.bossAddress) || Boolean(ctx.hasBossPartner)
      case 'done':
        return false
      default:
        return false
    }
  }

  switch (stepId as WandererStepId) {
    case 'wallet':
      return hasMnemonic
    case 'address':
      return Boolean(ctx.role?.trim())
    case 'private-mailbox':
      return Boolean(ctx.hasMailboxId)
    case 'meshtastic':
      return Boolean(ctx.hasMeshNodeId)
    case 'done':
      return false
    default:
      return false
  }
}

export function getWizardViewStep(
  progress: OnboardingProgress
): { stepId: OnboardingStepId; index: number; total: number } {
  const order = stepOrderForPath(progress.path)
  const index = Math.max(0, Math.min(progress.currentStepIndex, order.length - 1))
  return { stepId: order[index]!, index, total: order.length }
}

/** Gleiche Anzeige wie Wizard-Fortschrittsbalken (`OnboardingStepIndicator`). */
export function getOnboardingWizardStepProgress(progress: OnboardingProgress): {
  stepNumber: number
  stepTotal: number
  percent: number
} {
  const { index, total } = getWizardViewStep(progress)
  const percent = total > 0 ? Math.round(((index + 1) / total) * 100) : 0
  return { stepNumber: index + 1, stepTotal: total, percent }
}

/** Wizard „Zurück“: vorheriger Schritt anzeigen (completed/skipped am aktuellen Schritt lösen). */
export function goBackOnboardingStep(currentStepId: OnboardingStepId): void {
  const prev = readOnboardingProgress()
  if (!prev) return
  const order = stepOrderForPath(prev.path)
  const idx = order.indexOf(currentStepId)
  if (idx <= 0) return
  writeOnboardingProgress({
    ...prev,
    currentStepIndex: idx - 1,
    completedSteps: prev.completedSteps.filter((id) => id !== currentStepId),
    skippedSteps: prev.skippedSteps.filter((id) => id !== currentStepId),
    ...(currentStepId === 'done' ? { finishedAtMs: undefined } : {}),
  })
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

export function onboardingProgressPercent(progress: OnboardingProgress, _ctx: OnboardingSkipContext = {}): number {
  return getOnboardingWizardStepProgress(progress).percent
}
