import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { MidiMessage } from "@/app/hooks/useMidi";
import { analyzeMidi } from "@/lib/midi-analyzer";
import { disturberTools } from "@/lib/disturber-tools";

const anthropic = createAnthropic();
const model = anthropic("claude-3-5-sonnet-20241022");

export async function POST(request: Request) {
  try {
    const { messages } = (await request.json()) as { messages: MidiMessage[] };

    if (!messages || messages.length === 0) {
      return Response.json({
        action: "none",
        reason: "no MIDI data received",
      });
    }

    const metrics = analyzeMidi(messages);

    // If not static, don't disturb
    if (!metrics.isStatic) {
      return Response.json({
        action: "none",
        reason: "art is active and expressive, no disturbance needed",
        metrics,
      });
    }

    // Art is too static — ask the agent what to do
    const prompt = `
You are a mischievous art "disturber" that ruins art when it gets too static or boring.

The artist has been playing an instrument (Orba) and creating art on a canvas.
But the playing has become STATIC: ${metrics.staticReason}

Here are the detailed metrics from the last 5 seconds:
- Event count: ${metrics.eventCount}
- Note On events: ${metrics.noteOnCount}
- Average velocity: ${metrics.averageVelocity}/127
- Velocity range: ${metrics.velocityRange.min}-${metrics.velocityRange.max}
- Pitch range: ${metrics.pitchRange.min}-${metrics.pitchRange.max}
- Has control changes: ${metrics.hasControlChange}
- Has pitch wheel: ${metrics.hasPitchWheel}
- Events per second: ${metrics.eventDensity.toFixed(2)}

Your job: Call tools to "disturb" the art and force the artist to be more creative.
Be creative and unpredictable! Mix and match tools. The goal is to shake things up.
You should call 1-3 tools depending on how static the art is.

Only call the tools, don't explain — just execute the disturbance.
`;

    const result = await generateText({
      model,
      tools: disturberTools,
      prompt,
      maxSteps: 5,
    });

    // Extract tool use results
    const toolResults = result.toolResults || [];
    const disturbances = toolResults.map((tr) => tr.result);

    return Response.json({
      action: "disturb",
      reason: metrics.staticReason,
      disturbances,
      metrics,
    });
  } catch (error) {
    console.error("Disturber error:", error);
    return Response.json(
      {
        action: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
