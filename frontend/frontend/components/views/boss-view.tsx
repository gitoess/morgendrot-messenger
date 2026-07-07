'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Crown,
  Users,
  Radio,
  Send,
  Plus,
  Check,
  AlertCircle,
  Package,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BossProject } from '../../../components/projects/boss-project'
import {
  setBossRole,
  sendBossCommand,
  meshBuildV2Wires,
  meshDecryptV2Wire,
  downloadStandaloneSmartphoneHandoffZip,
} from '@/frontend/lib/api'
import type { ApiStatus } from '@/frontend/lib/api'
import { fetchHandoffCurrentIdsFields } from '@/frontend/lib/handoff-export-defaults'
import { MeshFunkPanel } from '@/frontend/components/mesh-funk-panel'
import { useMeshtasticBle } from '@/frontend/hooks/use-meshtastic-ble'
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import { base64ToUint8Array } from '@/frontend/lib/emergency-binary-browser'
import { MESH_V2_BURST_INTER_PACKET_MS_DEFAULT } from '@/frontend/features/send/chat-view-mesh-send'
import type { Message } from '@/frontend/lib/types'

interface BossViewProps {
  variant: 'boss-signer' | 'pinnwand-admin'
  /** Für H.7-Handoff: PACKAGE_ID, Adressen aus Status (optional). */
  apiSnapshot?: ApiStatus | null
}

type Role = 'boss' | 'commander' | 'worker'

interface TeamMember {
  address: string
  role: Role
}

type HandoffPkgSource = 'boss' | 'custom' | 'history'

export function BossView({ variant, apiSnapshot }: BossViewProps) {
  const [address, setAddress] = useState('')
  const [role, setRole] = useState<Role>('worker')
  const [command, setCommand] = useState('')
  const [targets, setTargets] = useState('')
  const [team, setTeam] = useState<TeamMember[]>([])
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [meshPreviewLines, setMeshPreviewLines] = useState<string[]>([])
  const [parallelMesh, setParallelMesh] = useState(false)

  /** § H.7 Export-Assistent (Standalone Smartphone / Wanderer-Bundle). */
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [handoffLabel, setHandoffLabel] = useState('')
  const [handoffRpc, setHandoffRpc] = useState('')
  const [handoffPkgSource, setHandoffPkgSource] = useState<HandoffPkgSource>('boss')
  const [handoffPkgCustom, setHandoffPkgCustom] = useState('')
  const [handoffPkgHistory, setHandoffPkgHistory] = useState(0)
  const [handoffBoss, setHandoffBoss] = useState('')
  const [handoffPartners, setHandoffPartners] = useState('')
  const [handoffMailbox, setHandoffMailbox] = useState('')
  const [handoffCmdReg, setHandoffCmdReg] = useState('')
  const [handoffVaultReg, setHandoffVaultReg] = useState('')
  const [handoffDirectIota, setHandoffDirectIota] = useState('')
  const [handoffBusy, setHandoffBusy] = useState(false)
  const handoffSeeded = useRef(false)

  useEffect(() => {
    if (handoffSeeded.current || !apiSnapshot) return
    handoffSeeded.current = true
    const full = apiSnapshot.myAddressFull?.trim()
    if (full && /^0x[a-fA-F0-9]{64}$/i.test(full)) setHandoffBoss(full)
    const pkg = apiSnapshot.packageId?.trim()
    if (pkg && /^0x[a-fA-F0-9]{64}$/i.test(pkg)) setHandoffPkgCustom(pkg)
    const conn = apiSnapshot.connectedAddresses?.filter(Boolean) ?? []
    if (conn.length) setHandoffPartners(conn.join(', '))
  }, [apiSnapshot])

  useEffect(() => {
    if (!handoffOpen) return
    let cancelled = false
    void fetchHandoffCurrentIdsFields().then((j) => {
      if (cancelled) return
      const mb = j.mailboxId?.trim()
      const cr = j.commandRegistryId?.trim()
      const vr = j.vaultRegistryId?.trim()
      if (mb && /^0x[a-fA-F0-9]{64}$/i.test(mb)) setHandoffMailbox((prev) => prev || mb)
      if (cr && /^0x[a-fA-F0-9]{64}$/i.test(cr)) setHandoffCmdReg((prev) => prev || cr)
      if (vr && /^0x[a-fA-F0-9]{64}$/i.test(vr)) setHandoffVaultReg((prev) => prev || vr)
    })
    return () => {
      cancelled = true
    }
  }, [handoffOpen])

  const { directory } = useContactDirectory()
  const knownAddressSuggestions = useMemo(() => {
    const set = new Set<string>()
    const addIfAddress = (raw: unknown) => {
      const t = String(raw || '').trim()
      if (/^0x[a-fA-F0-9]{64}$/.test(t)) set.add(t)
    }
    addIfAddress(apiSnapshot?.myAddress)
    addIfAddress(apiSnapshot?.myAddressFull)
    const connected = Array.isArray(apiSnapshot?.connectedAddresses) ? apiSnapshot.connectedAddresses : []
    for (const a of connected) addIfAddress(a)
    for (const addr of Object.keys(directory)) addIfAddress(addr)
    for (const m of team) addIfAddress(m.address)
    return Array.from(set)
  }, [apiSnapshot?.connectedAddresses, apiSnapshot?.myAddress, apiSnapshot?.myAddressFull, directory, team])

  const decryptMeshWire = useCallback(async (senderAddress: string, fullWire: Uint8Array) => {
    const { uint8ArrayToBase64 } = await import('@/frontend/lib/emergency-binary-browser')
    const r = await meshDecryptV2Wire(senderAddress, uint8ArrayToBase64(fullWire))
    return r.ok && r.text ? r.text : null
  }, [])

  const appendMeshPreview = useCallback((msg: Message) => {
    const short = (msg.content || '').replace(/\s+/g, ' ').trim().slice(0, 200)
    const line = `${new Date(msg.timestamp).toLocaleTimeString('de-DE')} · ${String(msg.from).slice(0, 14)}… — ${short}`
    setMeshPreviewLines((prev) => [line, ...prev].slice(0, 8))
  }, [])

  const meshtastic = useMeshtasticBle({
    contactDirectory: directory,
    onMeshChatMessage: appendMeshPreview,
    decryptMeshV2Wire: decryptMeshWire,
  })

  const showStatus = (success: boolean, msg: string) => {
    setStatus(success ? 'success' : 'error')
    setStatusMsg(msg)
    setTimeout(() => setStatus('idle'), 5000)
  }

  const handleAddMember = async () => {
    if (!address) return
    setProcessing(true)
    const res = await setBossRole(address, role)
    if (res.ok) {
      setTeam([...team, { address, role }])
      showStatus(true, `${role} hinzugefügt!`)
      setAddress('')
    } else {
      showStatus(false, res.error || 'Fehler')
    }
    setProcessing(false)
  }

  const sendBossMeshBurst = async (targetList: string[], cmd: string) => {
    const payload = `BOSS_RELAY ${JSON.stringify({ targets: targetList, command: cmd })}`
    const b = await meshBuildV2Wires(payload)
    if (!b.ok || !b.wires?.length) {
      throw new Error(b.error || b.message || 'Mesh-Build fehlgeschlagen')
    }
    for (let i = 0; i < b.wires.length; i++) {
      const raw = base64ToUint8Array(b.wires[i]!.wireBase64)
      await meshtastic.sendBinaryV2(raw, 'broadcast')
      if (i + 1 < b.wires.length && MESH_V2_BURST_INTER_PACKET_MS_DEFAULT > 0) {
        await new Promise((r) => setTimeout(r, MESH_V2_BURST_INTER_PACKET_MS_DEFAULT))
      }
    }
  }

  const handleSendCommand = async () => {
    if (!command || !targets) return
    setProcessing(true)
    const targetList = targets.split(',').map((t) => t.trim()).filter(Boolean)
    const cmdTrim = command.trim()

    const res = await sendBossCommand(targetList, cmdTrim)
    let meshOk = false
    let meshErr: string | null = null

    const runMesh = async () => {
      await sendBossMeshBurst(targetList, cmdTrim)
      meshOk = true
    }

    if (parallelMesh && meshtastic.connected) {
      try {
        await runMesh()
      } catch (e) {
        meshErr = e instanceof Error ? e.message : String(e)
      }
    }

    if (res.ok) {
      const extra =
        parallelMesh && meshtastic.connected
          ? meshOk
            ? ' Zusätzlich per Mesh v2 (Broadcast).'
            : meshErr
              ? ` Mesh-Zusatz fehlgeschlagen: ${meshErr}`
              : ''
          : ''
      showStatus(true, `Befehl über API (IOTA) gesendet.${extra}`)
      setCommand('')
      setProcessing(false)
      return
    }

    if (meshtastic.connected && !meshOk) {
      try {
        await runMesh()
        meshErr = null
      } catch (e) {
        meshErr = e instanceof Error ? e.message : String(e)
      }
    }

    if (meshOk) {
      showStatus(true, `API fehlgeschlagen (${res.error ?? '—'}). Befehl per Mesh v2 (Broadcast) gesendet.`)
      setCommand('')
    } else {
      showStatus(false, [res.error || 'API-Fehler', meshErr ? `Mesh: ${meshErr}` : ''].filter(Boolean).join(' · '))
    }
    setProcessing(false)
  }

  const getRoleColor = (r: Role) => {
    switch (r) {
      case 'boss': return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case 'commander': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'worker': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    }
  }

  const getRoleLabel = (r: Role) => {
    switch (r) {
      case 'boss': return 'Boss'
      case 'commander': return 'Kommandant'
      case 'worker': return 'Arbeiter'
    }
  }

  const onHandoffDownload = async () => {
    setHandoffBusy(true)
    const r = await downloadStandaloneSmartphoneHandoffZip({
      handoffLabel: handoffLabel.trim() || undefined,
      rpcUrl: handoffRpc.trim() || undefined,
      packageSource: handoffPkgSource,
      customPackageId: handoffPkgCustom.trim() || undefined,
      historyFromNewest: handoffPkgHistory,
      bossAddress: handoffBoss.trim() || undefined,
      partnerAddresses: handoffPartners.trim() || undefined,
      /** Immer mitsenden, damit leerer String = keine MAILBOX_ID im Handoff (Server fällt sonst auf Boss-.env zurück). */
      mailboxId: handoffMailbox.trim(),
      commandRegistryId: handoffCmdReg.trim() || undefined,
      vaultRegistryId: handoffVaultReg.trim() || undefined,
      nextPublicDirectIotaRpcUrl: handoffDirectIota.trim() || undefined,
    })
    setHandoffBusy(false)
    if (r.ok) showStatus(true, 'ZIP gespeichert (Handoff-.env + README).')
    else showStatus(false, r.error || 'Download fehlgeschlagen')
  }

  if (variant === 'pinnwand-admin') {
    return <BossProject variant="pinnwand-admin" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
          {variant === 'boss-signer' ? (
            <Crown className="h-6 w-6" />
          ) : (
            <Radio className="h-6 w-6" />
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {variant === 'boss-signer' ? 'Boss-Modus' : 'Pinnwand-Admin'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {variant === 'boss-signer'
              ? 'Steuere viele Geräte mit einem Befehl (API + optional Mesh)'
              : 'Verwalte Broadcast-Kanäle'}
          </p>
        </div>
      </div>

      {status !== 'idle' && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-3 text-sm font-medium',
            status === 'success'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          )}
        >
          {status === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {statusMsg}
        </div>
      )}

      {variant === 'boss-signer' && (
        <>
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-3 font-semibold text-foreground">So funktioniert die Hierarchie</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className={cn('rounded-lg border p-3', getRoleColor('boss'))}>
                <Crown className="mb-2 h-5 w-5" />
                <span className="font-medium">Boss</span>
                <p className="text-xs opacity-80">Kann alle steuern, signiert Transaktionen</p>
              </div>
              <div className={cn('rounded-lg border p-3', getRoleColor('commander'))}>
                <Users className="mb-2 h-5 w-5" />
                <span className="font-medium">Kommandant</span>
                <p className="text-xs opacity-80">Kann Arbeiter steuern</p>
              </div>
              <div className={cn('rounded-lg border p-3', getRoleColor('worker'))}>
                <div className="mb-2 h-5 w-5 rounded-full border-2 border-current" />
                <span className="font-medium">Arbeiter</span>
                <p className="text-xs opacity-80">Führt Befehle aus</p>
              </div>
            </div>
          </div>

          <MeshFunkPanel
            ble={meshtastic}
            previewLines={meshPreviewLines}
            contextHint={
              'Mit „Parallel per Mesh“ wird derselbe Befehl zusätzlich als verschlüsselter Mesh-v2-Broadcast gesendet (wie im Chat). Empfänger müssen ihn wie eine Nachricht auswerten – die API-Route /boss-command bleibt der kanonische Weg für die Kette.'
            }
          />

          <div className="rounded-xl border border-border bg-card p-4">
            <button
              type="button"
              onClick={() => setHandoffOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <Package className="h-5 w-5 text-muted-foreground" />
                Export-Assistent: Standalone Smartphone (H.7)
              </span>
              <span className="text-xs text-muted-foreground">{handoffOpen ? 'Einklappen' : 'Aufklappen'}</span>
            </button>
            {handoffOpen ? (
              <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
                <p className="text-xs text-muted-foreground">
                  ZIP mit öffentlicher Handoff-<span className="font-mono">.env</span> und Kurz-README — ohne Seed.
                  Bundle vorher im Repo bauen:{' '}
                  <span className="font-mono">npm run bundle:standalone-smartphone</span> →{' '}
                  <span className="font-mono">exports/morgendrot-standalone-smartphone/</span>.
                </p>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Bezeichnung (Dateiname)</label>
                  <input
                    value={handoffLabel}
                    onChange={(e) => setHandoffLabel(e.target.value)}
                    placeholder="z. B. Feldtest-Nord"
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">RPC_URL (optional, sonst Testnet-Default)</label>
                  <input
                    value={handoffRpc}
                    onChange={(e) => setHandoffRpc(e.target.value)}
                    placeholder="https://api.testnet.iota.cafe"
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs text-foreground"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">PACKAGE_ID</span>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="handoff-pkg"
                        checked={handoffPkgSource === 'boss'}
                        onChange={() => setHandoffPkgSource('boss')}
                      />
                      Aus Boss-.env
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="handoff-pkg"
                        checked={handoffPkgSource === 'custom'}
                        onChange={() => setHandoffPkgSource('custom')}
                      />
                      Manuell
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="handoff-pkg"
                        checked={handoffPkgSource === 'history'}
                        onChange={() => setHandoffPkgSource('history')}
                      />
                      Historie
                    </label>
                  </div>
                  {handoffPkgSource === 'custom' ? (
                    <input
                      value={handoffPkgCustom}
                      onChange={(e) => setHandoffPkgCustom(e.target.value)}
                      placeholder="0x…64 Hex"
                      className="mt-2 w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs text-foreground"
                    />
                  ) : null}
                  {handoffPkgSource === 'history' ? (
                    <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      Index von neu:{' '}
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={handoffPkgHistory}
                        onChange={(e) => setHandoffPkgHistory(parseInt(e.target.value, 10) || 0)}
                        className="w-16 rounded border border-border bg-input px-2 py-1 text-foreground"
                      />
                    </label>
                  ) : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">BOSS_ADDRESS (0x+64)</label>
                  <input
                  list="boss-address-suggestions"
                    value={handoffBoss}
                    onChange={(e) => setHandoffBoss(e.target.value)}
                    placeholder="0x…"
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Partner-Adressen (Komma, optional — sonst Helfer ergänzt)
                  </label>
                  <textarea
                    value={handoffPartners}
                    onChange={(e) => setHandoffPartners(e.target.value)}
                    rows={2}
                    placeholder="0x…, 0x…"
                    className="w-full resize-y rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs text-foreground"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">MAILBOX_ID (optional)</label>
                    <input
                      value={handoffMailbox}
                      onChange={(e) => setHandoffMailbox(e.target.value)}
                      className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">COMMAND_REGISTRY_ID (optional)</label>
                    <input
                      value={handoffCmdReg}
                      onChange={(e) => setHandoffCmdReg(e.target.value)}
                      className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">VAULT_REGISTRY_ID (optional)</label>
                    <input
                      value={handoffVaultReg}
                      onChange={(e) => setHandoffVaultReg(e.target.value)}
                      className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">NEXT_PUBLIC_DIRECT_IOTA_RPC_URL</label>
                    <input
                      value={handoffDirectIota}
                      onChange={(e) => setHandoffDirectIota(e.target.value)}
                      placeholder="optional PWA Light-Client"
                      className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs text-foreground"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={handoffBusy}
                  onClick={() => void onHandoffDownload()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {handoffBusy ? 'ZIP wird erzeugt…' : 'ZIP herunterladen'}
                </button>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-4 font-semibold text-foreground">Teammitglied hinzufügen</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm text-muted-foreground">Adresse</label>
                <input
                  type="text"
                  list="boss-address-suggestions"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Rolle</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="worker">Arbeiter</option>
                  <option value="commander">Kommandant</option>
                  <option value="boss">Boss</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleAddMember}
              disabled={processing || !address}
              className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {processing ? 'Wird hinzugefügt...' : 'Hinzufügen'}
            </button>
          </div>

          {team.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border p-4">
                <h4 className="font-semibold text-foreground">Mein Team</h4>
              </div>
              <ul className="divide-y divide-border">
                {team.map((member, i) => (
                  <li key={i} className="flex items-center justify-between p-4">
                    <span className="font-mono text-sm text-foreground">
                      {member.address.slice(0, 10)}...{member.address.slice(-6)}
                    </span>
                    <span className={cn('rounded-full px-3 py-1 text-xs font-medium', getRoleColor(member.role))}>
                      {getRoleLabel(member.role)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-4 font-semibold text-foreground">Befehl senden</h4>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">
                  Zieladressen (Komma-getrennt)
                </label>
                <input
                  type="text"
                  value={targets}
                  onChange={(e) => setTargets(e.target.value)}
                  placeholder="0x..., 0x..., 0x..."
                  className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Befehl</label>
                <textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="z.B. /turn-on oder /set-temperature 22"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={parallelMesh}
                  onChange={(e) => setParallelMesh(e.target.checked)}
                  className="rounded border-border"
                />
                Parallel per Mesh (Broadcast v2) mitsenden, wenn Heltec verbunden
              </label>
              <button
                onClick={handleSendCommand}
                disabled={processing || !command || !targets}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {processing ? 'Wird gesendet...' : 'Befehl senden'}
              </button>
              <p className="text-[11px] text-muted-foreground">
                Ohne Haken: zuerst API. Wenn die API fehlschlägt und Heltec verbunden ist, wird automatisch ein
                Mesh-Versuch gestartet (Fallback).
              </p>
            </div>
          </div>
        </>
      )}

      <datalist id="boss-address-suggestions">
        {knownAddressSuggestions.map((addr) => (
          <option key={addr} value={addr} />
        ))}
      </datalist>
    </div>
  )
}
