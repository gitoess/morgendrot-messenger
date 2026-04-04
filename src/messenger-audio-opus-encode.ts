/**
 * Browser-Aufnahme (WebM/MP4/WAV) → Ogg/Opus für `MORG_AUDIO_V1` / Messenger-Anhang.
 * ffmpeg: gebündelt unter tools/ffmpeg/bin → siehe src/ffmpeg-resolve.ts (CM4/PC; nicht auf Heltec).
 */
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ffmpegMissingUserMessage, resolveFfmpegExecutable } from './ffmpeg-resolve';

const MAX_INPUT_BYTES = 6 * 1024 * 1024;

function extFromMime(mime: string): string {
    const m = (mime || '').toLowerCase();
    if (m.includes('webm')) return 'webm';
    if (m.includes('wav')) return 'wav';
    if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
    if (m.includes('ogg')) return 'ogg';
    return 'webm';
}

function ffmpegBitrate(): string {
    const b = (process.env.MORG_OPUS_BITRATE || '8k').trim();
    return /^\d+(\.\d+)?k$/i.test(b) ? b : '8k';
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<string> {
    const res = resolveFfmpegExecutable();
    return new Promise((resolve, reject) => {
        const child = spawn(res.executable, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let err = '';
        child.stderr?.on('data', (c: Buffer) => {
            err += c.toString('utf8');
        });
        const t = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error('ffmpeg: Timeout'));
        }, timeoutMs);
        child.on('error', (e: NodeJS.ErrnoException) => {
            clearTimeout(t);
            reject(
                new Error(
                    e.code === 'ENOENT' ? ffmpegMissingUserMessage(res) : `ffmpeg: ${e.message}`
                )
            );
        });
        child.on('close', (code) => {
            clearTimeout(t);
            if (code === 0) resolve(err);
            else reject(new Error(`ffmpeg beendete mit ${code}: ${err.slice(0, 600)}`));
        });
    });
}

/**
 * Rohdaten vom MediaRecorder → Opus-Datei (Ogg-Container, Magic „OggS“).
 */
export async function transcodeBrowserAudioToMessengerOpus(
    input: Buffer,
    mimeTypeHint: string
): Promise<{ opus: Buffer; ffmpegStderr: string }> {
    if (input.length < 16 || input.length > MAX_INPUT_BYTES) {
        throw new Error(`Audiodaten ${input.length} B ungültig (16 B … ${MAX_INPUT_BYTES} B).`);
    }
    const ext = extFromMime(mimeTypeHint);
    const dir = await mkdtemp(join(tmpdir(), 'morg-msg-audio-'));
    const tag = randomBytes(6).toString('hex');
    const inFile = join(dir, `rec.${ext}`);
    const outFile = join(dir, `out_${tag}.opus`);
    await writeFile(inFile, input);

    const useSilence =
        process.env.MORG_OPUS_USE_SILENCE_REMOVE === '1' ||
        String(process.env.MORG_OPUS_USE_SILENCE_REMOVE || '').toLowerCase() === 'true';
    const silenceremove =
        'silenceremove=start_periods=-1:start_duration=0.4:start_threshold=-35dB:stop_periods=-1:stop_duration=0.5:stop_threshold=-35dB';

    const args: string[] = ['-hide_banner', '-loglevel', 'error', '-y', '-i', inFile];
    if (useSilence) {
        args.push('-af', silenceremove);
    }
    args.push(
        '-ar',
        '8000',
        '-ac',
        '1',
        '-c:a',
        'libopus',
        '-b:a',
        ffmpegBitrate(),
        '-application',
        'voip',
        '-vn',
        outFile
    );

    const ffmpegStderr = await runFfmpeg(args, 45_000);
    const opus = await readFile(outFile);
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    if (opus.length < 32) {
        throw new Error('ffmpeg lieferte kein nutzbares Opus (zu kurz).');
    }
    const magic = opus.subarray(0, 4).toString('latin1');
    if (magic !== 'OggS') {
        throw new Error(`Erwarteter Ogg-Container (OggS), erhalten: ${JSON.stringify(magic)}`);
    }
    return { opus, ffmpegStderr };
}
