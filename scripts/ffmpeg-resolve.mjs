/**
 * Gleiche Auflösungslogik wie src/ffmpeg-resolve.ts (bei Änderungen beide anpassen).
 * Für reine-Node-Skripte ohne tsx.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
export const PROJECT_ROOT = join(scriptDir, '..')

export function resolveFfmpegExecutable(projectRoot = PROJECT_ROOT) {
  const isWin = process.platform === 'win32'
  const bundledName = isWin ? 'ffmpeg.exe' : 'ffmpeg'
  const bundled = join(projectRoot, 'tools', 'ffmpeg', 'bin', bundledName)
  if (existsSync(bundled)) {
    return { executable: bundled, source: 'bundled' }
  }
  const envPath = (process.env.MORG_FFMPEG_PATH || process.env.FFMPEG_PATH || '').trim()
  if (envPath.length > 0) {
    return { executable: envPath, source: 'env' }
  }
  return { executable: 'ffmpeg', source: 'path' }
}
