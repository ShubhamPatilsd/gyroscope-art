"use client";
import { useEffect, useRef, useState } from "react";

export type OrbaState = {
  channel: string;            // "drums" | "bass" | "chord" | "treble"
  note: number;               // 0–1
  force: number;              // 0–1
  swell: number;              // 0–1
  rotational_velocity: number; // 0–1
  gyroscope: number;          // 0–1
  accelerometer: number;      // 0–1
  contact: boolean;
};

export function useMidi(url = "ws://localhost:8765") {
  const [state, setState] = useState<OrbaState | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let dead = false;

    function connect() {
      if (dead) return;
      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => setConnected(true);

      socket.onmessage = (e) => {
        try {
          setState(JSON.parse(e.data) as OrbaState);
        } catch {
          // ignore malformed messages
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (!dead) retryTimeout.current = setTimeout(connect, 1500);
      };
    }

    connect();

    return () => {
      dead = true;
      if (retryTimeout.current) clearTimeout(retryTimeout.current);
      ws.current?.close();
    };
  }, [url]);

  return { state, connected };
}
