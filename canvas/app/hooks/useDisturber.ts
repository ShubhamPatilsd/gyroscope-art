"use client";
import { useEffect, useRef } from "react";
import { MidiMessage } from "./useMidi";

export type Disturbance = { action: string; [key: string]: unknown };

export function useDisturber(
  message: MidiMessage | null,
  onDisturbance: (disturbances: Disturbance[]) => void
) {
  const bufferRef = useRef<MidiMessage[]>([]);
  const lastCheckRef = useRef<number>(Date.now());
  // stable ref so the effect doesn't re-run when the callback identity changes
  const onDisturbanceRef = useRef(onDisturbance);
  onDisturbanceRef.current = onDisturbance;

  useEffect(() => {
    if (!message) return;
    bufferRef.current.push(message);

    const now = Date.now();
    if (now - lastCheckRef.current < 5000) return;
    lastCheckRef.current = now;

    const batch = bufferRef.current.splice(0);
    if (batch.length === 0) return;

    fetch("/api/disturber", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: batch }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.action === "disturb" && data.disturbances?.length > 0) {
          onDisturbanceRef.current(data.disturbances);
        }
      })
      .catch(console.error);
  }, [message]);
}
