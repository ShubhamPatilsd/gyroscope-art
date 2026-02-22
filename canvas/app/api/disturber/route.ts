import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const anthropic = createAnthropic();

const DisturbanceSchema = z.object({
  action: z.enum(["none", "add_splats", "set_saturation"]),
  count: z.number().int().optional().describe("Required when action=add_splats. Integer 1–8."),
  value: z.number().optional().describe("Required when action=set_saturation. Float 0.0 (gray) to 1.0 (full color)."),
});

const ResponseSchema = z.object({
  analysis: z.string().describe("1-2 sentences on what the user just did"),
  narrativeUpdate: z
    .string()
    .describe(
      "Running session log, max 400 chars total. Append this moment; summarize older parts if needed."
    ),
  disturbances: z
    .array(DisturbanceSchema)
    .describe("0–2 actions. Empty or [{action:'none'}] = do nothing."),
});

const SYSTEM = `You are a generative art agent co-piloting a WebGL fluid simulation with a user.

The user paints colorful fluid by moving their cursor. Splats inject dye + velocity into a Navier-Stokes fluid sim.

Every 2 seconds you get a snapshot of what happened:
- splatCount: how many paint strokes in that window
- totalMovement: total cursor distance (UV units, 0–1 scale)
- idleSec: seconds since last cursor movement
- currentSaturation: 0=grayscale, 1=full color
- currentHue: current paint hue in degrees

Your two levers:
1. add_splats (count 1–8): inject random fluid bursts anywhere on canvas
2. set_saturation (0–1): shift the whole canvas toward gray or full color

Guidelines:
- If the user is actively painting, you can add complementary splats or do nothing.
- If idle > 5s, consider fading saturation toward gray (set_saturation 0–0.3) to invite them back.
- If idle > 10s and already gray, inject a few splats to stir things up.
- When user resumes painting, saturation auto-restores to 1.0 — you don't need to handle that.
- Be subtle. 1–3 splats is usually enough. Don't spam.
- Silence (empty disturbances) is valid and often best.
- Keep narrativeUpdate under 400 chars total.`;

export async function POST(request: Request) {
  try {
    const { splatCount, totalMovement, idleSec, currentSaturation, currentHue, narrative } =
      (await request.json()) as {
        splatCount: number;
        totalMovement: number;
        idleSec: number;
        currentSaturation: number;
        currentHue: number;
        narrative: string;
      };

    const prompt = `Session log: ${narrative || "(just started)"}

Last 2s — strokes: ${splatCount}, movement: ${totalMovement}, idle: ${idleSec}s, saturation: ${currentSaturation}, hue: ${currentHue}°

What do you observe and how do you respond?`;

    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: ResponseSchema,
      system: SYSTEM,
      prompt,
    });

    return Response.json({
      analysis:        object.analysis,
      narrativeUpdate: object.narrativeUpdate,
      disturbances:    object.disturbances.filter((d) => d.action !== "none" && d.action !== undefined),
    });
  } catch (error) {
    console.error("Agent error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
