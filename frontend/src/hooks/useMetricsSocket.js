// frontend/src/hooks/useMetricsSocket.js
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function useMetricsSocket() {
  const { accessToken } = useAuth();
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!accessToken) return; // pas de connexion WebSocket si pas authentifié

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken }, // envoyé une seule fois à la connexion
    });

    socket.on('metrics:update', (data) => {
      setMetrics(data);
    });

    socket.on('connect_error', (err) => {
      console.error('[useMetricsSocket] Connexion refusée :', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken]);

  return metrics;
}