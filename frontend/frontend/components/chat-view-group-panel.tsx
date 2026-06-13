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
  } = p
  const showMeshtasticSecondary = forcedTransport === 'mesh'
  const groupCreateBlockedTitle = 'No permission to create new groups (handoff rights).'
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
      setMembersText(active.memberAddresses.join('\n'))
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
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const directoryAddrs = useMemo(
    () =>
      Object.keys(contactDirectory)
        .map((a) => a.trim())
        .filter((a) => /^0x[a-fA-F0-9]{64}$/i.test(a)),
    [contactDirectory]
  )

  const persistGroupDefinition = useCallback(
    (opts?: { teamMbOverride?: string; successMsg?: string }): boolean => {
      const memberAddresses = parseGroupMemberInput(membersText)
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
    if (!persistGroupDefinition({ successMsg: 'Group saved.' })) {
      setMsg('Enter at least one valid member address (0x + 64 hex).')
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
    setMembersText(directoryAddrs.join('\n'))
    setSecondaryChannelIndex('')
    setSecondaryChannelName('')
    setSecondaryPskRef('')
    setTeamMailboxObjectId('')
    setMsg('New group — enter name and members, then save.')
  }, [directoryAddrs])

  const removeGroup = useCallback(() => {
    if (!activeId) return
    deleteMessengerGroup(activeId)
    setMsg('Group deleted.')
    reload()
    onGroupsChanged?.()
  }, [activeId, onGroupsChanged, reload])

  const applyPhonebookSelection = useCallback(
    (picked: string[]) => {
      const merged = parseGroupMemberInput([membersText, ...picked].join('\n'))
      setMembersText(merged.join('\n'))
      setMsg(`${picked.length} contact(s) added — don't forget to save the group.`)
    },
    [membersText]
  )

  const active = getActiveMessengerGroup()
  const teamMailboxOptions = readMyTeamMailboxes()

  const linkTeamMailboxToGroup = useCallback(
    (objectId: string, successMsg: string) => {
      const id = objectId.trim()
      if (!/^0x[a-fA-F0-9]{64}$/i.test(id)) return
      setTeamMailboxObjectId(id)
      if (persistGroupDefinition({ teamMbOverride: id, successMsg })) return
      setMsg('Team mailbox created — enter members first, then save group.')
    },
    [persistGroupDefinition]
  )

  const createTeamMailboxForGroup = useCallback(async () => {
    if (!teamMailboxCreateAllowed || teamMbBusy) return
    const label =
      typeof window !== 'undefined'
        ? window.prompt('Team mailbox name:', suggestNextTeamMailboxLabel())?.trim()
        : ''
    setTeamMbBusy(true)
    try {
      const r = await createTeamMailboxOnChain()
      if (!r.ok || !r.objectId) {
        setMsg(r.error || r.message || 'Team mailbox could not be created.')
        return
      }
      addMyTeamMailbox({
        objectId: r.objectId,
        ...(label ? { label } : {}),
        ...(r.digest ? { digest: r.digest } : {}),
      })
      linkTeamMailboxToGroup(
        r.objectId,
        'Team mailbox created and linked to group — copy the object ID below and share with members.'
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
      setMsg('Copy failed — select the object ID manually.')
    }
  }, [])

  const savedTeamMbId = active?.teamMailboxObjectId?.trim() ?? ''
  const teamMbDirty =
    !!teamMailboxObjectId.trim() &&
    teamMailboxObjectId.trim().toLowerCase() !== savedTeamMbId.toLowerCase()

  return (
    <section className="mb-4 rounded-lg border border-violet-500/25 bg-violet-500/5 px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
      {onEncryptedChange ? (
        <AlertDialog open={plainWarnOpen} onOpenChange={setPlainWarnOpen}>
          <AlertDialogContent className="border-orange-500/40 bg-orange-950/20 sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-orange-100">Plaintext in the group?</AlertDialogTitle>
              <AlertDialogDescription className="text-orange-50/95">
                Die Nachricht wird unverschlüsselt auf der Chain gespeichert und ist für jeden einsehbar. Team-Broadcast
                (1× Nachricht für alle) funktioniert nur unverschlüsselt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-orange-600 text-white hover:bg-orange-500"
                onClick={() => onEncryptedChange(false)}
              >
                Understood, continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-violet-400" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">Group</h3>
          {active ? (
            <span className="text-[10px] text-muted-foreground">· {active.memberAddresses.length} members</span>
          ) : null}
        </div>
        {onEncryptedChange ? (
          <div
            className={cn(
              'inline-flex rounded-md border border-border bg-background p-0.5',
              encrypted && 'ring-1 ring-emerald-500/30'
            )}
            role="group"
            aria-label="Encryption"
          >
            <button
              type="button"
              disabled={forcedTransport === 'mesh'}
              title={
                forcedTransport === 'mesh'
                  ? 'Encryption only via send path online. Radio = plaintext.'
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
              Encrypted
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
              Plaintext
            </button>
          </div>
        ) : null}
      </div>
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
        <label className="block text-[10px] font-medium text-muted-foreground">Group name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Operation Alpha"
          className="w-full max-w-md rounded-md border border-border bg-input px-2 py-1.5 text-xs text-foreground"
        />
        <label className="block text-[10px] font-medium text-muted-foreground">
          Members (one per line or comma-separated, 0x + 64 hex)
        </label>
        <textarea
          value={membersText}
          onChange={(e) => setMembersText(e.target.value)}
          rows={4}
          spellCheck={false}
          className="w-full max-w-lg rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[11px]"
        />
        {showMeshtasticSecondary ? (
          <>
            <label className="block text-[10px] font-medium text-muted-foreground">
              Radio group channel (Meshtastic secondary)
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
                placeholder="Channel name"
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
        <div className="rounded-md border border-sky-500/25 bg-sky-500/5 px-2.5 py-2">
          <p className="text-[10px] font-medium text-foreground">Team mailbox (chain)</p>
          <div className="mt-2 flex max-w-lg flex-wrap gap-2">
            <select
              value={teamMailboxObjectId}
              onChange={(e) => {
                const next = e.target.value
                if (!next) return
                setTeamMailboxObjectId(next)
                linkTeamMailboxToGroup(next, 'Team mailbox linked to group and saved.')
              }}
              className="min-w-[12rem] flex-1 rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[11px]"
            >
              <option value="">
                {teamMailboxOptions.length > 0 ? '— choose team mailbox —' : '— create a team mailbox first —'}
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
                {teamMbBusy ? '…' : 'Create new'}
              </button>
            ) : null}
            {onOpenSettings ? (
              <button
                type="button"
                onClick={onOpenSettings}
                className="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted"
              >
                My mailboxes…
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
                {copiedTeamMbId ? 'Copied' : 'Copy ID'}
              </button>
              {savedTeamMbId && !teamMbDirty ? (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300">✓ saved in group</span>
              ) : teamMbDirty ? (
                <span className="text-[10px] text-amber-700 dark:text-amber-300">not saved yet</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveGroup}
            disabled={groupCreateBlocked}
            title={groupCreateBlocked ? groupCreateBlockedTitle : undefined}
            className={cn(
              'rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground',
              groupCreateBlocked && 'cursor-not-allowed opacity-40'
            )}
          >
            Save group
          </button>
          <button
            type="button"
            onClick={newGroup}
            disabled={!groupCreateAllowed}
            title={!groupCreateAllowed ? groupCreateBlockedTitle : undefined}
            className={cn(
              'rounded-md border border-border px-3 py-1.5 text-xs',
              !groupCreateAllowed && 'cursor-not-allowed opacity-40'
            )}
          >
            New group
          </button>
          <button
            type="button"
            onClick={() => setPhonebookPickerOpen(true)}
            className="rounded-md border border-border px-3 py-1.5 text-xs"
          >
            From phonebook…
          </button>
          {onOpenPhonebook ? (
            <button
              type="button"
              onClick={onOpenPhonebook}
              className="rounded-md border border-border px-3 py-1.5 text-xs"
            >
              Open phonebook
            </button>
          ) : null}
          {activeId ? (
            <button
              type="button"
              onClick={removeGroup}
              className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive"
            >
              Delete active group
            </button>
          ) : null}
        </div>
        {!active ? (
          <p className="text-[10px] text-amber-700 dark:text-amber-300">
            Save the group or pick one from the list, then write a message below and send.
          </p>
        ) : null}
        {msg ? <p className="text-[10px] text-foreground">{msg}</p> : null}
      </div>
      <ContactPhonebookPickerDialog
        open={phonebookPickerOpen}
        onOpenChange={setPhonebookPickerOpen}
        directory={contactDirectory}
        title="Members from phonebook"
        description="Select contacts — they are added to the member list (duplicates are ignored)."
        confirmLabel="Add to group"
        onConfirm={applyPhonebookSelection}
      />
    </section>
  )
}
