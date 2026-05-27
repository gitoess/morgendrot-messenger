/** Boss-Handoff: LoRa/Meshtastic-Hinweise (§ TRANSPORT-AND-IOTA-LAYERS). */

export const HANDOFF_MESHTASTIC_PSK_SHORT =
  'LoRa nutzt Meshtastic-Verschlüsselung (PSK im Funk-Kanal) — kein separates Morgendrot-Mesh-v2-E2EE.'

export const HANDOFF_MESHTASTIC_PSK_BOSS_NOTE =
  'Vor dem Einsatz: Im Meshtastic-App-Kanal dieselbe PSK für alle Heltecs/Handys setzen. Morgendrot verschlüsselt LoRa nicht separat — Team-Sicherheit = Kanal-PSK + optional Pfad-4-Archiv auf IOTA (Boss-.env).'

export const HANDOFF_README_IOTA_ARCHIV_BLOCK = [
  'LoRa / Meshtastic:',
  `  • ${HANDOFF_MESHTASTIC_PSK_SHORT}`,
  '  • PSK im Kanal vor Feldstart abstimmen (Boss teilt Schlüssel/QR aus Meshtastic).',
  '',
  'IOTA-Archiv (optional, Helfer Simple Mode):',
  '  • Funk-Nachrichten können nach Netz als Kopie in der eigenen Mailbox landen (Pfad 4).',
  '  • Vollautomatisches Delayed LoRa → IOTA = Phase B (Gateway/Queue).',
  '  • Keine volle signierte IOTA-TX im LoRa-Frame.',
].join('\n')
