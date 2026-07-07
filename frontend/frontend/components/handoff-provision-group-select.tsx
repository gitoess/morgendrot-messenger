'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TeamMailboxOption } from '@/frontend/lib/handoff-export-autofill'
import { createHandoffMessengerGroup } from '@/frontend/lib/create-handoff-messenger-group'
import { readMessengerGroups } from '@/frontend/lib/messenger-group-store'

export function HandoffProvisionGroupSelect(p: {
  value: string | null
  onChange: (groupId: string | null) => void
  id?: string
  className?: string
  disabled?: boolean
  hint?: string
  /** Boss-Wallet — wird automatisch Mitglied der neuen Gruppe */
  bossAddress?: string
  /** Vorschlag für Gruppenname */
  defaultGroupName?: string
  /** Team-Postfach-Optionen für „Neue Gruppe“ */
  teamMailboxOptions?: TeamMailboxOption[]
  /** Vorausgewähltes Team-Postfach beim Anlegen */
  defaultTeamMailboxId?: string
  refreshKey?: number
  onGroupCreated?: (groupId: string) => void
}) {
  const [groups, setGroups] = useState(() => readMessengerGroups())
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTeamMb, setNewTeamMb] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState('')

  const reloadGroups = useCallback(() => {
    setGroups(readMessengerGroups())
  }, [])

  useEffect(() => {
    reloadGroups()
  }, [p.refreshKey, reloadGroups])

  useEffect(() => {
    if (createOpen && !newName.trim() && p.defaultGroupName?.trim()) {
      setNewName(p.defaultGroupName.trim())
    }
  }, [createOpen, newName, p.defaultGroupName])

  useEffect(() => {
    if (createOpen && !newTeamMb && p.defaultTeamMailboxId?.trim()) {
      setNewTeamMb(p.defaultTeamMailboxId.trim())
    }
  }, [createOpen, newTeamMb, p.defaultTeamMailboxId])

  const teamOptions = useMemo(() => p.teamMailboxOptions ?? [], [p.teamMailboxOptions])

  const onCreateGroup = () => {
    setCreateError('')
    const boss = (p.bossAddress || '').trim()
    const members = boss ? [boss] : []
    setCreateBusy(true)
    try {
      const r = createHandoffMessengerGroup({
        name: newName,
        memberAddresses: members,
        teamMailboxObjectId: newTeamMb.trim() || undefined,
        setActive: true,
      })
      if (!r.ok) {
        setCreateError(r.error)
        return
      }
      reloadGroups()
      p.onChange(r.groupId)
      p.onGroupCreated?.(r.groupId)
      setCreateOpen(false)
      setNewName('')
      setCreateError('')
    } finally {
      setCreateBusy(false)
    }
  }

  return (
    <div className={p.className}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={p.id ?? 'handoff-provision-group'} className="text-xs font-medium text-muted-foreground">
          Messenger-Gruppe (optional)
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={p.disabled}
          onClick={() => setCreateOpen((v) => !v)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
          Neue Gruppe
        </Button>
      </div>
      <select
        id={p.id ?? 'handoff-provision-group'}
        disabled={p.disabled}
        value={p.value ?? ''}
        onChange={(e) => p.onChange(e.target.value.trim() || null)}
        className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
      >
        <option value="">— keine Gruppe —</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} ({g.memberAddresses.length} Mitglieder)
            {g.teamMailboxObjectId ? '' : ' · ohne Postfach'}
          </option>
        ))}
      </select>

      {createOpen ? (
        <div className="mt-2 space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
          <div>
            <label htmlFor="handoff-new-group-name" className="mb-1 block text-xs text-muted-foreground">
              Gruppenname
            </label>
            <input
              id="handoff-new-group-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="z. B. Medic Nord"
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
          </div>
          {teamOptions.length > 0 ? (
            <div>
              <label htmlFor="handoff-new-group-team-mb" className="mb-1 block text-xs text-muted-foreground">
                Team-Postfach (für Handoff-Gruppen-JSON)
              </label>
              <select
                id="handoff-new-group-team-mb"
                value={newTeamMb}
                onChange={(e) => setNewTeamMb(e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
              >
                <option value="">— optional —</option>
                {teamOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-200">
              Kein Team-Postfach bekannt — Gruppe ohne IOTA-Mailbox (nur Mitgliederliste).
            </p>
          )}
          {p.bossAddress?.trim() ? (
            <p className="text-[10px] text-muted-foreground">
              Boss-Wallet wird automatisch als erstes Gruppenmitglied eingetragen.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={createBusy} onClick={onCreateGroup}>
              {createBusy ? '…' : 'Anlegen & auswählen'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreateOpen(false)}>
              Abbrechen
            </Button>
          </div>
          {createError ? (
            <p className="text-xs text-destructive" role="alert">
              {createError}
            </p>
          ) : null}
        </div>
      ) : null}

      {groups.length === 0 && !createOpen ? (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">
          Noch keine Gruppe — oben <strong className="font-medium">Neue Gruppe</strong> anlegen.
        </p>
      ) : p.hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{p.hint}</p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Helfer-Wallet wird der Gruppe hinzugefügt; mit Team-Postfach auch Gruppen-JSON im Handoff-ZIP.
        </p>
      )}
    </div>
  )
}
