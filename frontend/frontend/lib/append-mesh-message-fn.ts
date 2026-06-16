import type { Message } from '@/frontend/lib/types'

/** Nach Funk-/Telegram-Versand: lokale Echo-Zeile in den Posteingang. */
export type AppendMeshMessageFn = (msg: Message) => void
