'use client'

import { useCallback, useEffect, useState } from 'react'
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

export type ChatViewGroupPanelProps = {
  contactDirectory: Record<string, ContactMeshEntryClient>
  /** Meshtastic Secondary nur bei Sendepfad „funk“. */
  forcedTransport?: ForcedTransport
  teamMailboxCreateAllowed?: boolean
  /** Handoff-Runtime: neue Gruppe anlegen / erste Speicherung. */
  groupCreateAllowed?: boolean
  onGroupsChanged?: () => void
  onOpenPhonebook?: () => void
  /** Einstellungen → Meine Mailboxen (Team-Postfächer verwalten). */
  onOpenSettings?: () => void
  encrypted?: boolean
  onEncryptedChange?: (encrypted: boolean) => void
  embedded?: boolean
}

export function ChatViewGroupPanel(p: ChatViewGroupPanelProps) {
  const {
    contactDirectory,
    forcedTransport,
    teamMailboxCreateAllowed = false,
    groupCreateAllowed = true,
    onGroupsChanged,
    onOpenPhonebook,
    onOpenSettings,
    encrypted = false,
    onEncryptedChange,
    embedded = false,
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
  const [copiedTeamMbId, setCopiedTeamMbId] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [phonebookPickerOpen, setPhonebookPickerOpen] = useState(false)

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

  const persistGroupDefinition = useCallback(
    (opts?: { teamMbOverride?: string; successMsg?: string }): boolean => {
      const memberAddresses = parseGroupMemberInput(membersText, contactDirectory)
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
      contactDirectory,
      membersText,
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
      setMsg('Mindestens ein gültiges Mitglied (Telefonbuch-Name oder 0x + 64 Hex) eintragen.')
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
    setMsg('Neue Gruppe — Name und Mitglieder eintragen, dann speichern.')
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
      setMsg(`${picked.length} Kontakt(e) übernommen — „Gruppe speichern“ nicht vergessen.`)
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
      setMsg('Team-Postfach erstellt — zuerst Mitglieder eintragen, dann „Gruppe speichern“.')
    },
    [persistGroupDefinition]
  )

  const createTeamMailboxForGroup = useCallback(async () => {
    if (!teamMailboxCreateAllowed || teamMbBusy) return
    const label =
      typeof window !== 'undefined'
        ? window.prompt('Name des Team-Postfachs:', suggestNextTeamMailboxLabel())?.trim()
        : ''
    setTeamMbBusy(true)
    try {
      const r = await createTeamMailboxOnChain()
      if (!r.ok || !r.objectId) {
        setMsg(r.error || r.message || 'Team-Postfach konnte nicht erstellt werden.')
        return
      }
      addMyTeamMailbox({
        objectId: r.objectId,
        ...(label ? { label } : {}),
        ...(r.digest ? { digest: r.digest } : {}),
      })
      linkTeamMailboxToGroup(
        r.objectId,
        'Team-Postfach erstellt und mit Gruppe verknüpft — Object-ID unten kopieren und an Mitglieder weitergeben.'
      )
    } finally {
      setTeamMbBusy(false)
    }
  }, [teamMailboxCreateAllowed, teamMbBusy, linkTeamMailboxToGroup])

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

  return (
    <section
      className={cn(
        embedded
          ? 'space-y-3 text-sm leading-relaxed'
          : 'mb-4 rounded-lg border border-violet-500/25 bg-violet-500/5 px-3 py-3 text-[11px] leading-relaxed text-muted-foreground'
      )}
    >
      {onEncryptedChange ? (
        <AlertDialog open={plainWarnOpen} onOpenChange={setPlainWarnOpen}>
          <AlertDialogContent className="border-orange-500/40 bg-orange-950/20 sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-orange-100">Unverschlüsselt in der Gruppe?</AlertDialogTitle>
              <AlertDialogDescription className="text-orange-50/95">
                Die Nachricht wird unverschlüsselt auf der Chain gespeichert und ist für jeden einsehbar. Team-Broadcast
                (1× Nachricht für alle) funktioniert nur unverschlüsselt.
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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-violet-400" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">{embedded ? 'Einstellungen' : 'Gruppe'}</h3>
          {active ? (
            <span className="text-xs text-muted-foreground">
              · {active.memberAddresses.length} Mitglieder
            </span>
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
              Verschlüsselt
            </button>
            <button
              type="button"
              onClick={() => {
                if (encrypted) setPlainWarnOpen(true)
              }}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium',
                !encrypted ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Unlock className="h-3 w-3" aria-hidden />
              Unverschlüsselt
            </button>
          </div>
        ) : null}
      </div>
      {onEncryptedChange && embedded ? (
        <p className="text-xs text-muted-foreground">
          Verschlüsselung im Chat-Kopf umschalten. Team-Broadcast (1× Chain) nur unverschlüsselt.
        </p>
      ) : null}
      {encrypted && forcedTransport === 'internet' && !embedded ? (
        <p className="mb-2 text-[10px] text-muted-foreground">
          Verschlüsselt: je Mitglied eine Chain-Nachricht (Handshake unten). Team-Broadcast nur bei{' '}
          <strong className="text-foreground">Unverschlüsselt</strong>.
        </p>
      ) : null}
      {groups.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => selectGroup(g.id)}
              className={
                activeId === g.id
                  ? 'rounded-md bg-violet-600 px-2 py-1 text-xs font-medium text-white'
                  : 'rounded-md border border-border px-2 py-1 text-xs hover:bg-muted'
              }
            >
              {g.name} ({g.memberAddresses.length})
            </button>
          ))}
        </div>
      ) : null}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-muted-foreground">Gruppenname</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Einsatz Alpha"
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
        />
        <label className="block text-xs font-medium text-muted-foreground">
          Mitglieder (je Zeile oder Komma — Name aus Telefonbuch oder 0x + 64 Hex)
        </label>
        <textarea
          value={membersText}
          onChange={(e) => setMembersText(e.target.value)}
          rows={4}
          spellCheck={false}
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
        <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-3">
          <p className="text-xs font-medium text-foreground">Team-Postfach (Pflicht für Chain)</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Internet + Mailbox: 1× Team-Broadcast pro Nachricht. Nach Move-Deploy neues Postfach anlegen.
          </p>
          <div className="mt-2 flex max-w-lg flex-wrap gap-2">
            <select
              value={teamMailboxObjectId}
              onChange={(e) => {
                const next = e.target.value
                if (!next) return
                setTeamMailboxObjectId(next)
                linkTeamMailboxToGroup(next, 'Team-Postfach mit Gruppe verknüpft und gespeichert.')
              }}
              className="min-w-[12rem] flex-1 rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[11px]"
            >
              <option value="">
                {teamMailboxOptions.length > 0 ? '— Team-Postfach wählen —' : '— zuerst Team-Postfach erstellen —'}
              </option>
              {teamMailboxOptions.map((t) => (
                <option key={t.objectId} value={t.objectId}>
                  {t.label ? `${t.label} · ` : ''}
                  {t.objectId.slice(0, 10)}…
                </option>
              ))}
            </select>
            {teamMailboxCreateAllowed ? (
              <button
                type="button"
                disabled={teamMbBusy}
                onClick={() => void createTeamMailboxForGroup()}
                className="rounded-md border border-sky-600/45 bg-sky-600/15 px-2 py-1.5 text-xs text-sky-950 disabled:opacity-50 dark:text-sky-100"
              >
                {teamMbBusy ? '…' : 'Neu erstellen'}
              </button>
            ) : null}
            {onOpenSettings ? (
              <button
                type="button"
                onClick={onOpenSettings}
                className="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted"
              >
                Meine Mailboxen…
              </button>
            ) : null}
          </div>
          {teamMailboxObjectId.trim() ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="max-w-full break-all font-mono text-[10px] text-foreground" title={teamMailboxObjectId}>
                {teamMailboxObjectId.trim()}
              </code>
              <button
                type="button"
                onClick={() => void copyTeamMailboxId(teamMailboxObjectId)}
                className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent"
              >
                {copiedTeamMbId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedTeamMbId ? 'Kopiert' : 'ID kopieren'}
              </button>
              {savedTeamMbId && !teamMbDirty ? (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300">✓ in Gruppe gespeichert</span>
              ) : teamMbDirty ? (
                <span className="text-[10px] text-amber-700 dark:text-amber-300">noch nicht gespeichert</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={saveGroup}
            disabled={groupCreateBlocked}
            title={groupCreateBlocked ? groupCreateBlockedTitle : undefined}
            className={cn(
              'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground',
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
              'rounded-lg border border-border px-4 py-2 text-sm font-medium',
              !groupCreateAllowed && 'cursor-not-allowed opacity-40'
            )}
          >
            Neue Gruppe
          </button>
          <button
            type="button"
            onClick={() => setPhonebookPickerOpen(true)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Aus Telefonbuch…
          </button>
          {onOpenPhonebook ? (
            <button
              type="button"
              onClick={onOpenPhonebook}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Telefonbuch
            </button>
          ) : null}
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
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Gruppe speichern, dann im Chat Nachricht schreiben und senden.
          </p>
        ) : null}
        {msg ? <p className="text-xs text-foreground">{msg}</p> : null}
      </div>
      <ContactPhonebookPickerDialog
        open={phonebookPickerOpen}
        onOpenChange={setPhonebookPickerOpen}
        directory={contactDirectory}
        title="Mitglieder aus Telefonbuch"
        description="Kontakte auswählen — sie werden der Mitgliederliste hinzugefügt (Duplikate werden ignoriert)."
        confirmLabel="Zur Gruppe hinzufügen"
        onConfirm={applyPhonebookSelection}
      />
    </section>
  )
}
