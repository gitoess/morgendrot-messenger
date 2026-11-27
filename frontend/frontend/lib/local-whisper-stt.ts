/**
 * H.18 — lokales STT (Whisper, Transformers.js).
 * Deutsch-Fine-Tune + Roh-PCM (kein WebM) — tiny war für DE unbrauchbar.
 */

export type LocalWhisperProgress = (msg: string) => void

type AsrPipeline = (
  audio: Float32Array | string,
  opts?: {
    language?: string
    task?: string
    return_timestamps?: boolean
    /** Manche ONNX-Exports sind fälschlich als English-only markiert. */
    is_multilingual?: boolean
  }
) => Promise<{ text?: string } | string>

let asrPromise: Promise<AsrPipeline> | null = null

const TARGET_SR = 16_000
/** Max. Diktat-Clip (danach Auto-Stop). */
export const LOCAL_STT_MAX_MS = 25_000

/** DE-Fine-Tune (Common Voice) — deutlich besser als multilingual tiny/base. */
export const LOCAL_WHISPER_MODEL = 'onnx-community/whisper-small-cv11-german-ONNX'

export function canUseLocalWhisperStt(): boolean {
  return typeof window !== 'undefined' && typeof AudioContext !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

function preferWebGpu(): boolean {
  try {
    return typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { gpu?: unknown }).gpu)
  } catch {
    return false
  }
}

async function getAsr(onProgress?: LocalWhisperProgress): Promise<AsrPipeline> {
  if (!asrPromise) {
    asrPromise = (async () => {
      onProgress?.('DE-Spracherkennung wird geladen (einmalig, ~150 MB)…')
      const { pipeline, env } = await import('@huggingface/transformers')
      env.allowLocalModels = false
      env.useBrowserCache = true
      const load = async (device: 'webgpu' | 'wasm', dtype: 'fp16' | 'q8') =>
        (await pipeline('automatic-speech-recognition', LOCAL_WHISPER_MODEL, {
          dtype,
          device,
        })) as AsrPipeline
      let asr: AsrPipeline
      if (preferWebGpu()) {
        try {
          asr = await load('webgpu', 'fp16')
        } catch {
          onProgress?.('WebGPU nicht nutzbar — WASM…')
          asr = await load('wasm', 'q8')
        }
      } else {
        asr = await load('wasm', 'q8')
      }
      onProgress?.('Spracherkennung bereit.')
      return asr
    })().catch((e) => {
      asrPromise = null
      throw e
    })
  }
  return asrPromise
}

/** Linear resample + Peak-Normalize → Whisper 16 kHz mono. */
export function resampleAndNormalize(input: Float32Array, inputRate: number): Float32Array {
  let mono = input
  if (inputRate !== TARGET_SR && input.length > 0) {
    const ratio = inputRate / TARGET_SR
    const outLen = Math.max(1, Math.round(input.length / ratio))
    const out = new Float32Array(outLen)
    for (let i = 0; i < outLen; i++) {
      const src = i * ratio
      const i0 = Math.floor(src)
      const i1 = Math.min(i0 + 1, input.length - 1)
      const t = src - i0
      out[i] = input[i0]! * (1 - t) + input[i1]! * t
    }
    mono = out
  } else {
    mono = new Float32Array(input)
  }
  let peak = 0
  for (let i = 0; i < mono.length; i++) {
    const a = Math.abs(mono[i]!)
    if (a > peak) peak = a
  }
  if (peak > 1e-4 && peak < 0.95) {
    const g = 0.95 / peak
    for (let i = 0; i < mono.length; i++) mono[i]! *= g
  }
  return mono
}

/** WebM/Blob-Pfad (Tests / Fallback). */
export async function blobToWhisperFloat32(blob: Blob): Promise<Float32Array> {
  const ab = await blob.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const decoded = await ctx.decodeAudioData(ab.slice(0))
    const ch0 = decoded.getChannelData(0)
    const mono = new Float32Array(ch0.length)
    if (decoded.numberOfChannels > 1) {
      const ch1 = decoded.getChannelData(1)
      for (let i = 0; i < ch0.length; i++) mono[i] = (ch0[i]! + ch1[i]!) * 0.5
    } else {
      mono.set(ch0)
    }
    return resampleAndNormalize(mono, decoded.sampleRate)
  } finally {
    await ctx.close().catch(() => undefined)
  }
}

export async function transcribeGermanPcm(
  samples: Float32Array,
  sampleRate: number,
  onProgress?: LocalWhisperProgress
): Promise<string> {
  if (!samples.length) return ''
  const asr = await getAsr(onProgress)
  onProgress?.('Transkribiere (Deutsch)…')
  const audio = resampleAndNormalize(samples, sampleRate)
  /**
   * DE-Fine-Tune: kein `language`/`task` — Export oft als English-only markiert,
   * sonst: „Cannot specify task or language for an English-only model“.
   */
  let result: { text?: string } | string
  try {
    result = await asr(audio, { return_timestamps: false })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/english-only|is_multilingual/i.test(msg)) {
      result = await asr(audio, {
        language: 'german',
        task: 'transcribe',
        return_timestamps: false,
        is_multilingual: true,
      })
    } else {
      throw e
    }
  }
  const text = typeof result === 'string' ? result : String(result?.text ?? '')
  return text.replace(/\s+/g, ' ').trim()
}

export async function transcribeGermanAudioBlob(
  blob: Blob,
  onProgress?: LocalWhisperProgress
): Promise<string> {
  if (!blob.size) return ''
  const audio = await blobToWhisperFloat32(blob)
  return transcribeGermanPcm(audio, TARGET_SR, onProgress)
}

export type LocalSttRecordingHandle = {
  /** Roh-PCM + Native-Sample-Rate (besser als WebM für ASR). */
  stop: () => Promise<{ samples: Float32Array; sampleRate: number }>
  abort: () => void
}

/** Mikrofon → Roh-PCM (kein MediaRecorder-Verlust). */
export async function startLocalSttRecording(): Promise<LocalSttRecordingHandle> {
  if (!canUseLocalWhisperStt()) {
    throw new Error('Lokale Aufnahme nicht verfügbar.')
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  })
  const ctx = new AudioContext()
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined)
  const source = ctx.createMediaStreamSource(stream)
  const chunks: Float32Array[] = []
  /** ScriptProcessor: breit verfügbar; sammelt Mono-Float32 (kein WebM-Verlust). */
  const processor = ctx.createScriptProcessor(4096, 1, 1)
  processor.onaudioprocess = (ev) => {
    chunks.push(new Float32Array(ev.inputBuffer.getChannelData(0)))
  }
  const mute = ctx.createGain()
  mute.gain.value = 0
  source.connect(processor)
  processor.connect(mute)
  mute.connect(ctx.destination)

  let settled = false
  const cleanup = () => {
    if (settled) return
    settled = true
    try {
      processor.disconnect()
      source.disconnect()
      mute.disconnect()
    } catch {
      /* */
    }
    stream.getTracks().forEach((t) => t.stop())
    void ctx.close().catch(() => undefined)
  }

  return {
    stop: async () => {
      const sampleRate = ctx.sampleRate
      cleanup()
      const total = chunks.reduce((n, c) => n + c.length, 0)
      const samples = new Float32Array(total)
      let off = 0
      for (const c of chunks) {
        samples.set(c, off)
        off += c.length
      }
      return { samples, sampleRate }
    },
    abort: () => {
      cleanup()
      chunks.length = 0
    },
  }
}
