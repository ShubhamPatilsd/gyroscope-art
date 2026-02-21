"use client";
import { useEffect, useRef, useState } from "react";

export type MidiMessage =
  | { type: "note_on"; pitch: number; velocity: number }
  | { type: "note_off"; pitch: number; velocity: number }
  | { type: "pitchwheel"; pitch: number }
  | { type: "aftertouch"; value: number }
  | { type: "control_change"; control: number; value: number };

export function useMidi(url = "ws://localhost:8765") {
  const [message, setMessage] = useState<MidiMessage | null>(null);
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
          setMessage(JSON.parse(e.data) as MidiMessage);
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

  return { message, connected };
}
