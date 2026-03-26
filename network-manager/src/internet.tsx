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

const getConnectionIcon = (connection: Connection, activating: boolean) => {
  if (connection.type === ConnectionType.ETHERNET) {
    return isConnected(connection) ? Icon.Network : Icon.Plug;
  }

  if (activating) {
    return Icon.CircleProgress75;
  }

  return isConnected(connection) ? Icon.Wifi : Icon.WifiDisabled;
};

const getTypeOrder = (type: ConnectionType) => {
  if (
    type === ConnectionType.ETHERNET ||
    type === ConnectionType.LEGACY_ETHERNET
  ) {
    return 0;
  }

  return 1;
};

const sortInternetConnections = (connections: Connection[]) =>
  [...connections].sort((a, b) => {
    const typeSort = getTypeOrder(a.type) - getTypeOrder(b.type);
    if (typeSort !== 0) return typeSort;

    const connectedSort = Number(isConnected(b)) - Number(isConnected(a));
    if (connectedSort !== 0) return connectedSort;

    return a.name.localeCompare(b.name);
  });

export default function InternetCommand() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [pendingConnectUuids, setPendingConnectUuids] = useState(
    new Set<string>(),
  );

  const {
    loading,
    connections,
    devices,
    connectConnection,
    disconnectConnection,
    refreshConnections,
  } = useConnections();

  const hasEthernetCarrier = devices.some(
    (device) =>
      device.type === 'ethernet' &&
      !device.state.toLowerCase().includes('unavailable'),
  );

  const internetConnections = sortInternetConnections(
    connections.filter(
      (connection) =>
        connection.type === ConnectionType.WIFI ||
        ((connection.type === ConnectionType.ETHERNET ||
          connection.type === ConnectionType.LEGACY_ETHERNET) &&
          hasEthernetCarrier),
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
      title: 'Connecting...',
      message: `Connecting ${connection.name}`,
    });
    setIsConnecting(true);

    try {
      await connectConnection(connection);
      toast.style = Toast.Style.Success;
      toast.title = 'Connected';
      toast.message = `${connection.name} is now connected`;
      await toast.update();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = 'Connection failed';
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
        title: 'Disconnected',
        message: `${connection.name} has been disconnected`,
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Disconnect failed',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to disconnect profile',
      });
    }
  };

  return (
    <List
      searchBarPlaceholder='Search internet profiles...'
      isLoading={loading || isConnecting}
      navigationTitle='Internet'
    >
      <List.Section
        title='Internet connections'
        subtitle='Ethernet first, then Wi-Fi'
      >
        {internetConnections.map((connection) => {
          const activating = isConnectionActivating(connection);
          const connected = isConnected(connection) && !activating;

          return (
            <List.Item
              key={connection.uuid}
              title={connection.name}
              icon={getConnectionIcon(connection, activating)}
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
                      icon={Icon.Plug}
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
                      icon={Icon.Power}
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
