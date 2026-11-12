'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Lock, Unlock, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ContactPhonebookPickerDialog } from '@/frontend/components/contact-phonebook-picker-dialog'
import {
  createMessengerGroupId,
  deleteMessengerGroup,
  getActiveMessengerGroup,
  parseGroupMemberInput,
  formatGroupMembersDisplay,
  readActiveGroupId,
  readMessengerGroups,
  upsertMessengerGroup,
  writeActiveGroupId,
  type MessengerGroupDefinition,
} from '@/frontend/lib/messenger-group-store'
import { readMyTeamMailboxes, addMyTeamMailbox, suggestNextTeamMailboxLabel } from '@/frontend/lib/my-team-mailbox-store'
import { createTeamMailboxOnChain } from '@/frontend/lib/create-team-mailbox-on-chain'
import { normalizeMeshtasticChannelIndex } from '@/frontend/lib/meshtastic-channel-index'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import {
  createTeamBroadcastKey,
  hasTeamBroadcastKey,
  readTeamBroadcastKeyEpoch,
} from '@/frontend/lib/team-broadcast-key-store'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'

export type GroupHandshakeActions = {
  sending: boolean
  connectedAddresses: string[]
  onHandshakeForAddress: (address: string) => void | Promise<void>
  onConnectAcceptForAddress?: (address: string) => void | Promise<void>
}

export type ChatViewGroupPanelProps = {
  contactDirectory: Record<string, ContactMeshEntryClient>
  /** Meshtastic Secondary nur bei Sendepfad „funk“. */
  forcedTransport?: ForcedTransport
  teamMailboxCreateAllowed?: boolean
  /** Handoff-Runtime: neue Gruppe anlegen / erste Speicherung. */
  groupCreateAllowed?: boolean
  onGroupsChanged?: () => void
  encrypted?: boolean
  onEncryptedChange?: (encrypted: boolean) => void
  embedded?: boolean
  /** Pairwise-Handshake: Adressen kommen aus der Mitgliederliste (kein zweites Adressfeld). */
  handshake?: GroupHandshakeActions | null
}

export function ChatViewGroupPanel(p: ChatViewGroupPanelProps) {
  const {
    contactDirectory,
    forcedTransport,
    teamMailboxCreateAllowed = false,
    groupCreateAllowed = true,
    onGroupsChanged,
    encrypted = false,
    onEncryptedChange,
    embedded = false,
    handshake = null,
  } = p
  const showMeshtasticSecondary = forcedTransport === 'mesh'
  const groupCreateBlockedTitle = 'Keine Berechtigung zum Anlegen neuer Gruppen (Handoff-Rechte).'
  const [plainWarnOpen, setPlainWarnOpen] = useState(false)
  const [groups, setGroups] = useState<MessengerGroupDefinition[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const creatingNewGroup = !activeId
  const groupCreateBlocked = creatingNewGroup && !groupCreateAllowed
  const [name, setName] = useState('')
  const [membersText, setMembersText] = useState('')
  const [secondaryChannelIndex, setSecondaryChannelIndex] = useState('')
  const [secondaryChannelName, setSecondaryChannelName] = useState('')
  const [secondaryPskRef, setSecondaryPskRef] = useState('')
  const [teamMailboxObjectId, setTeamMailboxObjectId] = useState('')
  const [teamMbBusy, setTeamMbBusy] = useState(false)
  const [setupBusy, setSetupBusy] = useState(false)
  const [copiedTeamMbId, setCopiedTeamMbId] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [phonebookPickerOpen, setPhonebookPickerOpen] = useState(false)
  const [teamKeyTick, setTeamKeyTick] = useState(0)
  const [showAdvancedMailbox, setShowAdvancedMailbox] = useState(false)

  const reload = useCallback(() => {
    setGroups(readMessengerGroups())
    setActiveId(readActiveGroupId())
    const active = getActiveMessengerGroup()
    if (active) {
      setName(active.name)
      setMembersText(formatGroupMembersDisplay(contactDirectory, active.memberAddresses))
      setSecondaryChannelIndex(
        active.secondaryChannel?.channelIndex != null ? String(active.secondaryChannel.channelIndex) : ''
      )
      setSecondaryChannelName(active.secondaryChannel?.channelName ?? '')
      setSecondaryPskRef(active.secondaryChannel?.pskRef ?? '')
      setTeamMailboxObjectId(active.teamMailboxObjectId ?? '')
    } else {
      setName('')
      setMembersText('')
      setSecondaryChannelIndex('')
      setSecondaryChannelName('')
      setSecondaryPskRef('')
      setTeamMailboxObjectId('')
    }
  }, [contactDirectory])

  useEffect(() => {
    reload()
  }, [reload])

  const memberAddresses = useMemo(
    () => parseGroupMemberInput(membersText, contactDirectory),
    [membersText, contactDirectory]
  )

  const persistGroupDefinition = useCallback(
    (opts?: { teamMbOverride?: string; successMsg?: string }): boolean => {
      if (memberAddresses.length === 0) return false
      const id = activeId ?? createMessengerGroupId()
      const normalizedSecondaryIndex = normalizeMeshtasticChannelIndex(secondaryChannelIndex)
      const secondaryName = secondaryChannelName.trim()
      const secondaryPsk = secondaryPskRef.trim()
      const teamMb = (opts?.teamMbOverride ?? teamMailboxObjectId).trim()
      const prior =
        (activeId ? readMessengerGroups().find((g) => g.id === activeId) : null) ?? getActiveMessengerGroup()
      upsertMessengerGroup({
        id,
        name: name.trim() || `Gruppe (${memberAddresses.length})`,
        memberAddresses,
        ...(prior?.streamsAnchorId ? { streamsAnchorId: prior.streamsAnchorId } : {}),
        ...(teamMb && /^0x[a-fA-F0-9]{64}$/i.test(teamMb)
          ? { teamMailboxObjectId: teamMb.toLowerCase(), useTeamBroadcast: true }
          : {}),
        ...(normalizedSecondaryIndex != null || secondaryName || secondaryPsk
          ? {
              secondaryChannel: {
                ...(normalizedSecondaryIndex != null ? { channelIndex: normalizedSecondaryIndex } : {}),
                ...(secondaryName ? { channelName: secondaryName } : {}),
                ...(secondaryPsk ? { pskRef: secondaryPsk } : {}),
              },
            }
          : {}),
      })
      writeActiveGroupId(id)
      reload()
      onGroupsChanged?.()
      if (opts?.successMsg) setMsg(opts.successMsg)
      return true
    },
    [
      activeId,
      memberAddresses,
      name,
      onGroupsChanged,
      reload,
      secondaryChannelIndex,
      secondaryChannelName,
      secondaryPskRef,
      teamMailboxObjectId,
    ]
  )

  const saveGroup = useCallback(() => {
    if (!persistGroupDefinition({ successMsg: 'Gruppe gespeichert.' })) {
      setMsg('Mindestens ein Mitglied aus dem Telefonbuch oder eine 0x-Adresse eintragen.')
    }
  }, [persistGroupDefinition])

  const selectGroup = useCallback(
    (id: string) => {
      writeActiveGroupId(id)
      reload()
      onGroupsChanged?.()
    },
    [onGroupsChanged, reload]
  )

  const newGroup = useCallback(() => {
    writeActiveGroupId(null)
    setActiveId(null)
    setName('')
    setMembersText('')
    setSecondaryChannelIndex('')
    setSecondaryChannelName('')
    setSecondaryPskRef('')
    setTeamMailboxObjectId('')
    setMsg('Neue Gruppe: Name + Mitglieder, dann speichern.')
  }, [])

  const removeGroup = useCallback(() => {
    if (!activeId) return
    deleteMessengerGroup(activeId)
    setMsg('Gruppe gelöscht.')
    reload()
    onGroupsChanged?.()
  }, [activeId, onGroupsChanged, reload])

  const applyPhonebookSelection = useCallback(
    (picked: string[]) => {
      const merged = parseGroupMemberInput([membersText, ...picked].join('\n'), contactDirectory)
      setMembersText(formatGroupMembersDisplay(contactDirectory, merged))
      setMsg(`${picked.length} Kontakt(e) übernommen — Speichern nicht vergessen.`)
    },
    [membersText, contactDirectory]
  )

  const active = getActiveMessengerGroup()
  const teamMailboxOptions = readMyTeamMailboxes()

  const linkTeamMailboxToGroup = useCallback(
    (objectId: string, successMsg: string) => {
      const id = objectId.trim()
      if (!/^0x[a-fA-F0-9]{64}$/i.test(id)) return
      setTeamMailboxObjectId(id)
      if (persistGroupDefinition({ teamMbOverride: id, successMsg })) return
      setMsg('Postfach gesetzt — zuerst Mitglieder eintragen, dann speichern.')
    },
    [persistGroupDefinition]
  )

  const createTeamMailboxForGroup = useCallback(async (): Promise<string | null> => {
    if (!teamMailboxCreateAllowed) return null
    const label =
      typeof window !== 'undefined'
        ? window.prompt('Name des Team-Postfachs:', suggestNextTeamMailboxLabel())?.trim()
        : ''
    const r = await createTeamMailboxOnChain()
    if (!r.ok || !r.objectId) {
      setMsg(r.error || r.message || 'Team-Postfach konnte nicht erstellt werden.')
      return null
    }
    addMyTeamMailbox({
      objectId: r.objectId,
      ...(label ? { label } : {}),
      ...(r.digest ? { digest: r.digest } : {}),
    })
    linkTeamMailboxToGroup(r.objectId, 'Team-Postfach erstellt und mit der Gruppe verknüpft.')
    return r.objectId
  }, [teamMailboxCreateAllowed, linkTeamMailboxToGroup])

  /** Ein Klick: speichern → Postfach (falls fehlt) → Gruppen-Geheimnis. */
  const setupTeamChannel = useCallback(async () => {
    if (setupBusy) return
    if (memberAddresses.length === 0) {
      setMsg('Zuerst Mitglieder eintragen (Aus Telefonbuch).')
      return
    }
    setSetupBusy(true)
    try {
      if (!persistGroupDefinition()) {
        setMsg('Gruppe konnte nicht gespeichert werden.')
        return
      }
      let mb = teamMailboxObjectId.trim()
      if (!/^0x[a-fA-F0-9]{64}$/i.test(mb)) {
        if (!teamMailboxCreateAllowed) {
          setMsg('Kein Postfach — Tresor entsperren oder Object-ID unter „Erweitert“ einfügen.')
          return
        }
        setTeamMbBusy(true)
        const created = await createTeamMailboxForGroup()
        setTeamMbBusy(false)
        if (!created) return
        mb = created
      }
      const key = createTeamBroadcastKey(mb)
      if (!key.ok) {
        setMsg(key.error)
        return
      }
      setTeamKeyTick((n) => n + 1)
      setMsg(
        key.created
          ? `Fertig: Postfach + Gruppen-Geheimnis (Epoch ${key.epoch}). Geheimnis per Handoff-ZIP an Mitglieder — kein Tippen wie ein Chat-Passwort.`
          : `Bereit: Postfach + Gruppen-Geheimnis (Epoch ${key.epoch}) lokal vorhanden.`
      )
    } finally {
      setSetupBusy(false)
      setTeamMbBusy(false)
    }
  }, [
    setupBusy,
    memberAddresses.length,
    persistGroupDefinition,
    teamMailboxObjectId,
    teamMailboxCreateAllowed,
    createTeamMailboxForGroup,
  ])

  const copyTeamMailboxId = useCallback(async (id: string) => {
    try {
      await navigator.clipboard.writeText(id.trim())
      setCopiedTeamMbId(true)
      window.setTimeout(() => setCopiedTeamMbId(false), 2000)
    } catch {
      setMsg('Kopieren fehlgeschlagen — Object-ID manuell markieren.')
    }
  }, [])

  const savedTeamMbId = active?.teamMailboxObjectId?.trim() ?? ''
  const teamMbDirty =
    !!teamMailboxObjectId.trim() &&
    teamMailboxObjectId.trim().toLowerCase() !== savedTeamMbId.toLowerCase()

  const mbOk = /^0x[a-fA-F0-9]{64}$/i.test(teamMailboxObjectId.trim())
  const teamKeyReady = mbOk && hasTeamBroadcastKey(teamMailboxObjectId)
  void teamKeyTick
  const teamKeyEpoch = teamKeyReady ? readTeamBroadcastKeyEpoch(teamMailboxObjectId) : null

  const connectedSet = useMemo(
    () => new Set((handshake?.connectedAddresses ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean)),
    [handshake?.connectedAddresses]
  )

  const handshakeMembers = useMemo(
    () => memberAddresses.map((a) => a.trim().toLowerCase()).filter((a) => /^0x[a-f0-9]{64}$/.test(a)),
    [memberAddresses]
  )

  return (
    <section className={cn(embedded ? 'space-y-4 text-sm' : 'mb-4 space-y-4 rounded-lg border border-border bg-card/40 px-3 py-3')}>
      {onEncryptedChange ? (
        <AlertDialog open={plainWarnOpen} onOpenChange={setPlainWarnOpen}>
          <AlertDialogContent className="border-orange-500/40 bg-orange-950/20 sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-orange-100">Unverschlüsselt in der Gruppe?</AlertDialogTitle>
              <AlertDialogDescription className="text-orange-50/95">
                Klartext liegt öffentlich auf der Chain. Ein gemeinsames Team-Postfach (1× Nachricht für alle) braucht
                Klartext-Transport — das Gruppen-Geheimnis schützt den Inhalt dann lokal/geteilt, nicht per Handshake.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                className="bg-orange-600 text-white hover:bg-orange-500"
                onClick={() => onEncryptedChange(false)}
              >
                Verstanden, fortfahren
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-foreground/70" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">{embedded ? 'Gruppe' : 'Gruppe'}</h3>
          {active ? (
            <span className="text-xs text-muted-foreground">· {active.memberAddresses.length} Mitglieder</span>
          ) : null}
        </div>
        {onEncryptedChange && !embedded ? (
          <div
            className={cn(
              'inline-flex rounded-md border border-border bg-background p-0.5',
              encrypted && 'ring-1 ring-emerald-500/30'
            )}
            role="group"
            aria-label="Verschlüsselung"
          >
            <button
              type="button"
              disabled={forcedTransport === 'mesh'}
              title={
                forcedTransport === 'mesh'
                  ? 'Verschlüsselung nur über Sendepfad online. Funk = Klartext.'
                  : undefined
              }
              onClick={() => onEncryptedChange(true)}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium',
                encrypted ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground',
                forcedTransport === 'mesh' && 'cursor-not-allowed opacity-45'
              )}
            >
              <Lock className="h-3 w-3" aria-hidden />
              1:1 je Person
            </button>
            <button
              type="button"
              onClick={() => {
                if (encrypted) setPlainWarnOpen(true)
              }}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium',
                !encrypted ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Unlock className="h-3 w-3" aria-hidden />
              Gemeinsames Postfach
            </button>
          </div>
        ) : null}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Mitglieder → speichern → „Kanal einrichten“. Geheimnis = Schlüssel fürs Team-Postfach (Handoff), kein
        Nachrichten-Passwort.
      </p>

      {groups.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => selectGroup(g.id)}
              className={
                activeId === g.id
                  ? 'rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground'
                  : 'rounded-md border border-border px-2 py-1 text-xs hover:bg-muted'
              }
            >
              {g.name} ({g.memberAddresses.length})
            </button>
          ))}
        </div>
      ) : null}

      {/* 1 — Name & Mitglieder */}
      <div className="space-y-2 rounded-lg border border-border bg-background/50 px-3 py-3">
        <p className="text-xs font-semibold text-foreground">1 · Name & Mitglieder</p>
        <label className="block text-xs font-medium text-muted-foreground">Gruppenname</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Einsatz Alpha"
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
        />
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label className="block text-xs font-medium text-muted-foreground">Mitglieder</label>
          <button
            type="button"
            onClick={() => setPhonebookPickerOpen(true)}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
          >
            Aus Telefonbuch…
          </button>
        </div>
        <textarea
          value={membersText}
          onChange={(e) => setMembersText(e.target.value)}
          rows={3}
          spellCheck={false}
          placeholder="Namen oder 0x-Adressen — am einfachsten „Aus Telefonbuch…“"
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
        />
        {showMeshtasticSecondary ? (
          <>
            <label className="block text-[10px] font-medium text-muted-foreground">
              Funk-Gruppenkanal (Meshtastic Secondary)
            </label>
            <div className="grid max-w-lg gap-2 sm:grid-cols-3">
              <input
                type="number"
                min={0}
                max={7}
                step={1}
                value={secondaryChannelIndex}
                onChange={(e) => setSecondaryChannelIndex(e.target.value)}
                placeholder="Index 0-7"
                className="w-full rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[11px]"
              />
              <input
                type="text"
                value={secondaryChannelName}
                onChange={(e) => setSecondaryChannelName(e.target.value)}
                placeholder="Kanalname"
                className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-[11px]"
              />
              <input
                type="text"
                value={secondaryPskRef}
                onChange={(e) => setSecondaryPskRef(e.target.value)}
                placeholder="PSK-Ref"
                className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-[11px]"
              />
            </div>
          </>
        ) : null}
      </div>

      {/* 2 — Team-Kanal */}
      <div className="space-y-2 rounded-lg border border-border bg-background/50 px-3 py-3">
        <p className="text-xs font-semibold text-foreground">2 · Team-Kanal</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Ein gemeinsames Postfach + ein gemeinsames Geheimnis für alle.
        </p>
        <button
          type="button"
          disabled={setupBusy || groupCreateBlocked || memberAddresses.length === 0}
          onClick={() => void setupTeamChannel()}
          className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {setupBusy ? 'Richte ein…' : teamKeyReady ? 'Kanal-Status prüfen / speichern' : 'Kanal einrichten'}
        </button>
        {mbOk ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className={teamKeyReady ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}>
              {teamKeyReady
                ? `✓ Postfach + Geheimnis (Epoch ${teamKeyEpoch})`
                : 'Postfach gesetzt — Geheimnis fehlt noch (Button oben).'}
            </span>
            <button
              type="button"
              onClick={() => void copyTeamMailboxId(teamMailboxObjectId)}
              className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 hover:bg-accent"
            >
              {copiedTeamMbId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedTeamMbId ? 'ID kopiert' : 'Postfach-ID kopieren'}
            </button>
            {savedTeamMbId && !teamMbDirty ? (
              <span className="text-muted-foreground">in Gruppe gespeichert</span>
            ) : teamMbDirty ? (
              <span className="text-amber-700 dark:text-amber-300">noch nicht gespeichert</span>
            ) : null}
          </div>
        ) : null}
        {teamKeyReady ? (
          <button
            type="button"
            className="text-[11px] font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-200"
            onClick={() => {
              if (!window.confirm('Gruppen-Geheimnis rotieren? Alle Mitglieder brauchen einen neuen Handoff.')) return
              const r = createTeamBroadcastKey(teamMailboxObjectId, { rotate: true })
              if (!r.ok) {
                setMsg(r.error)
                return
              }
              setTeamKeyTick((n) => n + 1)
              setMsg(`Geheimnis rotiert (Epoch ${r.epoch}). Neuen Handoff exportieren.`)
            }}
          >
            Geheimnis rotieren…
          </button>
        ) : null}
        <button
          type="button"
          className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setShowAdvancedMailbox((v) => !v)}
        >
          {showAdvancedMailbox ? 'Erweitert ausblenden' : 'Erweitert: vorhandenes Postfach wählen / ID einfügen'}
        </button>
        {showAdvancedMailbox ? (
          <div className="space-y-2 border-t border-border pt-2">
            <select
              value={teamMailboxObjectId}
              onChange={(e) => {
                const next = e.target.value
                if (!next) return
                setTeamMailboxObjectId(next)
                linkTeamMailboxToGroup(next, 'Team-Postfach mit Gruppe verknüpft.')
              }}
              className="w-full rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[11px]"
            >
              <option value="">
                {teamMailboxOptions.length > 0 ? '— vorhandenes Postfach —' : '— noch keins lokal —'}
              </option>
              {teamMailboxOptions.map((t) => (
                <option key={t.objectId} value={t.objectId}>
                  {t.label ? `${t.label} · ` : ''}
                  {t.objectId.slice(0, 10)}…
                </option>
              ))}
            </select>
            <input
              type="text"
              value={teamMailboxObjectId}
              onChange={(e) => setTeamMailboxObjectId(e.target.value.trim())}
              onBlur={() => {
                const id = teamMailboxObjectId.trim()
                if (/^0x[a-fA-F0-9]{64}$/i.test(id)) {
                  linkTeamMailboxToGroup(id, 'Postfach-ID übernommen.')
                }
              }}
              placeholder="Object-ID einfügen (0x…)"
              className="w-full rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[11px]"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              disabled={teamMbBusy || !teamMailboxCreateAllowed}
              onClick={() => {
                setTeamMbBusy(true)
                void createTeamMailboxForGroup().finally(() => setTeamMbBusy(false))
              }}
              className="rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              {teamMbBusy ? '…' : 'Nur Postfach erstellen'}
            </button>
            {!teamMailboxCreateAllowed ? (
              <p className="text-[10px] text-amber-800 dark:text-amber-200">
                Erstellen gesperrt — Tresor entsperren. ID einfügen geht immer.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 3 — Handshake nur bei Pairwise-Enc */}
      {encrypted && handshake && forcedTransport === 'internet' ? (
        <div className="space-y-2 rounded-lg border border-border bg-background/50 px-3 py-3">
          <p className="text-xs font-semibold text-foreground">3 · Handshake je Person</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Nur bei „1:1 je Person“: mit jedem Mitglied einzeln verbinden (wie Direktchat). Bei „Gemeinsames
            Postfach“ reicht Kanal einrichten — kein Handshake hier.
          </p>
          {handshakeMembers.length === 0 ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">Noch keine 0x-Mitglieder — Telefonbuch nutzen.</p>
          ) : (
            <ul className="space-y-2">
              {handshakeMembers.map((addr) => {
                const connected = connectedSet.has(addr)
                const label = contactDisplayLabel(contactDirectory, addr)
                return (
                  <li
                    key={addr}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{label || `${addr.slice(0, 10)}…`}</p>
                      <code className="block truncate font-mono text-[10px] text-muted-foreground">{addr}</code>
                    </div>
                    <span
                      className={
                        connected
                          ? 'text-[10px] font-medium text-emerald-600 dark:text-emerald-400'
                          : 'text-[10px] text-amber-700 dark:text-amber-300'
                      }
                    >
                      {connected ? 'verbunden' : 'offen'}
                    </span>
                    <button
                      type="button"
                      disabled={handshake.sending}
                      onClick={() => void handshake.onHandshakeForAddress(addr)}
                      className="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                    >
                      Handshake
                    </button>
                    {handshake.onConnectAcceptForAddress ? (
                      <button
                        type="button"
                        disabled={handshake.sending}
                        onClick={() => void handshake.onConnectAcceptForAddress?.(addr)}
                        className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                      >
                        Annehmen
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveGroup}
          disabled={groupCreateBlocked}
          title={groupCreateBlocked ? groupCreateBlockedTitle : undefined}
          className={cn(
            'rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted',
            groupCreateBlocked && 'cursor-not-allowed opacity-40'
          )}
        >
          Speichern
        </button>
        <button
          type="button"
          onClick={newGroup}
          disabled={!groupCreateAllowed}
          title={!groupCreateAllowed ? groupCreateBlockedTitle : undefined}
          className={cn(
            'rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted',
            !groupCreateAllowed && 'cursor-not-allowed opacity-40'
          )}
        >
          Neue Gruppe
        </button>
        {activeId ? (
          <button
            type="button"
            onClick={removeGroup}
            className="rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            Löschen
          </button>
        ) : null}
      </div>

      {!active ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">Speichern, dann im Chat schreiben und senden.</p>
      ) : null}
      {msg ? (
        <p className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs text-foreground" role="status">
          {msg}
        </p>
      ) : null}

      <ContactPhonebookPickerDialog
        open={phonebookPickerOpen}
        onOpenChange={setPhonebookPickerOpen}
        directory={contactDirectory}
        title="Mitglieder aus Telefonbuch"
        description="Kontakte auswählen — sie werden der Mitgliederliste hinzugefügt."
        confirmLabel="Zur Gruppe hinzufügen"
        onConfirm={applyPhonebookSelection}
      />
    </section>
  )
}
