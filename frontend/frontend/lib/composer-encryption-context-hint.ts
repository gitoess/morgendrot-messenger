'use client'

import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'

export type ComposerEncryptionHintInput = {
  forcedTransport: ForcedTransport
  encrypted: boolean
  /** G2: aktive lokale Gruppe im Composer */
  isGroupChannel?: boolean
  /** Team-Postfach verknüpft + Broadcast bereit */
  groupTeamBroadcastReady?: boolean
}

/**
 * § H.3o.6 (3): Abgrenzung Meshtastic-Kanal-PSK vs. Online-Schloss (IOTA/ECDH).
 * G2: Gruppe — Online/Team-Postfach vs. Funk klar trennen.
 */
export function getComposerEncryptionContextHint(input: ComposerEncryptionHintInput): string | null {
  const { forcedTransport, encrypted, isGroupChannel, groupTeamBroadcastReady } = input

  if (isGroupChannel) {
    if (forcedTransport === 'mesh') {
      if (encrypted) {
        return 'Gruppe · Funk + Schloss: Online-Enc geht nicht über Meshtastic — Schloss aus oder Sendepfad IOTA.'
      }
      return 'Gruppe · Funk: Klartext an Mitglieder/Kanal — kein Team-Postfach-Broadcast.'
    }
    if (forcedTransport === 'internet') {
      if (!groupTeamBroadcastReady) {
        return 'Gruppe · Online: Team-Postfach unter Gruppe verwalten — sonst oft nur lokale Filter / 1:1.'
      }
      if (encrypted) {
        return 'Gruppe · Online + Schloss: 1× Team-Postfach; Inhalt braucht Gruppen-Geheimnis (Handoff), kein ECDH je Mitglied.'
      }
      return 'Gruppe · Online: 1× Klartext an Team-Postfach (Broadcast für alle mit derselben ID).'
    }
    return 'Gruppe: Sendepfad IOTA = Team-Postfach; Funk = Klartext. „Alle“ mischt Erwartungen — lieber IOTA oder Funk wählen.'
  }

  if (forcedTransport === 'mesh') {
    if (encrypted) {
      return 'Funk + Schloss: Online-Verschlüsselung läuft nicht über Meshtastic — Schloss aus oder Sendepfad „online“.'
    }
    return null
  }

  if (forcedTransport === 'internet') {
    if (encrypted) {
      return 'Online · Session Keys+ (Envelope v2): Schutz auf der Mailbox — Rotation unter Einstellungen (§ H.23).'
    }
    return 'Online · Klartext: unverschlüsselt auf Mailbox/IOTA — Schloss aus.'
  }

  if (forcedTransport === 'adhoc') {
    if (encrypted) return null
    return 'Ad-hoc · Klartext — kein Meshtastic-Kanal-PSK.'
  }

  return null
}
