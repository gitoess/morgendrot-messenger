'use client'

import { useMemo } from 'react'
import type { ChatViewSetupPanelProps } from '@/frontend/components/chat-view-setup-panel'
import type { ChatViewMessengerPorts } from '@/frontend/features/messenger-ports'

export type ChatViewSetupPanelPropsDeps = {
  messengerPorts: Pick<ChatViewMessengerPorts, 'sendTransportRead' | 'meshDevice' | 'meshSetup'>
}

export function useChatViewSetupPanelProps(
  deps: ChatViewSetupPanelPropsDeps
): ChatViewSetupPanelProps {
  const { sendTransportRead, meshDevice, meshSetup } = deps.messengerPorts

  return useMemo(
    () => ({
      forcedTransport: sendTransportRead.forcedTransport,
      meshtastic: {
        bleSupported: meshDevice.bleSupported,
        serialSupported: meshDevice.serialSupported,
        transportKind: meshDevice.transportKind,
        connected: meshDevice.connected,
        connecting: meshDevice.connecting,
        error: meshDevice.error,
        lastRxDebug: meshDevice.lastRxDebug,
        meshRxSubscriptions: meshDevice.meshRxSubscriptions,
        connect: meshDevice.connect,
        connectBluetooth: meshDevice.connectBluetooth,
        connectUsb: meshDevice.connectUsb,
        disconnect: meshDevice.disconnect,
      },
      refreshContactDirectory: meshSetup.refreshContactDirectory,
      contactBleAddress: meshSetup.contactBleAddress,
      onContactBleAddressChange: meshSetup.onContactBleAddressChange,
      contactBleUuid: meshSetup.contactBleUuid,
      onContactBleUuidChange: meshSetup.onContactBleUuidChange,
      contactBleBusy: meshSetup.contactBleBusy,
      setContactBleBusy: meshSetup.setContactBleBusy,
      meshSyncMsg: meshSetup.meshSyncMsg,
      setMeshSyncMsg: meshSetup.setMeshSyncMsg,
    }),
    [sendTransportRead.forcedTransport, meshDevice, meshSetup]
  )
}
