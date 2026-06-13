/**
 * § H.33e — Laufzeit-Auto-Config (PWA steuert Boss-Scheduler ohne .env-Neustart).
 */
import fs from 'node:fs'
import path from 'node:path'
import { forensicBatchModeFromEnv, parseForensicBatchModeInput, type ForensicBatchArchiveMode } from './forensic-batch-mode.js'
import { atomicWriteFileSync } from './forensic-batch-registry-file-lock.js'

export type ForensicBatchAutoIntervalMin = 5 | 15 | 30

export type ForensicBatchAutoConfigFile = {
  autoEnabled: boolean
  intervalMin: ForensicBatchAutoIntervalMin
  mode?: ForensicBatchArchiveMode
  updatedAtMs: number
}

const DEFAULT_CONFIG_FILE =
  process.env.FORENSIC_BATCH_AUTO_CONFIG_FILE?.trim() || '.morgendrot-forensic-batch-auto.json'

function configPath(): string {
  return path.resolve(process.cwd(), DEFAULT_CONFIG_FILE)
}

function parseIntervalMin(raw: unknown): ForensicBatchAutoIntervalMin | undefined {
  const n = Number(raw)
  if (n === 5 || n === 15 || n === 30) return n
  return undefined
}

function autoEnabledFromEnv(): boolean {
  const v = (process.env.FORENSIC_BATCH_AUTO_ENABLED ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function intervalMinFromEnv(): ForensicBatchAutoIntervalMin {
  return parseIntervalMin(process.env.FORENSIC_BATCH_AUTO_INTERVAL_MIN) ?? 15
}

export function readForensicBatchAutoConfigFile(): ForensicBatchAutoConfigFile | null {
  const p = configPath()
  try {
    if (!fs.existsSync(p)) return null
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Partial<ForensicBatchAutoConfigFile>
    if (typeof raw.autoEnabled !== 'boolean') return null
    const intervalMin = parseIntervalMin(raw.intervalMin) ?? 15
    const mode = parseForensicBatchModeInput(raw.mode)
    return {
      autoEnabled: raw.autoEnabled,
      intervalMin,
      ...(mode ? { mode } : {}),
      updatedAtMs: typeof raw.updatedAtMs === 'number' ? raw.updatedAtMs : Date.now(),
    }
  } catch {
    return null
  }
}

export function writeForensicBatchAutoConfigFile(
  patch: Partial<Omit<ForensicBatchAutoConfigFile, 'updatedAtMs'>>
): ForensicBatchAutoConfigFile {
  const prev = readForensicBatchAutoConfigFile()
  const next: ForensicBatchAutoConfigFile = {
    autoEnabled: patch.autoEnabled ?? prev?.autoEnabled ?? autoEnabledFromEnv(),
    intervalMin: patch.intervalMin ?? prev?.intervalMin ?? intervalMinFromEnv(),
    ...(patch.mode !== undefined
      ? { mode: patch.mode }
      : prev?.mode
        ? { mode: prev.mode }
        : {}),
    updatedAtMs: Date.now(),
  }
  atomicWriteFileSync(configPath(), JSON.stringify(next, null, 2))
  return next
}

export function getEffectiveForensicBatchAutoEnabled(): boolean {
  const file = readForensicBatchAutoConfigFile()
  if (file) return file.autoEnabled
  return autoEnabledFromEnv()
}

export function getEffectiveForensicBatchIntervalMin(): ForensicBatchAutoIntervalMin {
  const file = readForensicBatchAutoConfigFile()
  if (file) return file.intervalMin
  return intervalMinFromEnv()
}

export function getEffectiveForensicBatchMode(): ForensicBatchArchiveMode {
  const file = readForensicBatchAutoConfigFile()
  if (file?.mode) return file.mode
  return forensicBatchModeFromEnv()
}

export function hasForensicBatchAutoConfigFile(): boolean {
  return readForensicBatchAutoConfigFile() !== null
}
