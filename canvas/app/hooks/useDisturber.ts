"use client";
import { useEffect, useRef } from "react";
import { MidiMessage } from "./useMidi";

export interface Disturbance {
  action: string;
  [key: string]: unknown;
}

const PARAM_LABELS = [
  "x", "y", "speed", "hue", "hue_drift", "saturation",
  "brightness", "trail", "zoom", "rotation", "layers",
  "layer_spread", "glow", "line_width", "complexity", "scene", "warp",
];

interface ValChange {
  param: string;
  from: number;
  to: number;
}

export function useDisturber(
  message: MidiMessage | null,
  vals: number[],
  onDisturbances: (disturbances: Disturbance[]) => void
) {
  const eventsRef          = useRef<MidiMessage[]>([]);
  const prevValsRef        = useRef<number[]>([...vals]);
  const narrativeRef       = useRef<string>("");
  const valsRef            = useRef(vals);
  const onDisturbancesRef  = useRef(onDisturbances);
  const pendingRef         = useRef(false);

  useEffect(() => { valsRef.current = vals; }, [vals]);
  useEffect(() => { onDisturbancesRef.current = onDisturbances; }, [onDisturbances]);

  // buffer incoming MIDI events
  useEffect(() => {
    if (!message) return;
    eventsRef.current.push(message);
  }, [message]);

  // 2s tick — diff vals, send to agent, store narrative
  useEffect(() => {
    const tick = async () => {
      if (pendingRef.current) return;

      const events = eventsRef.current.splice(0); // drain buffer
      const cur    = valsRef.current;
      const prev   = prevValsRef.current;

      // compute which params changed meaningfully (skip x,y at index 0,1)
      const valsDiff: ValChange[] = [];
      for (let i = 2; i < cur.length; i++) {
        if (Math.abs(cur[i] - prev[i]) > 0.02) {
          valsDiff.push({
            param: PARAM_LABELS[i],
            from:  +prev[i].toFixed(3),
            to:    +cur[i].toFixed(3),
          });
        }
      }
      prevValsRef.current = [...cur];

      if (events.length === 0 && valsDiff.length === 0) return; // nothing to report

      pendingRef.current = true;
      try {
        const res = await fetch("/api/disturber", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events,
            valsDiff,
            narrative: narrativeRef.current,
          }),
        });
        const data = await res.json();
        if (data.narrativeUpdate) narrativeRef.current = data.narrativeUpdate;
        if (data.disturbances?.length) onDisturbancesRef.current(data.disturbances);
      } catch (err) {
        console.error("Disturber error:", err);
      } finally {
        pendingRef.current = false;
      }
    };

    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []); // runs once on mount
}
