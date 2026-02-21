"use client";
import { useMidi, MidiMessage } from "./hooks/useMidi";
import { useState, useEffect } from "react";

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

  useEffect(() => {
    if (!message) return;
    setLog((prev) => [describe(message), ...prev].slice(0, 40));
  }, [message]);

  return (
    <div className="min-h-screen bg-black text-white font-mono p-8">
      <div className="mb-4 flex items-center gap-3">
        <span
          className={`inline-block w-3 h-3 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`}
        />
        <span className="text-sm text-zinc-400">
          {connected ? "connected to ws://localhost:8765" : "waiting for midi_server.py…"}
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
  );
}
