'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { messengerAudioToOpus } from '@/frontend/lib/api'
import { base64ToUint8Array, uint8ArrayToBase64 } from '@/frontend/lib/emergency-binary-browser'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { isLoRaMeshTransport } from '@/frontend/lib/chat-view-messenger-transport'
import {
  getMessengerVoiceEmergencyMaxMs,
  getMessengerVoiceNormalMaxMs,
  pickVoiceRecorderMimeType,
  type VoiceRecordKind,
  type VoiceRecordPhase,
} from '@/frontend/features/voice/messenger-voice-record'

export type { VoiceRecordKind, VoiceRecordPhase } from '@/frontend/features/voice/messenger-voice-record'

export function useChatViewVoiceRecord(p: {
  forcedTransport: ForcedTransport
  ingestChatAttachmentFile: (file: File, opts?: { transportOverride?: ForcedTransport }) => Promise<void>
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  /** Nur bei SOS + Funk: orangefarbener Sofort-Senden-CTA */
  onEmergencyVoiceReady?: () => void
  blocked: boolean
}) {
  const { forcedTransport, ingestChatAttachmentFile, setStatus, setStatusMsg, onEmergencyVoiceReady, blocked } = p

  const [phase, setPhase] = useState<VoiceRecordPhase>('idle')
  const [activeKind, setActiveKind] = useState<VoiceRecordKind | null>(null)
  const [progress01, setProgress01] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const mimeRef = useRef<string>('')
  const startedAtRef = useRef<number>(0)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordKindRef = useRef<VoiceRecordKind | null>(null)
  /** Transport beim Start der Aufnahme (vermeidet Race, falls UI während Aufnahme wechselt). */
  const transportAtRecordStartRef = useRef<ForcedTransport>(forcedTransport)

  const cleanupTimers = useCallback(() => {
    if (maxTimerRef.current != null) {
      clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    if (tickRef.current != null) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      cleanupTimers()
      try {
        recorderRef.current?.stop()
      } catch {
        /* ignore */
      }
      recorderRef.current = null
      stopStream()
    }
  }, [cleanupTimers, stopStream])

  const finishRecording = useCallback(() => {
    const rec = recorderRef.current
    if (!rec || rec.state === 'inactive') return
    cleanupTimers()
    rec.stop()
  }, [cleanupTimers])

  const startRecording = useCallback(
    async (kind: VoiceRecordKind) => {
      if (blocked || phase !== 'idle') return
      const mime = pickVoiceRecorderMimeType()
      if (!mime) {
        setStatus('error')
        setStatusMsg('Dieser Browser unterstützt keine passende Audio-Aufnahme (WebM/Opus).')
        setTimeout(() => setStatus('idle'), 6000)
        return
      }
      transportAtRecordStartRef.current = forcedTransport
      const maxMs =
        kind === 'emergency'
          ? getMessengerVoiceEmergencyMaxMs(forcedTransport)
          : getMessengerVoiceNormalMaxMs(forcedTransport)

      recordKindRef.current = kind
      setActiveKind(kind)
      mimeRef.current = mime
      setPhase('starting')
      setProgress01(0)
      setStatus('idle')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
          },
          video: false,
        })
        streamRef.current = stream
        chunksRef.current = []
        const rec = new MediaRecorder(stream, { mimeType: mime })
        recorderRef.current = rec

        rec.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
        }

        rec.onerror = () => {
          setStatus('error')
          setStatusMsg('Aufnahme-Fehler (MediaRecorder).')
          cleanupTimers()
          stopStream()
          recorderRef.current = null
          setPhase('idle')
          setProgress01(0)
          recordKindRef.current = null
          setActiveKind(null)
          setTimeout(() => setStatus('idle'), 6000)
        }

        rec.onstop = async () => {
          const kindDone = recordKindRef.current
          const trSnap = transportAtRecordStartRef.current
          const chosenMime = mimeRef.current || mime
          const blob = new Blob(chunksRef.current, { type: chosenMime })
          chunksRef.current = []
          stopStream()
          recorderRef.current = null
          cleanupTimers()
          setPhase('encoding')
          setProgress01(1)
          try {
            if (blob.size < 32) {
              setStatus('error')
              setStatusMsg('Aufnahme zu kurz oder leer.')
              setTimeout(() => setStatus('idle'), 5000)
              return
            }
            const buf = new Uint8Array(await blob.arrayBuffer())
            const audioB64 = uint8ArrayToBase64(buf)
            const tr = await messengerAudioToOpus(audioB64, blob.type || chosenMime)
            if (!tr.ok || !tr.opusBase64) {
              setStatus('error')
              setStatusMsg(tr.error || 'Opus-Kodierung fehlgeschlagen (ffmpeg auf dem Server?).')
              setTimeout(() => setStatus('idle'), 8000)
              return
            }
            const opusBytes = base64ToUint8Array(tr.opusBase64.replace(/\s/g, ''))
            const prefix = kindDone === 'emergency' ? 'sos-sprache' : 'sprachmemo'
            const file = new File([opusBytes], `${prefix}-${Date.now()}.opus`, {
              type: 'audio/ogg',
            })
            if (kindDone === 'emergency') {
              if (isLoRaMeshTransport(trSnap)) {
                await ingestChatAttachmentFile(file, { transportOverride: 'mesh' })
                onEmergencyVoiceReady?.()
                setStatus('success')
                setStatusMsg('SOS bereit – orangefarbenen Button zum Senden über LoRa.')
                setTimeout(() => setStatus('idle'), 12_000)
              } else {
                await ingestChatAttachmentFile(file, { transportOverride: 'internet' })
                setStatus('success')
                setStatusMsg('SOS bereit – über Online (IOTA) senden (unten).')
                setTimeout(() => setStatus('idle'), 8000)
              }
            } else {
              await ingestChatAttachmentFile(file)
              setStatus('success')
              setStatusMsg('Sprachnachricht bereit – jetzt Senden.')
              setTimeout(() => setStatus('idle'), 5000)
            }
          } catch (e) {
            setStatus('error')
            setStatusMsg(e instanceof Error ? e.message : String(e))
            setTimeout(() => setStatus('idle'), 7000)
          } finally {
            setPhase('idle')
            setProgress01(0)
            recordKindRef.current = null
            setActiveKind(null)
          }
        }

        rec.start(200)
        setPhase('recording')
        startedAtRef.current = Date.now()
        tickRef.current = setInterval(() => {
          const t = (Date.now() - startedAtRef.current) / maxMs
          setProgress01(Math.min(1, t))
        }, 80)
        maxTimerRef.current = setTimeout(() => {
          void finishRecording()
        }, maxMs)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const denied = /notallowed|permission|denied/i.test(msg)
        setStatus('error')
        setStatusMsg(
          denied
            ? 'Mikrofon-Zugriff verweigert – in den Browser-/OS-Einstellungen erlauben.'
            : `Mikrofon: ${msg}`
        )
        setPhase('idle')
        setProgress01(0)
        recordKindRef.current = null
        setActiveKind(null)
        stopStream()
        recorderRef.current = null
        setTimeout(() => setStatus('idle'), 7000)
      }
    },
    [
      blocked,
      phase,
      forcedTransport,
      finishRecording,
      cleanupTimers,
      stopStream,
      ingestChatAttachmentFile,
      setStatus,
      setStatusMsg,
      onEmergencyVoiceReady,
    ]
  )

  const toggleNormal = useCallback(() => {
    if (phase === 'recording' && activeKind === 'normal') {
      void finishRecording()
      return
    }
    if (phase === 'idle') void startRecording('normal')
  }, [phase, activeKind, finishRecording, startRecording])

  const toggleEmergency = useCallback(() => {
    if (phase === 'recording' && activeKind === 'emergency') {
      void finishRecording()
      return
    }
    if (phase === 'idle') void startRecording('emergency')
  }, [phase, activeKind, finishRecording, startRecording])

  const busy = phase === 'starting' || phase === 'encoding'
  const recording = phase === 'recording'

  const slotBusyOther = (slot: VoiceRecordKind) =>
    (phase !== 'idle' && activeKind !== null && activeKind !== slot) || busy

  const voiceEmergencyMaxSeconds = getMessengerVoiceEmergencyMaxMs(forcedTransport) / 1000
  const sosFollowsOnline = forcedTransport === 'internet'

  return {
    voicePhase: phase,
    voiceActiveKind: activeKind,
    voiceProgress01: progress01,
    voiceBusy: busy,
    voiceRecording: recording,
    onVoiceToggle: toggleNormal,
    onVoiceEmergencyToggle: toggleEmergency,
    voiceNormalBlockedStart: blocked || slotBusyOther('normal'),
    voiceEmergencyBlockedStart: blocked || slotBusyOther('emergency'),
    voiceMaxSeconds: getMessengerVoiceNormalMaxMs(forcedTransport) / 1000,
    voiceEmergencyMaxSeconds,
    sosVoiceFollowsOnline: sosFollowsOnline,
  }
}
