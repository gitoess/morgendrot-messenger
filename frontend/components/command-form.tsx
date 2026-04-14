'use client'

import { useState } from 'react'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { executeCommand, type CommandResponse } from '@/frontend/lib/api'
import type { FormField, CommandResult } from '@/lib/types'

interface CommandFormProps {
  title: string
  description?: string
  command: string
  fields: FormField[]
  onSuccess?: (response: CommandResponse) => void
}

export function CommandForm({
  title,
  description,
  command,
  fields,
  onSuccess,
}: CommandFormProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [result, setResult] = useState<CommandResult>({ status: 'idle' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult({ status: 'loading' })

    // Build args array from field values in order
    const args = fields
      .map((field) => values[field.name] || '')
      .filter((v) => v !== '')

    try {
      const response = await executeCommand(command, args)
      if (response.ok) {
        setResult({
          status: 'success',
          message: response.message || 'Erfolgreich ausgeführt',
        })
        onSuccess?.(response)
      } else {
        setResult({
          status: 'error',
          message: response.error || 'Fehler bei der Ausführung',
        })
      }
    } catch {
      setResult({
        status: 'error',
        message: 'Verbindungsfehler',
      })
    }
  }

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            {field.type === 'textarea' ? (
              <Textarea
                id={field.name}
                placeholder={field.placeholder}
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                required={field.required}
                className="resize-none"
                rows={3}
              />
            ) : (
              <Input
                id={field.name}
                type={field.type || 'text'}
                placeholder={field.placeholder}
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                required={field.required}
              />
            )}
            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={result.status === 'loading'}>
          {result.status === 'loading' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Läuft...
            </>
          ) : (
            'Ausführen'
          )}
        </Button>

        {result.status === 'success' && (
          <span className="flex items-center gap-1.5 text-sm text-primary">
            <CheckCircle className="h-4 w-4" />
            {result.message}
          </span>
        )}

        {result.status === 'error' && (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <XCircle className="h-4 w-4" />
            {result.message}
          </span>
        )}
      </div>
    </form>
  )
}
