'use client'

/**
 * Clientseitiger Handoff-Parts-Build (Boss-APK ohne PC, Weg A Scheibe 1).
 */
import type {
  StandaloneSmartphoneHandoffPartsOk,
  StandaloneSmartphoneHandoffPartsResult,
  StandaloneSmartphoneHandoffZipBody,
} from '@/frontend/lib/api/standalone-smartphone-handoff'
import { readHandoffExtras } from '@/frontend/lib/handoff-extras'
import type { BossHandoffExportContext } from '@/frontend/lib/resolve-boss-handoff-export-context'
import {
  buildHandoffRuntimeConfigPayload,
  parseMessengerCapabilitiesOverride,
} from '@morgendrot/shared/messenger-capabilities-matrix'
import {
  buildStandaloneSmartphoneHandoffEnv,
  buildStandaloneSmartphoneHandoffReadme,
  normalizeHandoffAddress,
  resolveHandoffExportPackageId,
} from '@morgendrot/shared/standalone-smartphone-handoff-env'

function resolveExportTtlDays(
  body: StandaloneSmartphoneHandoffZipBody,
  ctx: BossHandoffExportContext
): number | undefined {
  if (body.exportTtlDays != null && Number.isFinite(body.exportTtlDays)) {
    return Math.max(0, Math.min(3650, Math.floor(body.exportTtlDays)))
  }
  return ctx.exportTtlDays
}

function resolveExportEnablePurge(
  body: StandaloneSmartphoneHandoffZipBody,
  ctx: BossHandoffExportContext
): boolean {
  if (Object.prototype.hasOwnProperty.call(body, 'exportEnablePurge')) {
    return body.exportEnablePurge !== false
  }
  return ctx.exportEnablePurge
}

/** Baut Handoff-Teile im Browser — gleiches Ergebnisformat wie POST `format=parts`. */
export function buildHandoffPartsLocally(
  body: StandaloneSmartphoneHandoffZipBody,
  bossContext: BossHandoffExportContext
): StandaloneSmartphoneHandoffPartsResult {
  if (!bossContext.ready) {
    const hint = bossContext.missing.length
      ? `${bossContext.missing.join(', ')} fehlt`
      : 'Boss-Kontext unvollständig'
    return { ok: false, error: `Handoff offline: ${hint} — zuerst Wallet & Netzwerk einrichten.` }
  }

  const packageSource =
    body.packageSource === 'custom' ? 'custom' : body.packageSource === 'history' ? 'history' : 'boss'
  const pkgRes = resolveHandoffExportPackageId({
    source: packageSource,
    customPackageId: body.customPackageId,
    bossPackageId: bossContext.packageId,
  })
  if (!pkgRes.ok) return { ok: false, error: pkgRes.error }

  const bossRaw = String(body.bossAddress ?? bossContext.bossAddress).trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(bossRaw)) {
    return { ok: false, error: 'bossAddress / Boss MY_ADDRESS: 0x+64Hex nötig.' }
  }
  const bossAddress = normalizeHandoffAddress(bossRaw)

  const rpcUrl = String(body.rpcUrl ?? bossContext.rpcUrl).trim() || 'https://api.testnet.iota.cafe'
  const partnerAddresses = String(body.partnerAddresses ?? '').trim()
  const mailboxIdField = Object.prototype.hasOwnProperty.call(body, 'mailboxId')
    ? String(body.mailboxId ?? '').trim()
    : bossContext.mailboxId
  const teamMailboxIds = String(body.teamMailboxIds ?? '').trim()
  const commandRegistryId = String(
    body.commandRegistryId ?? bossContext.commandRegistryId ?? ''
  ).trim()
  const vaultRegistryId = String(body.vaultRegistryId ?? bossContext.vaultRegistryId ?? '').trim()
  const nextPublicDirectIotaRpcUrl = String(
    body.nextPublicDirectIotaRpcUrl ?? bossContext.directIotaRpcUrl
  ).trim()
  const handoffLabel = String(body.handoffLabel ?? '').trim()
  const messengerGroupHandoff = String(body.messengerGroupHandoff ?? '').trim()
  const helperRoleRaw = String(body.helperRole ?? '').trim().toLowerCase()
  const helperRole =
    helperRoleRaw === 'arbeiter' || helperRoleRaw === 'kommandant' ? helperRoleRaw : 'messenger'
  const roleIdParsed = body.roleId != null ? Number(body.roleId) : NaN
  const roleId = Number.isFinite(roleIdParsed) ? roleIdParsed : undefined
  const deploymentProfile = String(body.deploymentProfile ?? '').trim() || undefined
  const uiVariantRaw = String(body.uiVariant ?? '').trim().toLowerCase()
  const uiVariant =
    uiVariantRaw === 'messenger' ? 'messenger' : uiVariantRaw === 'full' ? 'full' : undefined
  const transportProfileRaw = String(body.transportProfile ?? '').trim().toLowerCase()
  const transportProfile =
    transportProfileRaw === 'iota-anchored' || transportProfileRaw === 'iota-full'
      ? transportProfileRaw
      : transportProfileRaw === 'mesh-first'
        ? 'mesh-first'
        : undefined
  const simpleMode =
    body.simpleMode === true || body.simpleMode === false ? body.simpleMode : undefined
  const exportTtlDays = resolveExportTtlDays(body, bossContext)
  const exportEnablePurge = resolveExportEnablePurge(body, bossContext)

  let envContent: string
  let runtimeConfigContent: string
  try {
    envContent = buildStandaloneSmartphoneHandoffEnv({
      rpcUrl,
      packageId: pkgRes.packageId,
      bossAddress,
      partnerAddresses: partnerAddresses || undefined,
      mailboxId: mailboxIdField || undefined,
      teamMailboxIds: teamMailboxIds || undefined,
      commandRegistryId: commandRegistryId || undefined,
      vaultRegistryId: vaultRegistryId || undefined,
      nextPublicDirectIotaRpcUrl: nextPublicDirectIotaRpcUrl || undefined,
      helperRole,
      roleId,
      deploymentProfile,
      uiVariant,
      transportProfile,
      simpleMode,
      handoffLabel: handoffLabel || undefined,
      messengerGroupHandoff: messengerGroupHandoff || undefined,
      exportTtlDays,
      exportEnablePurge,
      einsatzChainMode: String(body.einsatzChainMode ?? bossContext.einsatzChainMode).trim() || undefined,
      mainnetRpcUrl: String(body.mainnetRpcUrl ?? '').trim() || undefined,
    })
    const resolvedRoleId = roleId != null && Number.isFinite(roleId) ? roleId : 14
    const capOverride = parseMessengerCapabilitiesOverride(body.capabilitiesOverride)
    runtimeConfigContent =
      JSON.stringify(
        buildHandoffRuntimeConfigPayload({
          roleId: resolvedRoleId,
          simpleMode,
          transportProfile: transportProfile ?? 'mesh-first',
          hierarchyRole: helperRole,
          override: capOverride ?? undefined,
        }),
        null,
        2
      ) + '\n'
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }

  const createdAtIso = new Date().toISOString()
  const readmeExtra = String(body.readmeExtra ?? '').trim() || undefined
  const handoffExtras = readHandoffExtras()
  const handoffExtrasJson = handoffExtras ? `${JSON.stringify(handoffExtras, null, 2)}\n` : ''
  const readme = buildStandaloneSmartphoneHandoffReadme({
    handoffLabel,
    createdAtIso,
    packageId: pkgRes.packageId,
    rpcUrl,
    bossAddress,
    helperRole,
    teamMailboxIds: teamMailboxIds || undefined,
    readmeExtra:
      (readmeExtra ? `${readmeExtra}\n\n` : '') +
      (handoffExtrasJson ? 'Telegram-Alarmgruppe: siehe .morgendrot-handoff-extras.json (optional).' : ''),
  })
  const slug =
    (handoffLabel || 'handoff').replace(/[^\wäöüÄÖÜß.-]/gi, '_').slice(0, 48) || 'handoff'
  const day = createdAtIso.slice(0, 10).replace(/-/g, '')

  const ok: StandaloneSmartphoneHandoffPartsOk = {
    ok: true,
    envContent,
    runtimeConfigContent,
    readme,
    handoffExtras: handoffExtras ?? undefined,
    handoffLabel: handoffLabel || undefined,
    createdAtIso,
    packageId: pkgRes.packageId,
    filenameBase: `morgendrot-standalone-handoff-${slug}-${day}`,
  }
  return ok
}
