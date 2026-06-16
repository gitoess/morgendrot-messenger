import type { Message } from '@/frontend/lib/types'
import {
  filterInboxMessagesByPartnerAndDirection,
  type InboxPartnerFilterOpts,
} from '@/frontend/features/inbox/inbox-partner-filter'
import { messagesForContactConversation } from '@/frontend/lib/contact-conversation-filter'
import {
  COMPACT_FILE_TXT_PREFIX,
  COMPACT_IMG_PREFIX,
  COMPACT_TXT_PREFIX,
  MORG_AUDIO_V1_PREFIX,
} from '@/frontend/lib/compact-image-wire'
import { MORG_PINNWAND_V1_PREFIX } from '@/frontend/lib/pinnwand-post-marker'

export type InboxConversationMediaStats = {
  photos: number
  videos: number
  files: number
  audioFiles: number
  sharedLinks: number
  voiceMessages: number
  polls: number
  gifs: number
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi
const GIF_HINT = /\.gif\b|giphy\.com|tenor\.com/i

function classifyMessageContent(content: string): {
  photo: boolean
  video: boolean
  file: boolean
  audio: boolean
  voice: boolean
  link: boolean
  gif: boolean
  poll: boolean
} {
  const c = content.trim()
  const lower = c.toLowerCase()
  const photo =
    c.includes(COMPACT_IMG_PREFIX) ||
    lower.includes('data:image/') ||
    /\[\[morg_img/i.test(c) ||
    /\[\[morg_compact_img/i.test(c) ||
    /\[\[morg_luma/i.test(c)
  const video = /\[\[morg_.*video/i.test(c) || /\.(mp4|webm|mov)\b/i.test(c)
  const file =
    c.includes(COMPACT_FILE_TXT_PREFIX) ||
    c.includes(COMPACT_TXT_PREFIX) ||
    /\[\[morg_file/i.test(c) ||
    /\.(pdf|zip|docx?|xlsx?|pptx?)\b/i.test(c)
  const voice = c.includes(MORG_AUDIO_V1_PREFIX) || /\[\[morg_voice/i.test(c)
  const audio = voice || /\.(opus|ogg|mp3|wav|m4a)\b/i.test(c) || lower.includes('audio/')
  const poll = /\[\[morg_poll/i.test(c) || lower.includes('"type":"poll"')
  const gif = GIF_HINT.test(c)
  const link = URL_RE.test(c) && !c.includes(MORG_PINNWAND_V1_PREFIX)

  return { photo, video, file, audio, voice, link, gif, poll }
}

export function emptyConversationMediaStats(): InboxConversationMediaStats {
  return {
    photos: 0,
    videos: 0,
    files: 0,
    audioFiles: 0,
    sharedLinks: 0,
    voiceMessages: 0,
    polls: 0,
    gifs: 0,
  }
}

export function countConversationMediaStats(messages: readonly Message[]): InboxConversationMediaStats {
  const stats = emptyConversationMediaStats()
  for (const m of messages) {
    const content = `${m.content ?? ''}`
    if (!content.trim()) continue
    const k = classifyMessageContent(content)
    if (k.photo) stats.photos += 1
    if (k.video) stats.videos += 1
    if (k.file) stats.files += 1
    if (k.audio && !k.voice) stats.audioFiles += 1
    if (k.voice) stats.voiceMessages += 1
    if (k.link) stats.sharedLinks += 1
    if (k.poll) stats.polls += 1
    if (k.gif) stats.gifs += 1
  }
  return stats
}

export function messagesForConversationFilter(
  messages: readonly Message[],
  myAddress: string,
  partnerAddress: string | null,
  opts?: InboxPartnerFilterOpts,
  entry?: import('@/frontend/lib/api').ContactMeshEntryClient
): Message[] {
  if (partnerAddress?.trim() && /^0x[a-f0-9]{64}$/i.test(partnerAddress.trim())) {
    return messagesForContactConversation(messages, myAddress, partnerAddress, entry)
  }
  return filterInboxMessagesByPartnerAndDirection([...messages], myAddress, partnerAddress, 'all', opts)
}
