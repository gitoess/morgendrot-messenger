import type { Message } from '@/frontend/lib/types'
import {
  COMPACT_FILE_TXT_PREFIX,
  COMPACT_IMG_PREFIX,
  COMPACT_TXT_PREFIX,
  MORG_AUDIO_V1_PREFIX,
} from '@/frontend/lib/compact-image-wire'

/** Listenfilter: Medienart — unabhängig von Verschl./Richtung. */
export type InboxMediaFilter = 'all' | 'images' | 'audio' | 'files'

function classify(content: string): { image: boolean; audio: boolean; file: boolean } {
  const c = content.trim()
  const lower = c.toLowerCase()
  const image =
    c.includes(COMPACT_IMG_PREFIX) ||
    lower.includes('data:image/') ||
    /\[\[morg_img/i.test(c) ||
    /\[\[morg_compact_img/i.test(c) ||
    /\[\[morg_luma/i.test(c) ||
    /\.gif\b|giphy\.com|tenor\.com/i.test(c) ||
    /\[\[morg_.*video/i.test(c)
  const voice = c.includes(MORG_AUDIO_V1_PREFIX) || /\[\[morg_voice/i.test(c)
  const audio = voice || /\.(opus|ogg|mp3|wav|m4a)\b/i.test(c) || lower.includes('audio/')
  const file =
    c.includes(COMPACT_FILE_TXT_PREFIX) ||
    c.includes(COMPACT_TXT_PREFIX) ||
    /\[\[morg_file/i.test(c) ||
    /\.(pdf|zip|docx?|xlsx?|pptx?)\b/i.test(c)
  return { image, audio, file }
}

export function messageMatchesInboxMediaFilter(m: Message, f: InboxMediaFilter): boolean {
  if (f === 'all') return true
  const k = classify(`${m.content ?? ''}`)
  if (f === 'images') return k.image
  if (f === 'audio') return k.audio
  if (f === 'files') return k.file
  return true
}
