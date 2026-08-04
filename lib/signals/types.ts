import { z } from "zod";

export type CookEvent = {
  type: "opened" | "skipped" | "abandoned" | "completed" | "returned" | "expanded";
  recipeId: string;
  at: string;
  atStep?: number;
  component?: string;
};

export type Household = {
  id: string;
  label: string;
  declared: {
    size: number;
    weeknightMinutes: number;
    planningStyle: "plan" | "improvise" | "both";
    statedSkill: string;
    dietary: string[];
  };
  pantry: string[];
};

/** Output of call 1. Slow-moving — computed nightly, cached to disk. */
export const profileSchema = z.object({
  characterization: z.string().describe("Three or four plain sentences. No jargon, no marketing register."),
  salientInference: z
    .string()
    .describe(
      "The one sentence that goes on screen. It must state an inference, not a count. " +
        "'You skipped the intro eleven times' is a count and a rules engine reaches it. " +
        "'All six recipes you keep coming back to have a step you can do the day before' is a " +
        "judgment about which pattern, out of hundreds available in the same data, is the salient one. " +
        "Reference the history explicitly — 'across the last ninety days'. Under 25 words."
    ),
  signals: z.object({
    cookedRecipeIds: z.array(z.string()),
    repeatRecipeIds: z.array(z.string()).describe("Cooked more than once."),
    abandonedRecipeIds: z.array(z.string()),
    neverOpens: z.array(z.string()).describe("Component names this person has never engaged with."),
    makeAheadPattern: z.boolean(),
    expandsTechnique: z.boolean(),
    abandonThreshold: z.number().nullable().describe("Ingredient count at which they quit, if there is one."),
    rhythm: z.string().nullable().describe("e.g. 'Sunday production, weekday assembly'")
  })
});

export type Profile = z.infer<typeof profileSchema>;
