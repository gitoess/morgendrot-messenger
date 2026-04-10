import type { DeviceStatus } from '../types'
import { executeCommand } from '@/frontend/lib/api/execute-command'

export const getDeviceStatus = () => executeCommand<DeviceStatus[]>('/device-status', [])

export const sendHeartbeat = () => executeCommand('/heartbeat', [])

export const setHeartbeatInterval = (ms: number) =>
  executeCommand('/set-heartbeat-interval', [ms])

export const setHeartbeatEnabled = (enabled: boolean) =>
  executeCommand('/set-heartbeat-enabled', [enabled ? 'true' : 'false'])
