'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Building2, Check, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { shouldShowCapacitorApiBaseSettings } from '@/frontend/lib/capacitor-platform'
import { applyPackageProfile } from '@/frontend/lib/package-profile-apply'
import type { PackageProfile } from '@/frontend/lib/package-profile'
import {
  addUserProfile,
  buildSwitchWarning,
  loadPackageProfileRegistry,
  PACKAGE_PROFILE_REGISTRY_CHANGED,
  removeUserProfile,
  setActiveProfile,
  shortPackageId,
  writeRegistryState,
  type PackageProfileRegistryState,
} from '@/frontend/lib/package-profile-registry'

type AddForm = {
  id: string
  label: string
  packageId: string
  mailboxId: string
  rpcUrl: string
  apiBaseUrl: string
}

const EMPTY_ADD: AddForm = { id: '', label: '', packageId: '', mailboxId: '', rpcUrl: '', apiBaseUrl: '' }

type SettingsEinsatzProfilesSectionProps = {
  /** Boss / Config-Rolle darf Profile anlegen/entfernen (Spec §7.1). */
  canManage?: boolean
}

/**
 * § H.24b P2 — „Einsatz wechseln“ (Package-Profile).
 * Aktivierung ist **clientseitig** (Registry + Banner); **kein** Server-Hot-Swap (§7.5).
 */
export function SettingsEinsatzProfilesSection({ canManage = false }: SettingsEinsatzProfilesSectionProps) {
  const [profiles, setProfiles] = useState<PackageProfile[]>([])
  const [state, setState] = useState<PackageProfileRegistryState>({ userProfiles: [] })
  const [active, setActive] = useState<PackageProfile | undefined>(undefined)
  const [pendingSwitch, setPendingSwitch] = useState<PackageProfile | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD)
  const [msg, setMsg] = useState('')
  const [msgTone, setMsgTone] = useState<'neutral' | 'error' | 'success'>('neutral')

  const refresh = useCallback(async () => {
    const reg = await loadPackageProfileRegistry({ force: true })
    setProfiles(reg.profiles)
    setState(reg.state)
    setActive(reg.active)
  }, [])

  useEffect(() => {
    void refresh()
    const onChange = () => void refresh()
    window.addEventListener(PACKAGE_PROFILE_REGISTRY_CHANGED, onChange)
    return () => window.removeEventListener(PACKAGE_PROFILE_REGISTRY_CHANGED, onChange)
  }, [refresh])

  const bundledIds = profiles.filter((p) => p.bundled).map((p) => p.id)

  const confirmSwitch = () => {
    if (!pendingSwitch) return
    const res = setActiveProfile(state, pendingSwitch.id, profiles)
    if (res.ok) {
      writeRegistryState(res.state)
      const applied = applyPackageProfile(pendingSwitch, {
        applyApiBase: shouldShowCapacitorApiBaseSettings(),
      })
      let note = `Einsatz „${pendingSwitch.label}“ aktiv (clientseitig). Server-Config bleibt unverändert.`
      if (applied.apiBaseApplied) note += ` API-Basis: ${applied.apiBaseApplied}.`
      else if (applied.apiBaseError) note += ` API-Basis-Fehler: ${applied.apiBaseError}.`
      else if (applied.apiBaseSkipped) note += ' API-Basis unverändert (PC/Rewrites).'
      setMsgTone(applied.apiBaseError ? 'error' : 'success')
      setMsg(note)
    } else {
      setMsgTone('error')
      setMsg(res.error)
    }
    setPendingSwitch(null)
    void refresh()
  }

  const onAdd = () => {
    setMsg('')
    setMsgTone('neutral')
    const res = addUserProfile(
      state,
      {
        id: addForm.id.trim(),
        label: addForm.label.trim(),
        packageId: addForm.packageId.trim(),
        mailboxId: addForm.mailboxId.trim(),
        rpcUrl: addForm.rpcUrl.trim(),
        apiBaseUrl: addForm.apiBaseUrl.trim(),
      },
      { bundledIds }
    )
    if (!res.ok) {
      setMsgTone('error')
      setMsg(res.error)
      return
    }
    writeRegistryState(res.state)
    setAddForm(EMPTY_ADD)
    setMsgTone('success')
    setMsg(`Profil „${addForm.label.trim()}“ gespeichert.`)
    void refresh()
  }

  const onRemove = (id: string) => {
    writeRegistryState(removeUserProfile(state, id))
    void refresh()
  }

  const warning = pendingSwitch ? buildSwitchWarning(pendingSwitch) : null

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <Building2 className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h4 className="font-semibold text-foreground">Einsatz wechseln</h4>
          <p className="text-sm text-muted-foreground">
            {active ? (
              <>
                Aktiv: <span className="font-medium text-foreground">{active.label}</span>{' '}
                <span className="font-mono text-xs">({shortPackageId(active.packageId)})</span>
              </>
            ) : (
              'Kein Einsatzprofil aktiv.'
            )}
          </p>
        </div>
      </div>

      {profiles.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Keine Einsatzprofile im Bundle. Nach <span className="font-mono">create_globals</span> IDs in{' '}
          <span className="font-mono">package-profiles.manifest.json</span> eintragen (
          <span className="font-mono">npm run sync:package-profiles</span>).
        </p>
      ) : (
        <ul className="space-y-2">
          {profiles.map((p) => {
            const isActive = active?.id === p.id
            return (
              <li
                key={p.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-2.5',
                  isActive ? 'border-amber-500/50 bg-amber-500/5' : 'border-border'
                )}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: p.color || '#64748b' }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-medium text-foreground">{p.label}</span>
                    {p.bundled ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Bundle</span>
                    ) : null}
                    {isActive ? (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                        <Check className="h-3 w-3" /> aktiv
                      </span>
                    ) : null}
                    {!p.resolved ? (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                        nicht konfiguriert
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{shortPackageId(p.packageId)}</p>
                </div>
                {!p.bundled && canManage ? (
                  <button
                    type="button"
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label={`Profil ${p.label} entfernen`}
                    onClick={() => onRemove(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant={isActive ? 'outline' : 'default'}
                  disabled={isActive}
                  onClick={() => setPendingSwitch(p)}
                >
                  {isActive ? 'Aktiv' : 'Wechseln'}
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {canManage ? (
        <Collapsible open={addOpen} onOpenChange={setAddOpen}>
          <CollapsibleTrigger className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', addOpen && 'rotate-180')} />
            <Plus className="h-3.5 w-3.5" /> Profil hinzufügen
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Label</Label>
                <Input
                  className="h-8 text-xs"
                  value={addForm.label}
                  placeholder="z. B. Polizei SEK Region Y"
                  onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">id (Slug)</Label>
                <Input
                  className="h-8 text-xs"
                  value={addForm.id}
                  placeholder="polizei-sek-y"
                  spellCheck={false}
                  onChange={(e) => setAddForm((f) => ({ ...f, id: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Package-ID</Label>
                <Input
                  className="h-8 font-mono text-xs"
                  value={addForm.packageId}
                  placeholder="0x…"
                  spellCheck={false}
                  onChange={(e) => setAddForm((f) => ({ ...f, packageId: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Mailbox-ID</Label>
                <Input
                  className="h-8 font-mono text-xs"
                  value={addForm.mailboxId}
                  placeholder="0x…"
                  spellCheck={false}
                  onChange={(e) => setAddForm((f) => ({ ...f, mailboxId: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">RPC-URL (optional)</Label>
                <Input
                  className="h-8 text-xs"
                  value={addForm.rpcUrl}
                  placeholder="https://api.testnet.iota.cafe"
                  spellCheck={false}
                  onChange={(e) => setAddForm((f) => ({ ...f, rpcUrl: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">API-Base (optional)</Label>
                <Input
                  className="h-8 text-xs"
                  value={addForm.apiBaseUrl}
                  placeholder="http://127.0.0.1:3342"
                  spellCheck={false}
                  onChange={(e) => setAddForm((f) => ({ ...f, apiBaseUrl: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Ohne gültige Package- + Mailbox-ID (0x…64 Hex) wird das Profil als „nicht konfiguriert“ gespeichert.
            </p>
            <Button type="button" size="sm" onClick={onAdd}>
              Profil speichern
            </Button>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {msg ? (
        <p
          className={cn(
            'text-xs',
            msgTone === 'error' && 'text-destructive',
            msgTone === 'success' && 'text-emerald-700 dark:text-emerald-300',
            msgTone === 'neutral' && 'text-muted-foreground'
          )}
          role="status"
        >
          {msg}
        </p>
      ) : null}

      <AlertDialog open={pendingSwitch !== null} onOpenChange={(o) => !o && setPendingSwitch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
              {warning?.title}
            </AlertDialogTitle>
          </AlertDialogHeader>
          {warning ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">{warning.targetLine}</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {warning.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                Hinweis: Wechsel wirkt clientseitig (Registry/Banner) — die Server-Installation bleibt bei ihrer
                festen <span className="font-mono">.env</span> (§7.5, kein Hot-Swap).
              </p>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSwitch(null)}>
              {warning?.cancelLabel ?? 'Abbrechen'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitch}>
              {warning?.confirmLabel ?? 'Einsatz wechseln'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
