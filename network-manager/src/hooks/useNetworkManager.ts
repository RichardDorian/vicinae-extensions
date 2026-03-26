import { spawn } from 'node:child_process';

import { useCallback, useEffect, useState } from 'react';

export enum ConnectionType {
  ETHERNET = '802-3-ethernet',
  LEGACY_ETHERNET = 'ethernet',
  WIFI = '802-11-wireless',
  LOOPBACK = 'loopback',
  BRIDGE = 'bridge',
  VPN = 'vpn',
  WIREGUARD = 'wireguard',
}

export enum ConnectionState {
  ACTIVATED = 'activated',
  ACTIVATING = 'activating',
  DEACTIVATING = 'deactivating',
  DEACTIVATED = 'deactivated',
}

export type Connection = {
  name: string;
  uuid: string;
  type: ConnectionType;
  device?: string;
  state?: ConnectionState;
};

export type Device = {
  name: string;
  type: string;
  state: string;
};

export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const runNmcli = useCallback(
    (args: string[]) =>
      new Promise<void>((resolve, reject) => {
        const proc = spawn('nmcli', args);

        let stderr = '';

        proc.stderr.on('data', (chunk) => {
          stderr += chunk;
        });

        proc.addListener('exit', (code) => {
          if (code !== 0) {
            reject(new Error(stderr.trim() || 'Failed to run nmcli command'));
            return;
          }

          resolve();
        });
      }),
    [],
  );

  const listConnections = useCallback(
    () =>
      new Promise<Connection[]>((resolve, reject) => {
        const proc = spawn('nmcli', [
          '-t',
          '-f',
          'NAME,UUID,TYPE,DEVICE,STATE',
          'connection',
        ]);

        let stdout = '';

        proc.stdout.on('data', (chunk) => {
          stdout += chunk;
        });

        proc.addListener('exit', (code) => {
          if (code !== 0) {
            reject(new Error('Failed to list connections'));
            return;
          }

          const parsed = stdout.split('\n').map((line) => {
            const [name, uuid, type, device, state] = line.split(':');
            return {
              name,
              uuid,
              type: type as ConnectionType,
              device,
              state: state as ConnectionState,
            };
          });

          resolve(parsed.filter(({ name }) => !!name));
        });
      }),
    [],
  );

  const listDevices = useCallback(
    () =>
      new Promise<Device[]>((resolve, reject) => {
        const proc = spawn('nmcli', ['-t', '-f', 'DEVICE,TYPE,STATE', 'device']);

        let stdout = '';

        proc.stdout.on('data', (chunk) => {
          stdout += chunk;
        });

        proc.addListener('exit', (code) => {
          if (code !== 0) {
            reject(new Error('Failed to list devices'));
            return;
          }

          const parsed = stdout.split('\n').map((line) => {
            const [name, type, state] = line.split(':');

            return { name, type, state };
          });

          resolve(parsed.filter(({ name }) => Boolean(name)));
        });
      }),
    [],
  );

  const refreshConnections = useCallback(async () => {
    setLoading(true);
    const [connections, devices] = await Promise.all([
      listConnections(),
      listDevices(),
    ]);
    setConnections(connections);
    setDevices(devices);

    setLoading(false);
  }, [listConnections, listDevices]);

  const waitForConnectionState = useCallback(
    async (connection: Connection, shouldBeConnected: boolean) => {
      const sleep = (ms: number) =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms);
        });

      const timeoutMs = 15000;
      const pollIntervalMs = 500;
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const [latestConnections, latestDevices] = await Promise.all([
          listConnections(),
          listDevices(),
        ]);
        setConnections(latestConnections);
        setDevices(latestDevices);

        const latest = latestConnections.find(
          (candidate) => candidate.uuid === connection.uuid,
        );

        const connected =
          latest?.state === ConnectionState.ACTIVATED ||
          Boolean(latest?.device && latest.device !== '--');

        if (connected === shouldBeConnected) {
          return;
        }

        await sleep(pollIntervalMs);
      }

      throw new Error(
        shouldBeConnected
          ? 'Timed out waiting for connection to establish'
          : 'Timed out waiting for connection to disconnect',
      );
    },
    [listConnections, listDevices],
  );

  useEffect(() => {
    refreshConnections();
  }, [refreshConnections]);

  const connectConnection = useCallback(
    async (connection: Connection) => {
      await runNmcli(['connection', 'up', 'uuid', connection.uuid]);
      await waitForConnectionState(connection, true);
    },
    [runNmcli, waitForConnectionState],
  );

  const disconnectConnection = useCallback(
    async (connection: Connection) => {
      await runNmcli(['connection', 'down', 'uuid', connection.uuid]);
      await waitForConnectionState(connection, false);
    },
    [runNmcli, waitForConnectionState],
  );

  return {
    loading,
    connections,
    devices,
    refreshConnections,
    connectConnection,
    disconnectConnection,
  };
}
