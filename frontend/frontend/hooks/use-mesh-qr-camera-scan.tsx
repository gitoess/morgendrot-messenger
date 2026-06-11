'use client'

import { useCallback, useRef, useState } from 'react'
import { QrCameraScanDialog } from '@/frontend/components/qr-camera-scan-dialog'
import { MESH_QR_WEB_CAMERA_SIGNAL, scanMeshBundleQrWithCamera } from '@/frontend/lib/mesh-qr'

export function useMeshQrCameraScan(dialogProps?: {
  title?: string
  description?: string
}) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const pendingRef = useRef<
    ((r: { bundleJson: string } | { error: string }) => void) | null
  >(null)

  const startScan = useCallback(async (): Promise<
    { bundleJson: string } | { error: string }
  > => {
    const s = await scanMeshBundleQrWithCamera()
    if ('bundleJson' in s) return s
    if (s.error === MESH_QR_WEB_CAMERA_SIGNAL) {
      return new Promise((resolve) => {
        pendingRef.current = resolve
        setCameraOpen(true)
      })
    }
    return s
  }, [])

  const onCameraScan = useCallback((text: string) => {
    pendingRef.current?.({ bundleJson: text })
    pendingRef.current = null
    setCameraOpen(false)
  }, [])

  const onCameraOpenChange = useCallback((open: boolean) => {
    setCameraOpen(open)
    if (!open && pendingRef.current) {
      pendingRef.current({ error: 'Scan abgebrochen.' })
      pendingRef.current = null
    }
  }, [])

  const cameraDialog = (
    <QrCameraScanDialog
      open={cameraOpen}
      onOpenChange={onCameraOpenChange}
      onScan={onCameraScan}
      title={dialogProps?.title}
      description={dialogProps?.description}
    />
  )

  return { startScan, cameraDialog }
}
