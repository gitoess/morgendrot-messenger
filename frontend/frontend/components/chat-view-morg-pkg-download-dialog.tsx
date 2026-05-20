'use client'

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
import { createMorgPkgDownloadAction } from '@/frontend/lib/sneakernet-export'

export type MorgPkgDownloadOffer = {
  pkg: Record<string, unknown>
  stem: string
  message: string
}

export function ChatViewMorgPkgDownloadDialog(p: {
  offer: MorgPkgDownloadOffer | null
  onClose: () => void
}) {
  const { offer, onClose } = p
  if (!offer) return null

  const save = createMorgPkgDownloadAction(offer.pkg, offer.stem)

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>.morg-pkg bereit</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <span className="block">{offer.message}</span>
            <span className="block text-muted-foreground">
              Tippe „Datei speichern“ — der Browser blockiert oft automatische Downloads nach der Verarbeitung.
              Konsolen-Meldungen zu Geolocation oder „message channel closed“ kommen meist von Browser-Erweiterungen,
              nicht von diesem Export.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Schließen</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            onClick={() => {
              save()
              onClose()
            }}
          >
            Datei speichern
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
