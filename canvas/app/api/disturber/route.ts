// TODO: re-enable Orba MIDI disturbance when instrument is connected
// import { generateText } from "ai";
// import { createAnthropic } from "@ai-sdk/anthropic";
// import { MidiMessage } from "@/app/hooks/useMidi";
// import { analyzeMidi } from "@/lib/midi-analyzer";
// import { disturberTools } from "@/lib/disturber-tools";

// Cursor movement threshold — total UV-space distance over the window.
// Moving slowly across the full screen ≈ 0.3–0.5. Below 0.05 is basically idle.
const IDLE_THRESHOLD = 0.05;

export async function POST(request: Request) {
  try {
    const { cursorMovement, windowSeconds } = (await request.json()) as {
      cursorMovement: number;
      windowSeconds: number;
    };

    const isIdle = cursorMovement < IDLE_THRESHOLD;

    if (!isIdle) {
      return Response.json({ action: "none", cursorMovement, windowSeconds });
    }

    return Response.json({
      action: "disturb",
      reason: `cursor barely moved (${cursorMovement.toFixed(4)} UV units in ${windowSeconds}s)`,
      disturbances: [{ action: "change_palette", paletteType: "grayscale" }],
    });
  } catch (error) {
    console.error("Disturber error:", error);
    return Response.json(
      { action: "error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
