import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

const NAMESPACE = 'plugin:web-bluetooth'
export const EVENTS = {
  characteristicValueChanged: 'web-bluetooth://characteristic-value-changed',
  gattServerDisconnected: 'web-bluetooth://gattserver-disconnected',
} as const

const call = async <T>(command: string, payload?: Record<string, unknown>): Promise<T> => {
  return invoke<T>(`${NAMESPACE}|${command}`, payload ?? {})
}

export async function ping(value: string): Promise<string | null> {
  const response = await call<{ value?: string }>('ping', {
    payload: { value },
  })
  return response.value ?? null
}

export async function getAvailability(): Promise<boolean> {
  return call<boolean>('get_availability')
}

export async function getDevices(): Promise<BluetoothDevice[]> {
  return call<BluetoothDevice[]>('get_devices')
}

export async function requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice> {
  return call<BluetoothDevice>('request_device', { options })
}

export async function connectGATT(deviceId: string): Promise<GattServerInfo> {
  return call<GattServerInfo>('connect_gatt', { request: { deviceId } })
}

export async function disconnectGATT(deviceId: string): Promise<void> {
  await call('disconnect_gatt', { request: { deviceId } })
}

export async function forgetDevice(deviceId: string): Promise<void> {
  await call('forget_device', { request: { deviceId } })
}

export async function getPrimaryServices(deviceId: string, serviceUuid?: string): Promise<BluetoothService[]> {
  return call<BluetoothService[]>('get_primary_services', {
    request: {
      deviceId,
      serviceUuid,
    },
  })
}

export async function getCharacteristics(
  deviceId: string,
  serviceUuid: string,
  characteristicUuid?: string,
): Promise<BluetoothCharacteristic[]> {
  return call<BluetoothCharacteristic[]>('get_characteristics', {
    request: {
      deviceId,
      serviceUuid,
      characteristicUuid,
    },
  })
}

export async function readCharacteristicValue(
  deviceId: string,
  serviceUuid: string,
  characteristicUuid: string,
): Promise<BluetoothValue> {
  return call<BluetoothValue>('read_characteristic_value', {
    request: { deviceId, serviceUuid, characteristicUuid },
  })
}

export async function writeCharacteristicValue(
  deviceId: string,
  serviceUuid: string,
  characteristicUuid: string,
  value: string,
  withResponse = true,
): Promise<void> {
  await call('write_characteristic_value', {
    request: { deviceId, serviceUuid, characteristicUuid, value, withResponse },
  })
}

export async function startNotifications(deviceId: string, serviceUuid: string, characteristicUuid: string): Promise<void> {
  await call('start_notifications', {
    request: { deviceId, serviceUuid, characteristicUuid },
  })
}

export async function stopNotifications(deviceId: string, serviceUuid: string, characteristicUuid: string): Promise<void> {
  await call('stop_notifications', {
    request: { deviceId, serviceUuid, characteristicUuid },
  })
}

export async function onCharacteristicValueChanged(
  handler: (payload: NotificationEventPayload) => void,
): Promise<UnlistenFn> {
  const unlisten = await listen<NotificationEventPayload>(EVENTS.characteristicValueChanged, (event) => {
    handler(event.payload)
  })
  return unlisten
}

export async function onGattServerDisconnected(
  handler: (payload: DeviceEventPayload) => void,
): Promise<UnlistenFn> {
  const unlisten = await listen<DeviceEventPayload>(EVENTS.gattServerDisconnected, (event) => {
    handler(event.payload)
  })
  return unlisten
}

export interface RequestDeviceOptions {
  acceptAllDevices?: boolean
  filters?: DeviceFilter[]
  optionalServices?: string[]
  scanTimeoutMs?: number
}

export interface DeviceFilter {
  services?: string[]
  name?: string
  namePrefix?: string
}

export interface BluetoothDevice {
  id: string
  name?: string
  uuids: string[]
  watchingAdvertisements: boolean
  connected: boolean
}

export interface GattServerInfo {
  deviceId: string
  connected: boolean
  services: BluetoothService[]
}

export interface BluetoothService {
  uuid: string
  isPrimary: boolean
  characteristics: BluetoothCharacteristic[]
}

export interface BluetoothCharacteristic {
  uuid: string
  properties: CharacteristicProperties
  descriptors: BluetoothDescriptor[]
}

export interface CharacteristicProperties {
  broadcast: boolean
  read: boolean
  writeWithoutResponse: boolean
  write: boolean
  notify: boolean
  indicate: boolean
  authenticatedSignedWrites: boolean
  reliableWrite: boolean
  writableAuxiliaries: boolean
}

export interface BluetoothDescriptor {
  uuid: string
}

export interface BluetoothValue {
  value: string
}

export interface NotificationEventPayload {
  deviceId: string
  serviceUuid: string
  characteristicUuid: string
  value: string
}

export interface DeviceEventPayload {
  deviceId: string
}
