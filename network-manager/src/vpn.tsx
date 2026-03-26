import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  showToast,
  Toast,
} from '@vicinae/api';
import { useState } from 'react';
import {
  type Connection,
  ConnectionState,
  ConnectionType,
  useConnections,
} from './hooks/useNetworkManager';

const isConnected = (connection: Connection) =>
  connection.state === ConnectionState.ACTIVATED ||
  Boolean(connection.device && connection.device !== '--');

const isActivating = (connection: Connection) =>
  connection.state === ConnectionState.ACTIVATING;

const getVpnIcon = (connection: Connection, activating: boolean) => {
  if (activating) {
    return Icon.CircleProgress75;
  }

  if (connection.type === ConnectionType.WIREGUARD) {
    return isConnected(connection) ? Icon.Shield01 : Icon.Lock;
  }

  return isConnected(connection) ? Icon.Globe01 : Icon.LockDisabled;
};

const getVpnDescriptionWithState = (
  connection: Connection,
  activating: boolean,
) => {
  const protocol =
    connection.type === ConnectionType.WIREGUARD ? 'WireGuard' : 'VPN';
  const status = activating
    ? 'Connecting'
    : isConnected(connection)
      ? 'Connected'
      : '';

  if (connection.device && connection.device !== '--') {
    return status
      ? `${protocol} • ${status} on ${connection.device}`
      : `${protocol} • ${connection.device}`;
  }

  return status ? `${protocol} • ${status}` : protocol;
};

const sortVpnConnections = (connections: Connection[]) =>
  [...connections].sort((a, b) => {
    const connectedSort = Number(isConnected(b)) - Number(isConnected(a));
    if (connectedSort !== 0) return connectedSort;

    return a.name.localeCompare(b.name);
  });

export default function VpnCommand() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [pendingConnectUuids, setPendingConnectUuids] = useState<Set<string>>(
    new Set(),
  );

  const {
    loading,
    connections,
    connectConnection,
    disconnectConnection,
    refreshConnections,
  } = useConnections();

  const vpnConnections = sortVpnConnections(
    connections.filter((connection) =>
      [ConnectionType.VPN, ConnectionType.WIREGUARD].includes(connection.type),
    ),
  );

  const isConnectionActivating = (connection: Connection) =>
    isActivating(connection) || pendingConnectUuids.has(connection.uuid);

  const handleConnect = async (connection: Connection) => {
    setPendingConnectUuids((previous) => {
      const next = new Set(previous);
      next.add(connection.uuid);
      return next;
    });

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: 'Connecting VPN...',
      message: `Connecting ${connection.name}`,
    });
    setIsConnecting(true);

    try {
      await connectConnection(connection);
      toast.style = Toast.Style.Success;
      toast.title = 'VPN connected';
      toast.message = `${connection.name} is now active`;
      await toast.update();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = 'VPN connection failed';
      toast.message =
        error instanceof Error ? error.message : 'Unable to connect profile';
      await toast.update();
    } finally {
      setIsConnecting(false);
      setPendingConnectUuids((previous) => {
        const next = new Set(previous);
        next.delete(connection.uuid);
        return next;
      });
    }
  };

  const handleDisconnect = async (connection: Connection) => {
    try {
      await disconnectConnection(connection);
      await showToast({
        style: Toast.Style.Success,
        title: 'VPN disconnected',
        message: `${connection.name} has been disconnected`,
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'VPN disconnect failed',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to disconnect profile',
      });
    }
  };

  return (
    <List
      searchBarPlaceholder='Search VPN profiles...'
      isLoading={loading || isConnecting}
      navigationTitle='VPN Profiles'
    >
      <List.Section title='VPN Profiles' subtitle='Connected profiles first'>
        {vpnConnections.map((connection) => {
          const activating = isConnectionActivating(connection);
          const connected = isConnected(connection) && !activating;

          return (
            <List.Item
              key={connection.uuid}
              title={connection.name}
              subtitle={getVpnDescriptionWithState(connection, activating)}
              icon={getVpnIcon(connection, activating)}
              accessories={[
                ...(activating
                  ? [
                      {
                        tag: {
                          value: 'Connecting',
                          color: Color.Yellow,
                        },
                      },
                    ]
                  : []),
                ...(connected
                  ? [
                      {
                        tag: {
                          value: 'Connected',
                          color: Color.Green,
                        },
                      },
                    ]
                  : []),
              ]}
              actions={
                <ActionPanel>
                  {connected ? (
                    <Action
                      title='Disconnect'
                      icon={Icon.Power}
                      onAction={() => handleDisconnect(connection)}
                    />
                  ) : activating ? (
                    <Action
                      title='Connecting...'
                      icon={Icon.CircleProgress75}
                      onAction={refreshConnections}
                    />
                  ) : (
                    <Action
                      title='Connect'
                      icon={Icon.Shield01}
                      onAction={() => handleConnect(connection)}
                    />
                  )}
                  <Action
                    title='Refresh'
                    icon={Icon.ArrowClockwise}
                    onAction={refreshConnections}
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
