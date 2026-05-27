/**
 * Kanonische ROLE_ID-Bits — identisch zu `src/config.ts` ROLE_BITS.
 * Keine Semantik-Änderung; nur UI/Handoff-Hilfen.
 */
export const HANDOFF_ROLE_BITS = { D: 32, LW: 16, BW: 8, L: 4, S: 2, P: 1 } as const

export type HandoffRoleBitKey = keyof typeof HANDOFF_ROLE_BITS

/** Reihenfolge wie Lite-UI / generate-profiles (D → P). */
export const HANDOFF_ROLE_BIT_ORDER: HandoffRoleBitKey[] = ['D', 'LW', 'BW', 'L', 'S', 'P']

export type HandoffRoleBitUiMeta = {
  key: HandoffRoleBitKey
  value: number
  label: string
  hint: string
}

export const HANDOFF_ROLE_BIT_UI: HandoffRoleBitUiMeta[] = [
  {
    key: 'D',
    value: HANDOFF_ROLE_BITS.D,
    label: 'D — Delegation',
    hint: 'Rollenwechsel /set-role (Kommandant-Profil)',
  },
  {
    key: 'LW',
    value: HANDOFF_ROLE_BITS.LW,
    label: 'LW — Eigenes Gas',
    hint: 'Local Wallet zahlt Chain-Gas',
  },
  {
    key: 'BW',
    value: HANDOFF_ROLE_BITS.BW,
    label: 'BW — Boss-Gas',
    hint: 'Sponsor/Boss zahlt Gas (typisch Einsatz)',
  },
  {
    key: 'L',
    value: HANDOFF_ROLE_BITS.L,
    label: 'L — Empfangen',
    hint: 'Posteingang / passive Nutzung („hören“)',
  },
  {
    key: 'S',
    value: HANDOFF_ROLE_BITS.S,
    label: 'S — Senden',
    hint: 'Nachrichten, Mesh, .morg-pkg, Heartbeat',
  },
  {
    key: 'P',
    value: HANDOFF_ROLE_BITS.P,
    label: 'P — Pinnwand',
    hint: 'Shared Objects / Pinnwand (plus Server-Whitelist)',
  },
]

export function clampRoleId(n: number): number {
  return Math.max(0, Math.min(63, Math.floor(n)))
}

export function roleIdHasBit(roleId: number, key: HandoffRoleBitKey): boolean {
  return (clampRoleId(roleId) & HANDOFF_ROLE_BITS[key]) !== 0
}

export function setRoleIdBit(roleId: number, key: HandoffRoleBitKey, on: boolean): number {
  const id = clampRoleId(roleId)
  const mask = HANDOFF_ROLE_BITS[key]
  return clampRoleId(on ? id | mask : id & ~mask)
}

export function describeRoleIdBits(roleId: number): string {
  const bits: string[] = []
  for (const { key } of HANDOFF_ROLE_BIT_UI) {
    if (roleIdHasBit(roleId, key)) bits.push(key)
  }
  return bits.length ? bits.join('+') : 'keine'
}

/** Preset-Shortcuts (Lite-UI profileList). */
export const HANDOFF_ROLE_ID_PRESETS = [
  { id: 4, label: 'Nur L (Reporter)', bits: 'L' },
  { id: 12, label: 'Passiver Beobachter', bits: 'BW+L' },
  { id: 14, label: 'Standard Helfer', bits: 'BW+L+S' },
  { id: 15, label: 'Helfer + Pinnwand', bits: 'BW+L+S+P' },
  { id: 46, label: 'Kommandant', bits: 'D+BW+L+S' },
] as const
