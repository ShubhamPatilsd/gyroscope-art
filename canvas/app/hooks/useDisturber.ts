"use client";
import { useEffect, useRef } from "react";
import { MidiMessage } from "./useMidi";

export interface Disturbance {
  action: string;
  [key: string]: unknown;
}

export function useDisturber(
  message: MidiMessage | null,
  onDisturbances: (disturbances: Disturbance[]) => void
) {
  const bufferRef = useRef<MidiMessage[]>([]);
  const lastCheckRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!message) return;

    const now = Date.now();
    bufferRef.current.push(message);

    // Check every 5 seconds
    if (now - lastCheckRef.current >= 5000) {
      lastCheckRef.current = now;

      if (bufferRef.current.length > 0) {
        fetch("/api/disturber", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: bufferRef.current }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.action === "disturb" && data.disturbances) {
              onDisturbances(data.disturbances);
            }
          })
          .catch((err) => {
            console.error("Disturber error:", err);
          });
      }

      bufferRef.current = [];
    }
  }, [message, onDisturbances]);
}
