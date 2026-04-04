/**
 * Auflösung des ffmpeg-Binaries: gebündelt unter tools/ffmpeg → Env → PATH.
 * Logik parallel zu scripts/ffmpeg-resolve.mjs (bei Änderungen beide anpassen).
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = dirname(fileURLToPath(import.meta.url));

/** Projekt-Root (…/morgendrot). */
export const PROJECT_ROOT = join(srcDir, '..');

export type FfmpegResolutionSource = 'bundled' | 'env' | 'path';

export type FfmpegResolution = {
    executable: string;
    source: FfmpegResolutionSource;
};

export function resolveFfmpegExecutable(projectRoot: string = PROJECT_ROOT): FfmpegResolution {
    const isWin = process.platform === 'win32';
    const bundledName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
    const bundled = join(projectRoot, 'tools', 'ffmpeg', 'bin', bundledName);
    if (existsSync(bundled)) {
        return { executable: bundled, source: 'bundled' };
    }
    const envPath = (process.env.MORG_FFMPEG_PATH || process.env.FFMPEG_PATH || '').trim();
    if (envPath.length > 0) {
        return { executable: envPath, source: 'env' };
    }
    return { executable: 'ffmpeg', source: 'path' };
}

export function ffmpegMissingUserMessage(res: FfmpegResolution): string {
    const readme = join(PROJECT_ROOT, 'tools', 'ffmpeg', 'README.md');
    return (
        `ffmpeg nicht gefunden (versucht: „${res.executable}“, Quelle: ${res.source}). ` +
        `Gebündelte Version: siehe „${readme}“. ` +
        `Alternativ: MORG_FFMPEG_PATH oder FFMPEG_PATH, oder ffmpeg im System-PATH.`
    );
}
