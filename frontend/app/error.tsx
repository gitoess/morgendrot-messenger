'use client'

import { useEffect } from 'react'
import {
  hardReloadAfterChunkFailure,
  isChunkLoadErrorMessage,
} from '@/frontend/lib/chunk-load-error'
import { toastFromUnknown } from '@/frontend/lib/show-app-error-toast'

export default function AppErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const msg = error.message || ''
  const chunkFail = isChunkLoadErrorMessage(msg)

  useEffect(() => {
    toastFromUnknown(error, 'APP_SEGMENT')
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center text-slate-200">
      <h1 className="text-lg font-semibold">Etwas ist schiefgelaufen</h1>
      <p className="max-w-md text-sm text-slate-400">
        {error.message || 'Unerwarteter Fehler. Bitte Seite neu laden oder Aktion erneut versuchen.'}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
      >
        Erneut versuchen
      </button>
      {chunkFail ? (
        <button
          type="button"
          onClick={() => void hardReloadAfterChunkFailure()}
          className="rounded-md border border-slate-500 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
        >
          Seite hart neu laden (Chunk-Fehler)
        </button>
      ) : null}
    </div>
  )
}
