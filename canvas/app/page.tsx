"use client";
import { useMidi, MidiMessage } from "./hooks/useMidi";
import { useState, useEffect, useRef } from "react";

function describe(msg: MidiMessage): string {
  switch (msg.type) {
    case "note_on":
      return `note_on  pitch=${msg.pitch}  velocity=${msg.velocity}`;
    case "note_off":
      return `note_off pitch=${msg.pitch}  velocity=${msg.velocity}`;
    case "pitchwheel":
      return `pitchwheel  pitch=${msg.pitch}`;
    case "aftertouch":
      return `aftertouch  value=${msg.value}`;
    case "control_change":
      return `control_change  control=${msg.control}  value=${msg.value}`;
  }
}

export default function Home() {
  const { message, connected } = useMidi();
  const [log, setLog] = useState<string[]>([]);
  const [midiBuffer, setMidiBuffer] = useState<MidiMessage[]>([]);
  const [disturbanceLog, setDisturbanceLog] = useState<string[]>([]);
  const bufferRef = useRef<MidiMessage[]>([]);
  const lastCheckRef = useRef<number>(Date.now());

  // Add message to buffer and log
  useEffect(() => {
    if (!message) return;

    const now = Date.now();
    bufferRef.current.push(message);
    setLog((prev) => [describe(message), ...prev].slice(0, 40));

    // Check every 5 seconds if we should disturb
    if (now - lastCheckRef.current >= 5000) {
      lastCheckRef.current = now;

      // Send buffer to disturber
      if (bufferRef.current.length > 0) {
        fetch("/api/disturber", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: bufferRef.current }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.action === "disturb") {
              const disturbances = (data.disturbances || [])
                .map((d: any) => d.description || d.action)
                .join(" / ");
              setDisturbanceLog((prev) =>
                [
                  `🔥 DISTURBANCE: ${data.reason}`,
                  `   → ${disturbances}`,
                  ...prev,
                ].slice(0, 20)
              );
            }
          })
          .catch((err) => {
            console.error("Disturber error:", err);
            setDisturbanceLog((prev) => [`⚠️  error: ${err.message}`, ...prev].slice(0, 20));
          });
      }

      bufferRef.current = [];
    }
  }, [message]);

  return (
    <div className="min-h-screen bg-black text-white font-mono p-8">
      <div className="grid grid-cols-2 gap-8">
        {/* Left: MIDI Stream */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span
              className={`inline-block w-3 h-3 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`}
            />
            <span className="text-sm text-zinc-400">
              {connected ? "midi stream (ws://localhost:8765)" : "waiting for midi_server.py…"}
            </span>
          </div>

          <div className="space-y-1">
            {log.length === 0 && (
              <p className="text-zinc-600">no messages yet — press something on the Orba</p>
            )}
            {log.map((line, i) => (
              <p key={i} className={`text-sm ${i === 0 ? "text-white" : "text-zinc-500"}`}>
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Right: Disturbance Log */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded-full bg-purple-400" />
            <span className="text-sm text-zinc-400">disturber agent (checks every 5s)</span>
          </div>

          <div className="space-y-1">
            {disturbanceLog.length === 0 && (
              <p className="text-zinc-600">waiting for static playing to trigger disturbances…</p>
            )}
            {disturbanceLog.map((line, i) => (
              <p
                key={i}
                className={`text-sm ${
                  line.startsWith("🔥") ? "text-red-400" : line.startsWith("⚠️") ? "text-yellow-400" : "text-zinc-500"
                }`}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
