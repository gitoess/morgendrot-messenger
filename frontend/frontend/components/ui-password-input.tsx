'use client'

import { useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type UiPasswordInputProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
  className?: string
  inputClassName?: string
  onEnter?: () => void
  label?: ReactNode
}

/** Passwortfeld mit Anzeigen/Verbergen — für Unlock, Settings, Dialoge. */
export function UiPasswordInput(p: UiPasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const input = (
    <div className={cn('relative', p.className)}>
      <Input
        id={p.id}
        type={visible ? 'text' : 'password'}
        placeholder={p.placeholder}
        value={p.value}
        disabled={p.disabled}
        onChange={(e) => p.onChange(e.target.value)}
        onKeyDown={p.onEnter ? (e) => e.key === 'Enter' && p.onEnter?.() : undefined}
        autoComplete={p.autoComplete}
        className={cn('pr-10', p.inputClassName)}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}
        tabIndex={-1}
        disabled={p.disabled}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  )
  if (!p.label) return input
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{p.label}</span>
      <div className="mt-1">{input}</div>
    </label>
  )
}
