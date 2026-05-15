'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
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

export type ChatViewGroupPanelProps = {
  contactDirectory: Record<string, ContactMeshEntryClient>
  onGroupsChanged?: () => void
}

export function ChatViewGroupPanel(p: ChatViewGroupPanelProps) {
  const { contactDirectory, onGroupsChanged } = p
  const [groups, setGroups] = useState<MessengerGroupDefinition[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [membersText, setMembersText] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const reload = useCallback(() => {
    setGroups(readMessengerGroups())
    setActiveId(readActiveGroupId())
    const active = getActiveMessengerGroup()
    if (active) {
      setName(active.name)
      setMembersText(active.memberAddresses.join('\n'))
    } else {
      setName('')
      setMembersText('')
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

  const saveGroup = useCallback(() => {
    const memberAddresses = parseGroupMemberInput(membersText)
    if (memberAddresses.length === 0) {
      setMsg('Mindestens eine gültige Mitglieder-Adresse (0x + 64 Hex) eintragen.')
      return
    }
    const id = activeId ?? createMessengerGroupId()
    upsertMessengerGroup({
      id,
      name: name.trim() || `Gruppe (${memberAddresses.length})`,
      memberAddresses,
    })
    writeActiveGroupId(id)
    setMsg('Gruppe gespeichert.')
    reload()
    onGroupsChanged?.()
  }, [activeId, membersText, name, onGroupsChanged, reload])

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
    setMsg('Neue Gruppe — Name und Mitglieder eintragen, dann speichern.')
  }, [directoryAddrs])

  const removeGroup = useCallback(() => {
    if (!activeId) return
    deleteMessengerGroup(activeId)
    setMsg('Gruppe gelöscht.')
    reload()
    onGroupsChanged?.()
  }, [activeId, onGroupsChanged, reload])

  const addFromPhonebook = useCallback(() => {
    if (directoryAddrs.length === 0) {
      setMsg('Telefonbuch leer — zuerst Kontakte mit 0x-Adresse anlegen.')
      return
    }
    const merged = parseGroupMemberInput([membersText, ...directoryAddrs].join('\n'))
    setMembersText(merged.join('\n'))
    setMsg(`${merged.length} Adresse(n) im Entwurf.`)
  }, [directoryAddrs, membersText])

  const active = getActiveMessengerGroup()

  return (
    <section className="mb-4 rounded-lg border border-violet-500/25 bg-violet-500/5 px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Users className="h-4 w-4 text-violet-400" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Gruppenchat (M2)</h3>
      </div>
      <p className="mb-3">
        <strong className="text-foreground">Ein Posteingang</strong> für alle Mitglieder — Senden weiter an eine{' '}
        <span className="font-mono">0x</span>-Adresse im Composer (pairwise v1). Nicht dasselbe wie die{' '}
        <strong className="text-foreground">Pinnwand</strong>.
      </p>
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
        <label className="block text-[10px] font-medium text-muted-foreground">Gruppenname</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Einsatz Alpha"
          className="w-full max-w-md rounded-md border border-border bg-input px-2 py-1.5 text-xs text-foreground"
        />
        <label className="block text-[10px] font-medium text-muted-foreground">
          Mitglieder (je Zeile oder Komma, 0x + 64 Hex)
        </label>
        <textarea
          value={membersText}
          onChange={(e) => setMembersText(e.target.value)}
          rows={4}
          spellCheck={false}
          className="w-full max-w-lg rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[11px]"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveGroup}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Gruppe speichern
          </button>
          <button type="button" onClick={newGroup} className="rounded-md border border-border px-3 py-1.5 text-xs">
            Neue Gruppe
          </button>
          <button type="button" onClick={addFromPhonebook} className="rounded-md border border-border px-3 py-1.5 text-xs">
            Aus Telefonbuch
          </button>
          {activeId ? (
            <button
              type="button"
              onClick={removeGroup}
              className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive"
            >
              Aktive Gruppe löschen
            </button>
          ) : null}
        </div>
        {active ? (
          <p className="text-[10px] text-muted-foreground">
            Aktiv: <strong className="text-foreground">{active.name}</strong> — Posteingang zeigt Nachrichten mit{' '}
            {active.memberAddresses.length} Mitgliedern.
          </p>
        ) : (
          <p className="text-[10px] text-amber-700 dark:text-amber-300">Keine aktive Gruppe — speichern oder aus Liste wählen.</p>
        )}
        {msg ? <p className="text-[10px] text-foreground">{msg}</p> : null}
      </div>
    </section>
  )
}
