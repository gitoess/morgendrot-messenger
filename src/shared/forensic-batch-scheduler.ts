/**
 * § H.33e — Hintergrund-Batch auf Boss-PC (API läuft → kein offenes Browser-Tab nötig).
 */
import { CFG } from '../config.js'
import { runServerForensicBatchArchiveWithLock } from './forensic-batch-runner.js'
import {
  getEffectiveForensicBatchAutoEnabled,
  getEffectiveForensicBatchIntervalMin,
  getEffectiveForensicBatchMode,
} from './forensic-batch-auto-config.js'
import { logger } from '../logger.js'

let timer: ReturnType<typeof setInterval> | null = null
let lastRunAt = 0
let lastStatus = ''

function roleAllowsBatch(): boolean {
  return CFG.ROLE === 'boss' || CFG.ROLE === 'kommandant'
}

async function tick(): Promise<void> {
  if (!roleAllowsBatch()) return
  if (!getEffectiveForensicBatchAutoEnabled()) return
  try {
    const out = await runServerForensicBatchArchiveWithLock({
      onlyNew: true,
      mode: getEffectiveForensicBatchMode(),
    })
    if (out.ok === false && out.error.includes('läuft bereits')) return
    lastRunAt = Date.now()
    if (out.ok) {
      if (out.messageCount > 0) {
        lastStatus = `Auto (${out.mode}): ${out.messageCount} Nachricht(en) in ${out.txCount} TX.`
        logger.info('[forensic-batch]', lastStatus)
      } else {
        lastStatus = 'Auto: nichts Neues.'
      }
    } else if (!out.error.includes('Keine neuen')) {
      lastStatus = `Auto-Fehler: ${out.error}`
      logger.warn('[forensic-batch]', lastStatus)
    }
  } catch (e) {
    lastStatus = e instanceof Error ? e.message : String(e)
    logger.warn('[forensic-batch] tick failed:', lastStatus)
  }
}

export function startForensicBatchScheduler(): void {
  if (timer) return
  if (!roleAllowsBatch()) return
  const min = getEffectiveForensicBatchIntervalMin()
  timer = setInterval(() => void tick(), min * 60_000)
  logger.info(
    `[forensic-batch] Scheduler aktiv (${min} Min, auto=${getEffectiveForensicBatchAutoEnabled()}).`
  )
}

export function stopForensicBatchScheduler(): void {
  if (timer) clearInterval(timer)
  timer = null
}

export function restartForensicBatchScheduler(): void {
  stopForensicBatchScheduler()
  if (getEffectiveForensicBatchAutoEnabled()) {
    startForensicBatchScheduler()
  }
}

export function getForensicBatchSchedulerStatus(): {
  enabled: boolean
  intervalMin: number
  lastRunAt: number
  lastStatus: string
  running: boolean
} {
  return {
    enabled: getEffectiveForensicBatchAutoEnabled() && roleAllowsBatch(),
    intervalMin: getEffectiveForensicBatchIntervalMin(),
    lastRunAt,
    lastStatus,
    running: timer !== null,
  }
}
