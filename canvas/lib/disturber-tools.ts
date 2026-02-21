import { tool } from "ai";
import { z } from "zod";

export const disturberTools = {
  add_chaos: tool({
    description: "Add chaotic random strokes and colors to the canvas to disrupt the static art",
    parameters: z.object({
      intensity: z.number().min(1).max(10).describe("How chaotic (1-10)"),
      count: z.number().min(1).max(50).describe("Number of random strokes to add"),
    }),
    execute: async ({ intensity, count }) => {
      return {
        action: "add_chaos",
        intensity,
        count,
        description: `Added ${count} chaotic strokes with intensity ${intensity}`,
      };
    },
  }),

  invert_colors: tool({
    description: "Invert the color palette of the entire canvas",
    parameters: z.object({
      fadeTime: z.number().min(0).max(5).describe("Time to fade in the inversion (seconds)"),
    }),
    execute: async ({ fadeTime }) => {
      return {
        action: "invert_colors",
        fadeTime,
        description: `Inverted canvas colors over ${fadeTime}s`,
      };
    },
  }),

  distort_canvas: tool({
    description: "Apply a distortion effect to the canvas (wave, swirl, etc)",
    parameters: z.object({
      distortionType: z
        .enum(["wave", "swirl", "shake", "pixelate"])
        .describe("Type of distortion to apply"),
      strength: z.number().min(0.1).max(10).describe("How strong the distortion is"),
    }),
    execute: async ({ distortionType, strength }) => {
      return {
        action: "distort_canvas",
        distortionType,
        strength,
        description: `Applied ${distortionType} distortion with strength ${strength}`,
      };
    },
  }),

  clear_partial: tool({
    description: "Partially erase the canvas to force the artist to restart",
    parameters: z.object({
      erasurePercent: z.number().min(10).max(100).describe("What % of canvas to erase"),
      pattern: z.enum(["random", "center", "edges"]).describe("Which parts to erase"),
    }),
    execute: async ({ erasurePercent, pattern }) => {
      return {
        action: "clear_partial",
        erasurePercent,
        pattern,
        description: `Erased ${erasurePercent}% of canvas (${pattern} pattern)`,
      };
    },
  }),

  change_palette: tool({
    description: "Randomly change the color palette to something unexpected",
    parameters: z.object({
      paletteType: z
        .enum(["neon", "grayscale", "monochrome", "pastel", "random"])
        .describe("The palette to switch to"),
    }),
    execute: async ({ paletteType }) => {
      return {
        action: "change_palette",
        paletteType,
        description: `Changed palette to ${paletteType}`,
      };
    },
  }),

  increase_saturation: tool({
    description: "Boost the saturation and brightness to make it garishly vibrant",
    parameters: z.object({
      amount: z.number().min(0.5).max(3).describe("Saturation multiplier (>1 = more saturated)"),
    }),
    execute: async ({ amount }) => {
      return {
        action: "increase_saturation",
        amount,
        description: `Boosted saturation by ${amount}x`,
      };
    },
  }),

  glitch: tool({
    description: "Apply a digital glitch/corruption effect to the canvas",
    parameters: z.object({
      glitchSize: z.number().min(1).max(50).describe("Size of glitch blocks (pixels)"),
      glitchAmount: z.number().min(0.1).max(1).describe("How much of canvas to glitch"),
    }),
    execute: async ({ glitchSize, glitchAmount }) => {
      return {
        action: "glitch",
        glitchSize,
        glitchAmount,
        description: `Applied glitch effect (size=${glitchSize}, coverage=${(glitchAmount * 100).toFixed(0)}%)`,
      };
    },
  }),
};
