'use client'

import { Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TechnicalIdRow, TechnicalIdSection } from '@/frontend/components/technical-id-row'
import type { MessengerInfoSection } from '@/frontend/lib/messenger-entity-info-model'

export type MessengerEntityInfoDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  sections: MessengerInfoSection[]
  /** Optional primary action (z. B. Gruppe verwalten). */
  primaryAction?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
}

export function MessengerEntityInfoDialog(p: MessengerEntityInfoDialogProps) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 shrink-0 text-foreground/70" aria-hidden />
            {p.title}
          </DialogTitle>
          {p.description ? <DialogDescription>{p.description}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-4">
          {p.sections.map((section) => (
            <TechnicalIdSection key={section.id} title={section.title}>
              {section.fields.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {section.note ?? 'Keine Einträge.'}
                </p>
              ) : (
                <>
                  {section.fields.map((f) => (
                    <TechnicalIdRow
                      key={f.id}
                      label={f.label}
                      value={f.value}
                      copyable={f.copyable}
                      hint={f.hint}
                      href={f.href}
                      hrefLabel={f.hrefLabel}
                    />
                  ))}
                  {section.note ? (
                    <p className="border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                      {section.note}
                    </p>
                  ) : null}
                </>
              )}
            </TechnicalIdSection>
          ))}
        </div>

        {p.primaryAction || p.secondaryAction ? (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {p.primaryAction ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  p.primaryAction?.onClick()
                }}
              >
                {p.primaryAction.label}
              </Button>
            ) : null}
            {p.secondaryAction ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  p.secondaryAction?.onClick()
                }}
              >
                {p.secondaryAction.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
