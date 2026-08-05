import { z } from "zod";

export type CookEvent = {
  /** `saved` is the only COMMITTAL signal in the vocabulary — the only one that
   *  costs the reader a deliberate act rather than a click they were making
   *  anyway. That is what makes saved-but-never-cooked worth reading: it is
   *  intention on the record, contradicted by behaviour. */
  type: "opened" | "skipped" | "abandoned" | "completed" | "returned" | "expanded" | "saved";
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
  characterization: z.string().min(40).describe("Three or four plain sentences. No jargon, no marketing register."),
  /* `.min(1)` and `.min(40)` are not pedantry. A generation came back with an empty
     salientInference and an empty cookedRecipeIds against a log containing four
     completions — it validated, cached, and the page rendered from it. On a
     recording day that is a silent wrong answer rather than a visible failure. */
  salientInference: z
    .string()
    .min(1)
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
