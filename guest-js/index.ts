import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type {
  BluetoothCharacteristic,
  BluetoothDevice,
  BluetoothService,
  BluetoothValue,
  DeviceEventPayload,
  GattServerInfo,
  NotificationEventPayload,
  RequestDeviceOptions,
} from './types'

/**
 * Namespace used for IPC calls from the guest to the Tauri plugin.
 */
const NAMESPACE = 'plugin:web-bluetooth'

/**
 * Event names emitted by the plugin.
 *
 * - `characteristicValueChanged`: emits {@link NotificationEventPayload}
 * - `gattServerDisconnected`: emits {@link DeviceEventPayload}
 */
export const EVENTS = {
  characteristicValueChanged: 'web-bluetooth://characteristic-value-changed',
  gattServerDisconnected: 'web-bluetooth://gattserver-disconnected',
} as const

/**
 * Invoke a plugin command with an optional payload.
 *
 * @param command Command name without the namespace prefix.
 * @param payload Optional payload forwarded to the backend command.
 * @returns Value returned by the plugin command.
 */
const call = async <T>(command: string, payload?: Record<string, unknown>): Promise<T> => {
  return invoke<T>(`${NAMESPACE}|${command}`, payload ?? {})
}

/**
 * Check whether Web Bluetooth is available on the host.
 *
 * @returns `true` when the platform has a usable Bluetooth adapter.
 */
export async function getAvailability(): Promise<boolean> {
  return call<boolean>('get_availability')
}

/**
 * Return all known Bluetooth devices.
 *
 * @returns Cached devices previously discovered or connected.
 */
export async function getDevices(): Promise<BluetoothDevice[]> {
  return call<BluetoothDevice[]>('get_devices')
}

/**
 * Ask the user to select a Bluetooth device using the provided filters.
 *
 * @param options Selection rules; see {@link RequestDeviceOptions}.
 * @returns The device chosen by the user.
 */
export async function requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice> {
  return call<BluetoothDevice>('request_device', { options })
}

/**
 * Connect to a device and discover its GATT services.
 *
 * @param deviceId Internal device identifier from {@link getDevices} or {@link requestDevice}.
 * @returns Connection state plus discovered services.
 */
export async function connectGATT(deviceId: string): Promise<GattServerInfo> {
  return call<GattServerInfo>('connect_gatt', { request: { deviceId } })
}

/**
 * Disconnect from a connected device.
 *
 * @param deviceId Device identifier to disconnect.
 */
export async function disconnectGATT(deviceId: string): Promise<void> {
  await call('disconnect_gatt', { request: { deviceId } })
}

/**
 * Remove a device from the internal cache.
 *
 * @param deviceId Device identifier to remove from cache.
 */
export async function forgetDevice(deviceId: string): Promise<void> {
  await call('forget_device', { request: { deviceId } })
}

/**
 * List primary services for a device, optionally filtering by UUID.
 *
 * @param deviceId Device identifier to query.
 * @param serviceUuid Optional UUID to filter a single service.
 * @returns Primary services with their characteristics.
 */
export async function getPrimaryServices(deviceId: string, serviceUuid?: string): Promise<BluetoothService[]> {
  return call<BluetoothService[]>('get_primary_services', {
    request: {
      deviceId,
      serviceUuid,
    },
  })
}

/**
 * List characteristics for a given service, optionally filtering by characteristic UUID.
 *
 * @param deviceId Device identifier to query.
 * @param serviceUuid Target service UUID (16-bit, 32-bit, or 128-bit format).
 * @param characteristicUuid Optional characteristic UUID filter.
 * @returns Matching characteristics for the given service.
 */
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

/**
 * Read the value of a characteristic.
 *
 * The returned value is base64 encoded.
 *
 * @param deviceId Device identifier to query.
 * @param serviceUuid Service UUID containing the characteristic.
 * @param characteristicUuid Characteristic UUID to read.
 * @returns Base64-encoded value of the characteristic.
 */
export async function readCharacteristicValue(
  deviceId: string,
  serviceUuid: string,
  characteristicUuid: string,
): Promise<BluetoothValue> {
  return call<BluetoothValue>('read_characteristic_value', {
    request: { deviceId, serviceUuid, characteristicUuid },
  })
}

/**
 * Write a base64-encoded value to a characteristic.
 *
 * @param deviceId Device identifier to write to.
 * @param serviceUuid Service UUID containing the characteristic.
 * @param characteristicUuid Characteristic UUID to write.
 * @param value Base64-encoded payload to send.
 * @param withResponse Whether to request a write response (default: true).
 */
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

/**
 * Subscribe to notifications for a characteristic.
 *
 * @param deviceId Device identifier to subscribe on.
 * @param serviceUuid Service UUID containing the characteristic.
 * @param characteristicUuid Characteristic UUID to subscribe to.
 */
export async function startNotifications(deviceId: string, serviceUuid: string, characteristicUuid: string): Promise<void> {
  await call('start_notifications', {
    request: { deviceId, serviceUuid, characteristicUuid },
  })
}

/**
 * Stop notifications for a characteristic.
 *
 * @param deviceId Device identifier to unsubscribe from.
 * @param serviceUuid Service UUID containing the characteristic.
 * @param characteristicUuid Characteristic UUID to unsubscribe from.
 */
export async function stopNotifications(deviceId: string, serviceUuid: string, characteristicUuid: string): Promise<void> {
  await call('stop_notifications', {
    request: { deviceId, serviceUuid, characteristicUuid },
  })
}

/**
 * Listen for characteristic value changes emitted by the plugin.
 *
 * @param handler Callback receiving {@link NotificationEventPayload}.
 * @returns Unlisten function that removes the listener when called.
 */
export async function onCharacteristicValueChanged(
  handler: (payload: NotificationEventPayload) => void,
): Promise<UnlistenFn> {
  const unlisten = await listen<NotificationEventPayload>(EVENTS.characteristicValueChanged, (event) => {
    handler(event.payload)
  })
  return unlisten
}

/**
 * Listen for disconnection events emitted by the plugin.
 *
 * @param handler Callback receiving {@link DeviceEventPayload}.
 * @returns Unlisten function that removes the listener when called.
 */
export async function onGattServerDisconnected(
  handler: (payload: DeviceEventPayload) => void,
): Promise<UnlistenFn> {
  const unlisten = await listen<DeviceEventPayload>(EVENTS.gattServerDisconnected, (event) => {
    handler(event.payload)
  })
  return unlisten
}

export type {
  RequestDeviceOptions,
  DeviceFilter,
  BluetoothDevice,
  GattServerInfo,
  BluetoothService,
  BluetoothCharacteristic,
  CharacteristicProperties,
  BluetoothDescriptor,
  BluetoothValue,
  NotificationEventPayload,
  DeviceEventPayload,
} from './types'
