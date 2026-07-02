import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';


const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function useMetricsSocket() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('metrics:update', (data) => {
      setMetrics(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return metrics;
}