import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

let socket = null;
function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function useMetricsSocket() {
  const [metrics, setMetrics] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onMetrics = (data) => setMetrics(data);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('metrics:update', onMetrics);
    if (s.connected) setConnected(true);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('metrics:update', onMetrics);
    };
  }, []);

  return { metrics, connected };
}

/** Subscribes to real-time new-alert events. Calls `onNewAlert` for each. */
export function useAlertEvents(onNewAlert) {
  useEffect(() => {
    const s = getSocket();
    s.on('alert:new', onNewAlert);
    return () => s.off('alert:new', onNewAlert);
  }, [onNewAlert]);
}
