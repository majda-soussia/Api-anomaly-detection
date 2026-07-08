import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

let socket = null;
function getSocket(token) {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
      autoConnect: false, // we control connect() manually below, once we have a token
    });
  } else if (token) {
    socket.auth = { token }; // keep it fresh if the token changes (e.g. re-login)
  }
  return socket;
}

export function useMetricsSocket() {
  const { accessToken } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) return; // don't even try to connect before login

    const s = getSocket(accessToken);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onMetrics = (data) => setMetrics(data);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('metrics:update', onMetrics);

    if (!s.connected) {
      s.connect();
    } else {
      setConnected(true);
    }

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('metrics:update', onMetrics);
    };
  }, [accessToken]);

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