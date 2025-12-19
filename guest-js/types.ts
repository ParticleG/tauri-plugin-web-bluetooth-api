/**
 * Options used when requesting a Bluetooth device.
 */
export interface RequestDeviceOptions {
  acceptAllDevices?: boolean
  filters?: DeviceFilter[]
  optionalServices?: string[]
  scanTimeoutMs?: number
}

/**
 * Filter for narrowing device discovery.
 */
export interface DeviceFilter {
  services?: string[]
  name?: string
  namePrefix?: string
}

/**
 * Basic Bluetooth device information.
 */
export interface BluetoothDevice {
  id: string
  name?: string
  uuids: string[]
  watchingAdvertisements: boolean
  connected: boolean
}

/**
 * Discovered GATT server details for a device.
 */
export interface GattServerInfo {
  deviceId: string
  connected: boolean
  services: BluetoothService[]
}

/**
 * Bluetooth service description.
 */
export interface BluetoothService {
  uuid: string
  isPrimary: boolean
  characteristics: BluetoothCharacteristic[]
}

/**
 * Bluetooth characteristic description.
 */
export interface BluetoothCharacteristic {
  uuid: string
  properties: CharacteristicProperties
  descriptors: BluetoothDescriptor[]
}

/**
 * Characteristic property flags.
 */
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

/**
 * Descriptor reference for a characteristic.
 */
export interface BluetoothDescriptor {
  uuid: string
}

/**
 * Encoded value container (base64 string).
 */
export interface BluetoothValue {
  value: string
}

/**
 * Payload emitted when a characteristic value changes.
 */
export interface NotificationEventPayload {
  deviceId: string
  serviceUuid: string
  characteristicUuid: string
  value: string
}

/**
 * Payload emitted when a device disconnects.
 */
export interface DeviceEventPayload {
  deviceId: string
}
