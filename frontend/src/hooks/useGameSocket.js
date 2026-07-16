import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom Hook for handling WebSocket connections, auto-reconnections, and message frames.
 * Adheres to Separation of Concerns (SoC) by decoupling low-level networking from UI.
 * Ref-Callbacks: Prevents constant teardowns on parent re-renders.
 */
const useGameSocket = (pin, callbacks, hostKey = '') => {
  const ws = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef(null);

  // Keep latest callbacks in mutable ref to prevent rebuilding connect callback
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const connect = useCallback(() => {
    if (!pin) return;

    // Close any existing connection
    if (ws.current) {
      ws.current.close(1000, 'Reconnecting');
    }

    let wsUrl = `ws://127.0.0.1:8000/ws/game/${pin}/`;
    const params = [];
    if (hostKey) {
      params.push(`host_key=${encodeURIComponent(hostKey)}`);
    }
    if (params.length > 0) {
      wsUrl += `?${params.join('&')}`;
    }

    console.log(`Connecting to WebSocket: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket Connection Opened.');
      reconnectAttempts.current = 0;
      if (callbacksRef.current.onOpen) {
        callbacksRef.current.onOpen();
      }
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (callbacksRef.current.onMessage) {
          callbacksRef.current.onMessage(payload);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    socket.onclose = (event) => {
      console.warn(`WebSocket closed. Code: ${event.code}. Clean: ${event.wasClean}`);
      if (callbacksRef.current.onClose) {
        callbacksRef.current.onClose();
      }

      // Trigger auto-reconnect if not closed intentionally (e.g., connection lost)
      if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current += 1;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
        console.log(`Attempting reconnection ${reconnectAttempts.current}/${maxReconnectAttempts} in ${delay}ms...`);
        reconnectTimeout.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket Error encountered:', error);
    };

    ws.current = socket;
  }, [pin, hostKey]); // ONLY depend on the PIN or hostKey changing!

  // Connect on mount or when PIN changes
  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount: close socket and clear reconnect timers
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        // Use normal closure code 1000 to indicate intentional exit (stops reconnect loops)
        ws.current.close(1000, 'Intentional unmount');
      }
    };
  }, [connect]);

  // Send message helper
  const send = useCallback((data) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    } else {
      console.error('Failed to send WebSocket message: Socket is not open.');
    }
  }, []);

  return { send };
};

export default useGameSocket;
