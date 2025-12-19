<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getAvailability,
    getDevices,
    requestDevice,
    connectGATT,
    disconnectGATT,
    forgetDevice,
    getPrimaryServices,
    getCharacteristics,
    readCharacteristicValue,
    writeCharacteristicValue,
    startNotifications,
    stopNotifications,
    onCharacteristicValueChanged,
    onGattServerDisconnected,
    type BluetoothDevice,
    type BluetoothService,
    type BluetoothCharacteristic,
    type DeviceFilter,
    type RequestDeviceOptions,
    type NotificationEventPayload,
    type DeviceEventPayload,
  } from 'tauri-plugin-web-bluetooth-api';

  type ActivityIntent = 'info' | 'error' | 'event';

  interface ActivityLog {
    id: number;
    ts: string;
    label: string;
    intent: ActivityIntent;
    payload?: string;
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let availability: boolean | null = $state(null);
  let devices: BluetoothDevice[] = $state([]);
  let activeDeviceId: string | null = $state(null);
  let services: BluetoothService[] = $state([]);
  let characteristics: BluetoothCharacteristic[] = $state([]);
  let lastRead: { base64: string; utf8: string; hex: string } | null = $state(null);
  let subscribedKeys: string[] = $state([]);

  let acceptAllDevices = $state(true);
  let filterServicesInput = $state('');
  let optionalServicesInput = $state('');
  let filterName = $state('');
  let filterNamePrefix = $state('');
  let scanTimeoutMs = $state(10000);

  let primaryServiceFilter = $state('');
  let workingServiceUuid = $state('');
  let workingCharacteristicUuid = $state('');

  let writeValue = $state('');
  let writeMode = $state<'text' | 'base64' | 'hex'>('text');
  let withResponse = $state(true);

  let logEntries: ActivityLog[] = $state([]);
  let busy: Record<string, boolean> = $state({});
  let logCounter = 0;
  let logDrawerOpen = $state(false);

  let unlistenNotifications: (() => void) | null = null;
  let unlistenDisconnect: (() => void) | null = null;

  const availabilityLabel = $derived.by(() => {
    if (availability === null) return 'Adapter unknown';
    return availability ? 'Adapter ready' : 'Adapter unavailable';
  });

  const availabilityStateClass = $derived.by(() => {
    if (availability === null) return 'pending';
    return availability ? 'online' : 'offline';
  });

  const currentDevice = $derived.by<BluetoothDevice | null>(
    () => devices.find((device) => device.id === activeDeviceId) ?? null,
  );

  const parseList = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const describeError = (error: unknown) => {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    if (typeof error === 'string') {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  };

  const log = (label: string, payload?: unknown, intent: ActivityIntent = 'info') => {
    const formatted =
      payload === undefined
        ? undefined
        : typeof payload === 'string'
          ? payload
          : (() => {
              try {
                return JSON.stringify(payload, null, 2);
              } catch {
                return String(payload);
              }
            })();

    logEntries = [
      {
        id: ++logCounter,
        ts: new Date().toLocaleTimeString(),
        label,
        intent,
        payload: formatted,
      },
      ...logEntries,
    ].slice(0, 200);
  };

  const setBusy = (key: string, state: boolean) => {
    busy = { ...busy, [key]: state };
  };

  const run = async (key: string, task: () => Promise<void>) => {
    if (busy[key]) return;
    setBusy(key, true);
    try {
      await task();
    } catch (error) {
      log(`Command ${key} failed`, describeError(error), 'error');
    } finally {
      setBusy(key, false);
    }
  };

  const ensureDevice = () => {
    if (!activeDeviceId) {
      throw new Error('Select or request a device first');
    }
    return activeDeviceId;
  };

  const refreshAvailability = async () => {
    availability = await getAvailability();
    log('get_availability', { availability });
  };

  const refreshDevices = async () => {
    const result = await getDevices();
    devices = result;
    if (activeDeviceId && !result.some((device) => device.id === activeDeviceId)) {
      activeDeviceId = null;
    }
    log('get_devices', result);
  };

  const requestNewDevice = async () => {
    const optionalServices = parseList(optionalServicesInput);
    const servicesFilter = parseList(filterServicesInput);
    const hasFilterDetails =
      servicesFilter.length > 0 ||
      filterName.trim().length > 0 ||
      filterNamePrefix.trim().length > 0;
    const filters: DeviceFilter[] = hasFilterDetails
      ? [
          {
            services: servicesFilter.length ? servicesFilter : undefined,
            name: filterName || undefined,
            namePrefix: filterNamePrefix || undefined,
          },
        ]
      : [];

    if (!acceptAllDevices && !filters.length) {
      throw new Error('Provide at least one filter or enable "Accept all devices"');
    }

    const baseOptions: RequestDeviceOptions = {
      optionalServices: optionalServices.length ? optionalServices : undefined,
      scanTimeoutMs: scanTimeoutMs || undefined,
    };

    const options: RequestDeviceOptions = acceptAllDevices
      ? { ...baseOptions, acceptAllDevices: true }
      : { ...baseOptions, filters };

    const device = await requestDevice(options);
    selectDevice(device);
    await refreshDevices();
  };

  const selectDevice = (device: BluetoothDevice) => {
    activeDeviceId = device.id;
    log('device_selected', device);
  };

  const connectDevice = async () => {
    const deviceId = ensureDevice();
    const info = await connectGATT(deviceId);
    log('connect_gatt', info);
  };

  const disconnectDevice = async () => {
    const deviceId = ensureDevice();
    await disconnectGATT(deviceId);
    log('disconnect_gatt', { deviceId });
  };

  const forgetDeviceById = async (deviceId: string) => {
    await forgetDevice(deviceId);
    if (deviceId === activeDeviceId) {
      activeDeviceId = null;
    }
    await refreshDevices();
    log('forget_device', { deviceId });
  };

  const fetchServices = async () => {
    const deviceId = ensureDevice();
    services = await getPrimaryServices(deviceId, primaryServiceFilter || undefined);
    log('get_primary_services', services);
  };

  const fetchCharacteristics = async () => {
    const deviceId = ensureDevice();
    if (!workingServiceUuid) {
      throw new Error('Set a Service UUID before loading characteristics');
    }
    characteristics = await getCharacteristics(
      deviceId,
      workingServiceUuid,
      workingCharacteristicUuid || undefined,
    );
    log('get_characteristics', characteristics);
  };

  const decodeValue = (value: string) => {
    try {
      const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
      const utf8 = (() => {
        try {
          return decoder.decode(bytes);
        } catch {
          return '(failed to decode as UTF-8)';
        }
      })();
      const hex = Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(' ');
      return { utf8, hex };
    } catch (error) {
      log('Base64 decode failed', describeError(error), 'error');
      return { utf8: '(decode error)', hex: '' };
    }
  };

  const readCharacteristic = async () => {
    const deviceId = ensureDevice();
    if (!workingServiceUuid || !workingCharacteristicUuid) {
      throw new Error('Set Service and Characteristic before reading');
    }
    const result = await readCharacteristicValue(
      deviceId,
      workingServiceUuid,
      workingCharacteristicUuid,
    );
    const decoded = decodeValue(result.value);
    lastRead = { base64: result.value, ...decoded };
    log('read_characteristic_value', { ...decoded, base64: result.value });
  };

  const encodeWritePayload = () => {
    const trimmed = writeValue.trim();
    if (!trimmed) {
      throw new Error('Provide data before writing');
    }
    if (writeMode === 'base64') {
      return trimmed;
    }
    if (writeMode === 'text') {
      const buffer = encoder.encode(trimmed);
      return btoa(String.fromCharCode(...buffer));
    }
    const sanitized = trimmed.replace(/[^0-9a-fA-F]/g, '');
    if (sanitized.length === 0 || sanitized.length % 2 !== 0) {
      throw new Error('Hex payload must contain an even number of digits');
    }
    const bytes = sanitized.match(/.{1,2}/g)?.map((pair) => parseInt(pair, 16));
    if (!bytes?.length) {
      throw new Error('Invalid hex payload');
    }
    return btoa(String.fromCharCode(...bytes));
  };

  const writeCharacteristic = async () => {
    const deviceId = ensureDevice();
    if (!workingServiceUuid || !workingCharacteristicUuid) {
      throw new Error('Set Service and Characteristic before writing');
    }
    const payload = encodeWritePayload();
    await writeCharacteristicValue(
      deviceId,
      workingServiceUuid,
      workingCharacteristicUuid,
      payload,
      withResponse,
    );
    log('write_characteristic_value', {
      withResponse,
      payloadMode: writeMode,
    });
  };

  const subKey = (deviceId: string, serviceUuid: string, characteristicUuid: string) =>
    `${deviceId}|${serviceUuid}|${characteristicUuid}`;

  const startNotify = async () => {
    const deviceId = ensureDevice();
    if (!workingServiceUuid || !workingCharacteristicUuid) {
      throw new Error('Set Service and Characteristic before subscribing');
    }
    await startNotifications(deviceId, workingServiceUuid, workingCharacteristicUuid);
    const key = subKey(deviceId, workingServiceUuid, workingCharacteristicUuid);
    if (!subscribedKeys.includes(key)) {
      subscribedKeys = [...subscribedKeys, key];
    }
    log('start_notifications', {
      deviceId,
      serviceUuid: workingServiceUuid,
      characteristicUuid: workingCharacteristicUuid,
    });
  };

  const stopNotify = async () => {
    const deviceId = ensureDevice();
    if (!workingServiceUuid || !workingCharacteristicUuid) {
      throw new Error('Set Service and Characteristic before unsubscribing');
    }
    await stopNotifications(deviceId, workingServiceUuid, workingCharacteristicUuid);
    const key = subKey(deviceId, workingServiceUuid, workingCharacteristicUuid);
    subscribedKeys = subscribedKeys.filter((item) => item !== key);
    log('stop_notifications', {
      deviceId,
      serviceUuid: workingServiceUuid,
      characteristicUuid: workingCharacteristicUuid,
    });
  };

  const handleNotification = (payload: NotificationEventPayload) => {
    const decoded = decodeValue(payload.value);
    log(
      'event characteristic_value_changed',
      {
        ...payload,
        utf8: decoded.utf8,
        hex: decoded.hex,
      },
      'event',
    );
  };

  const handleDisconnectEvent = (payload: DeviceEventPayload) => {
    log('event gattserver_disconnected', payload, 'event');
    if (payload.deviceId === activeDeviceId) {
      subscribedKeys = subscribedKeys.filter((key) => !key.startsWith(`${payload.deviceId}|`));
    }
  };

  const attachEventListeners = async () => {
    unlistenNotifications?.();
    unlistenDisconnect?.();
    unlistenNotifications = await onCharacteristicValueChanged(handleNotification);
    unlistenDisconnect = await onGattServerDisconnected(handleDisconnectEvent);
  };

  const isSubscribed = () => {
    if (!activeDeviceId || !workingServiceUuid || !workingCharacteristicUuid) return false;
    return subscribedKeys.includes(
      subKey(activeDeviceId, workingServiceUuid, workingCharacteristicUuid),
    );
  };

  onMount(() => {
    (async () => {
      await attachEventListeners();
      await Promise.allSettled([refreshAvailability(), refreshDevices()]);
      log('Example UI ready');
    })();

    return () => {
      unlistenNotifications?.();
      unlistenDisconnect?.();
    };
  });
</script>

<main class="app-shell">
  <header class="hero">
    <div>
      <p class="eyebrow">Tauri Plugin · Web Bluetooth</p>
      <h1>Bluetooth Playground</h1>
      <p>
        Trigger every plugin command, inspect payloads, and watch events without leaving this
        starter app.
      </p>
    </div>
    <div class="hero-status">
      <span class={`status-dot ${availabilityStateClass}`}></span>
      <span>{availabilityLabel}</span>
    </div>
  </header>

  <div class="content-with-log">
    <section class="grid">
      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="panel-eyebrow">request_device</p>
            <h2>Discovery filters</h2>
          </div>
        </div>

        <label class="field checkbox">
          <input type="checkbox" bind:checked={acceptAllDevices} />
          <span>Accept all devices</span>
        </label>

        <label class="field">
          <span>Filter services (comma separated UUIDs)</span>
          <input placeholder="1234, abcd" bind:value={filterServicesInput} />
        </label>

        <label class="field">
          <span>Optional services</span>
          <input placeholder="battery_service" bind:value={optionalServicesInput} />
        </label>

        <div class="field-pair">
          <label class="field">
            <span>Name match</span>
            <input placeholder="Exact name" bind:value={filterName} />
          </label>
          <label class="field">
            <span>Name prefix</span>
            <input placeholder="Sensor" bind:value={filterNamePrefix} />
          </label>
        </div>

        <label class="field">
          <span>Scan timeout (ms)</span>
          <input type="number" min="1000" step="500" bind:value={scanTimeoutMs} />
        </label>

        <button
          class="primary"
          disabled={busy.request}
          onclick={() => run('request', requestNewDevice)}>request_device</button
        >
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="panel-eyebrow">Adapter</p>
            <h2>Session quick actions</h2>
          </div>
        </div>

        <div class="action-row">
          <button
            disabled={busy.availability}
            onclick={() => run('availability', refreshAvailability)}
          >
            Refresh with
            <code>get_availability()</code>
          </button>
          <button disabled={busy.devices} onclick={() => run('devices', refreshDevices)}>
            get_devices
          </button>
        </div>

        <div class="session-grid">
          <article>
            <h3>Active device</h3>
            {#if currentDevice}
              <p class="meta">{currentDevice.name ?? 'Unnamed device'}</p>
              <p class="muted">{currentDevice.id}</p>
              <p class="pill-list">
                Services: {currentDevice.uuids?.length ?? 0} · Connected: {currentDevice.connected
                  ? 'yes'
                  : 'no'}
              </p>
            {:else}
              <p class="muted">No device selected yet.</p>
            {/if}
            <div class="mini-buttons">
              <button
                disabled={!currentDevice || busy.connect}
                onclick={() => run('connect', connectDevice)}>connect_gatt</button
              >
              <button
                disabled={!currentDevice || busy.disconnect}
                onclick={() => run('disconnect', disconnectDevice)}>disconnect_gatt</button
              >
            </div>
          </article>
          <article>
            <h3>Notifications</h3>
            <p class="muted">
              Listeners for characteristic changes and GATT disconnects stay attached.
            </p>
            <p class={`pill ${isSubscribed() ? 'pill-live' : ''}`}>
              {isSubscribed()
                ? 'Subscribed to current characteristic'
                : 'No active subscription for current selection'}
            </p>
          </article>
        </div>
      </section>

      <section class="panel span-2">
        <div class="panel-heading">
          <div>
            <p class="panel-eyebrow">get_devices · forget_device</p>
            <h2>Cached devices</h2>
          </div>
        </div>

        {#if devices.length}
          <ul class="device-list">
            {#each devices as device (device.id)}
              {@const deviceId = (device as BluetoothDevice).id}
              <li class:selected={deviceId === activeDeviceId}>
                <div>
                  <strong>{device.name ?? 'Unnamed device'}</strong>
                  <div class="muted">{deviceId}</div>
                  <div class="meta">
                    Connected: {device.connected ? 'yes' : 'no'} · Watching: {device.watchingAdvertisements
                      ? 'yes'
                      : 'no'}
                  </div>
                </div>
                <div class="mini-buttons">
                  <button onclick={() => selectDevice(device)}>Use</button>
                  <button
                    class="ghost"
                    disabled={busy['forget-' + deviceId]}
                    onclick={() => run('forget-' + deviceId, () => forgetDeviceById(deviceId))}
                  >
                    forget_device
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="muted">No cached devices yet. Request one to populate this list.</p>
        {/if}
      </section>

      <section class="panel span-2">
        <div class="panel-heading">
          <div>
            <p class="panel-eyebrow">get_primary_services</p>
            <h2>Services overview</h2>
          </div>
          <div class="inline-controls">
            <input placeholder="Filter UUID (optional)" bind:value={primaryServiceFilter} />
            <button disabled={busy.services} onclick={() => run('services', fetchServices)}
              >Fetch</button
            >
          </div>
        </div>

        {#if services.length}
          <div class="service-grid">
            {#each services as service (service.uuid)}
              <article>
                <header>
                  <strong>{service.uuid}</strong>
                  <span class="pill">{service.isPrimary ? 'primary' : 'secondary'}</span>
                </header>
                {#if service.characteristics?.length}
                  <ul>
                    {#each service.characteristics as characteristic (characteristic.uuid)}
                      <li>
                        <span>{characteristic.uuid}</span>
                        <span class="muted">
                          {#if characteristic.properties.notify}notify
                          {/if}
                          {#if characteristic.properties.read}read
                          {/if}
                          {#if characteristic.properties.write}write
                          {/if}
                        </span>
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <p class="muted">
                    No characteristics returned (use get_characteristics for more data).
                  </p>
                {/if}
              </article>
            {/each}
          </div>
        {:else}
          <p class="muted">No services loaded. Fetch to mirror the primary services call.</p>
        {/if}
      </section>

      <section class="panel span-2">
        <div class="panel-heading">
          <div>
            <p class="panel-eyebrow">Characteristics · Notifications</p>
            <h2>Interact with GATT data</h2>
          </div>
        </div>

        <div class="field-pair">
          <label class="field">
            <span>Service UUID</span>
            <input placeholder="service uuid" bind:value={workingServiceUuid} />
          </label>
          <label class="field">
            <span>Characteristic UUID</span>
            <input placeholder="characteristic uuid" bind:value={workingCharacteristicUuid} />
          </label>
        </div>

        <div class="action-row">
          <button
            disabled={busy.characteristics}
            onclick={() => run('characteristics', fetchCharacteristics)}>get_characteristics</button
          >
          <button disabled={busy.read} onclick={() => run('read', readCharacteristic)}
            >read_characteristic_value</button
          >
          <button disabled={busy.write} onclick={() => run('write', writeCharacteristic)}
            >write_characteristic_value</button
          >
        </div>

        <div class="field">
          <span>Write payload</span>
          <textarea rows="3" placeholder="Type raw text, base64, or hex" bind:value={writeValue}
          ></textarea>
        </div>

        <div class="field-pair">
          <label class="field">
            <span>Encoding</span>
            <select bind:value={writeMode}>
              <option value="text">UTF-8 text</option>
              <option value="base64">Base64</option>
              <option value="hex">Hex</option>
            </select>
          </label>
          <label class="field checkbox">
            <input type="checkbox" bind:checked={withResponse} />
            <span>Write with response</span>
          </label>
        </div>

        <div class="action-row">
          <button
            class="ghost"
            disabled={busy.startNotify}
            onclick={() => run('startNotify', startNotify)}>start_notifications</button
          >
          <button
            class="ghost"
            disabled={busy.stopNotify}
            onclick={() => run('stopNotify', stopNotify)}>stop_notifications</button
          >
        </div>

        {#if lastRead}
          <div class="readout">
            <div>
              <span class="label">Base64</span>
              <code>{lastRead.base64}</code>
            </div>
            <div>
              <span class="label">UTF-8</span>
              <code>{lastRead.utf8}</code>
            </div>
            <div>
              <span class="label">Hex</span>
              <code>{lastRead.hex}</code>
            </div>
          </div>
        {/if}

        {#if characteristics.length}
          <details open>
            <summary>Last get_characteristics result</summary>
            <pre>{JSON.stringify(characteristics, null, 2)}</pre>
          </details>
        {/if}
      </section>
    </section>

    <aside class={`panel log-panel log-drawer ${logDrawerOpen ? 'open' : ''}`}>
      <div class="panel-heading log-drawer-head">
        <div>
          <p class="panel-eyebrow">Command & event log</p>
          <h2>Trace every payload</h2>
        </div>
        <button class="ghost close-log" onclick={() => (logDrawerOpen = false)}>Close</button>
      </div>

      <div class="log-scroll">
        {#if logEntries.length}
          <ul>
            {#each logEntries as entry (entry.id)}
              <li class={`log ${entry.intent}`}>
                <div class="log-head">
                  <span>{entry.ts}</span>
                  <strong>{entry.label}</strong>
                </div>
                {#if entry.payload}
                  <pre>{entry.payload}</pre>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="muted">Commands will appear here as you interact with the UI.</p>
        {/if}
      </div>
    </aside>

    <button class="log-toggle ghost" onclick={() => (logDrawerOpen = true)}>View log</button>
  </div>
</main>
