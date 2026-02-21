import { MidiMessage } from "@/app/hooks/useMidi";

export interface MidiMetrics {
  eventCount: number;
  noteOnCount: number;
  averageVelocity: number;
  velocityRange: { min: number; max: number };
  pitchRange: { min: number; max: number };
  hasControlChange: boolean;
  hasPitchWheel: boolean;
  eventDensity: number; // events per second
  isStatic: boolean;
  staticReason?: string;
}

export function analyzeMidi(messages: MidiMessage[], windowSeconds: number = 5): MidiMetrics {
  const noteOnMessages = messages.filter((m) => m.type === "note_on");
  const hasControlChange = messages.some((m) => m.type === "control_change");
  const hasPitchWheel = messages.some((m) => m.type === "pitchwheel");

  const velocities = noteOnMessages.map((m) => (m.type === "note_on" ? m.velocity : 0)).filter((v) => v > 0);
  const pitches = noteOnMessages.map((m) => (m.type === "note_on" ? m.pitch : 0));

  const eventDensity = messages.length / windowSeconds;
  const averageVelocity = velocities.length > 0 ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length) : 0;

  const velocityRange = {
    min: velocities.length > 0 ? Math.min(...velocities) : 0,
    max: velocities.length > 0 ? Math.max(...velocities) : 0,
  };

  const pitchRange = {
    min: pitches.length > 0 ? Math.min(...pitches) : 0,
    max: pitches.length > 0 ? Math.max(...pitches) : 0,
  };

  // Determine if static
  let isStatic = false;
  let staticReason: string | undefined;

  if (eventDensity < 1) {
    isStatic = true;
    staticReason = "very sparse playing (< 1 event/sec)";
  } else if (averageVelocity < 40 && noteOnCount > 0) {
    isStatic = true;
    staticReason = "very soft playing (avg velocity < 40)";
  } else if (!hasControlChange && !hasPitchWheel && pitchRange.max - pitchRange.min < 5) {
    isStatic = true;
    staticReason = "no movement (no knob/pitch change, limited pitch range)";
  }

  const noteOnCount = noteOnMessages.length;

  return {
    eventCount: messages.length,
    noteOnCount,
    averageVelocity,
    velocityRange,
    pitchRange,
    hasControlChange,
    hasPitchWheel,
    eventDensity,
    isStatic,
    staticReason,
  };
}
