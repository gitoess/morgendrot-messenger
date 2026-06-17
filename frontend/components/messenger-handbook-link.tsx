'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { handbookHeadingIdFromPlainTitle } from '@/components/handbook-markdown'

/** In-App-Handbuch (Markdown); `?file=` wird von `HandbookClient` beim Öffnen ausgewertet. */
export const MESSENGER_HANDBOOK_CHAT_HREF = '/handbook?file=MESSENGER-CHAT-HANDBUCH.md'

/** Sprungmarken — müssen zu `##`-Überschriften in `MESSENGER-CHAT-HANDBUCH.md` passen. */
export const MESSENGER_HB_ANCHOR_PACKAGE_ID = handbookHeadingIdFromPlainTitle('Package-ID und Posteingang')
export const MESSENGER_HB_ANCHOR_HANDSHAKE = handbookHeadingIdFromPlainTitle('Schnell verbinden und /connect')
export const MESSENGER_HB_ANCHOR_HELTEC_MESH = handbookHeadingIdFromPlainTitle(
  'Heltec, Web Bluetooth und Mesh-Posteingang'
)
export const MESSENGER_HB_ANCHOR_HANDSHAKE_TRUST = handbookHeadingIdFromPlainTitle(
  'Handshake Vertrauen und Risiken'
)
export const MESSENGER_HB_ANCHOR_FUNK_KLARTEXT = handbookHeadingIdFromPlainTitle(
  'Funk Klartext Einsatzmodus'
)
export const MESSENGER_HB_ANCHOR_FUNK_KONTEXT = handbookHeadingIdFromPlainTitle(
  'Funk-Kontext Telefonbuch und Mesh-Export'
)
export const MESSENGER_HB_ANCHOR_PATH4 = handbookHeadingIdFromPlainTitle('Pfad 4 LoRa und eigene Verankerung')
export const MESSENGER_HB_ANCHOR_KANALE_MAILBOXEN = handbookHeadingIdFromPlainTitle(
  'Kanäle, Speicher und Mailboxen'
)
export const MESSENGER_HB_ANCHOR_GRUPPENCHAT = handbookHeadingIdFromPlainTitle('Gruppenchat')
export const MESSENGER_HB_ANCHOR_PINNWAND = handbookHeadingIdFromPlainTitle('Pinnwand einbinden')

function handbookMessengerHref(anchor?: string) {
  return anchor ? `${MESSENGER_HANDBOOK_CHAT_HREF}#${anchor}` : MESSENGER_HANDBOOK_CHAT_HREF
}

export function MessengerHandbookChatLink({
  className,
  anchor,
  children,
}: {
  className?: string
  anchor?: string
  children?: ReactNode
}) {
  return (
    <Link
      href={handbookMessengerHref(anchor)}
      className={cn('text-xs font-medium text-primary underline-offset-2 hover:underline', className)}
    >
      {children ?? 'Handbuch: Messenger (Chat)'}
    </Link>
  )
}

/** Kurzer Verweis + Popover mit Link ins Handbuch (kein Langtext in der UI). */
export function MessengerGuideHint({
  ariaLabel,
  teaser,
  anchor,
}: {
  ariaLabel: string
  /** z. B. „Mehr“ */
  teaser: string
  anchor?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={ariaLabel}
        >
          <CircleHelp className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          {teaser}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs leading-relaxed" align="start">
        <p className="mb-2 text-muted-foreground">
          Ausführliche Erklärung im Handbuch (nach erstem Laden oft offline lesbar).
        </p>
        <MessengerHandbookChatLink anchor={anchor} />
      </PopoverContent>
    </Popover>
  )
}
