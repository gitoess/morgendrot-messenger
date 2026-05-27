import type { HandoffHelperRole } from '@/frontend/lib/handoff-export-presets'
import { describeRoleIdBits } from '@/frontend/lib/handoff-role-id-bits'
import type { EinsatzRoleTemplate } from '@morgendrot/shared/einsatz-role-templates'

/** Gültige `templates[].id` (wie `parseEinsatzRoleTemplates`). */
export function slugifyHandoffTemplateId(label: string): string {
  let s = label
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
  if (!s) return 'vorlage'
  if (!/^[a-z0-9]/.test(s)) s = `v-${s}`
  if (!/[a-z0-9]$/.test(s)) s = `${s.replace(/-+$/, '')}0`
  if (s.length > 63) s = s.slice(0, 63).replace(/-+$/, '')
  if (!/[a-z0-9]$/.test(s)) s = `${s}0`
  return s
}

export function helperRoleToChainRole(role: HandoffHelperRole): EinsatzRoleTemplate['chainRole'] {
  switch (role) {
    case 'kommandant':
      return 'kommandant'
    case 'arbeiter':
      return 'arbeiter'
    default:
      return 'user'
  }
}

export function buildEinsatzTemplateFromHandoffExport(input: {
  id: string
  label: string
  helperRole: HandoffHelperRole
  roleId: number
  deploymentChannelTag?: string
}): EinsatzRoleTemplate {
  const id = slugifyHandoffTemplateId(input.id || input.label)
  const label = input.label.trim().slice(0, 120) || 'Handoff-Vorlage'
  const tag = input.deploymentChannelTag?.trim().slice(0, 120)
  return {
    id,
    label,
    chainRole: helperRoleToChainRole(input.helperRole),
    roleId: Math.max(0, Math.min(63, Math.floor(input.roleId))),
    ...(tag ? { defaultDeploymentChannelTag: tag } : {}),
  }
}

export function suggestHandoffTemplateLabel(input: {
  bezeichnung: string
  presetLabel: string
  roleId: number
  helperRole: HandoffHelperRole
}): string {
  const bez = input.bezeichnung.trim()
  if (bez) return bez.slice(0, 120)
  const bits = describeRoleIdBits(input.roleId)
  return `${input.presetLabel} · ${input.helperRole} · ${bits}`.slice(0, 120)
}

export function upsertEinsatzRoleTemplate(
  existing: EinsatzRoleTemplate[],
  next: EinsatzRoleTemplate
): EinsatzRoleTemplate[] {
  const without = existing.filter((t) => t.id !== next.id)
  return [...without, next]
}
