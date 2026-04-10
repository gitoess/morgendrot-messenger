'use client'

import { useState, useCallback } from 'react'
import {
  Crown,
  Users,
  Radio,
  Send,
  Plus,
  Check,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  setBossRole,
  sendBossCommand,
  meshBuildV2Wires,
  meshDecryptV2Wire,
} from '../../lib/api'
import { MeshFunkPanel } from '@/frontend/components/mesh-funk-panel'
import { useMeshtasticBle } from '@/frontend/hooks/use-meshtastic-ble'
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import { base64ToUint8Array } from '@/frontend/lib/emergency-binary-browser'
import { MESH_V2_BURST_INTER_PACKET_MS_DEFAULT } from '@/frontend/features/send/chat-view-mesh-send'
import type { Message } from '@/frontend/lib/types'

interface BossViewProps {
  variant: 'boss-signer' | 'pinnwand-admin'
}

type Role = 'boss' | 'commander' | 'worker'

interface TeamMember {
  address: string
  role: Role
}

export function BossView({ variant }: BossViewProps) {
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

  const { directory } = useContactDirectory()

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
            <h4 className="mb-4 font-semibold text-foreground">Teammitglied hinzufügen</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm text-muted-foreground">Adresse</label>
                <input
                  type="text"
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

      {variant === 'pinnwand-admin' && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <Radio className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Pinnwand-Verwaltung</h3>
          <p className="mt-2 text-muted-foreground">
            Verwalte hier deine Broadcast-Kanäle und Abonnenten.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Diese Funktion verwendet die gleichen Befehle wie der Boss-Modus,
            aber speziell für Pinnwand-Nachrichten.
          </p>
        </div>
      )}
    </div>
  )
}
