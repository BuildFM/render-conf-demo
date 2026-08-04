import { generateObject } from "ai";
import { z } from "zod";
import type { Manifest, ComponentSpec } from "@/lib/manifest/load";
import type { Recipe } from "@/lib/types";
import type { Household, Profile } from "@/lib/signals/types";
import type { FiredObligation } from "./gates";
import { hasGatewayKey } from "@/lib/env";

/**
 * CALL 2 — composition. What should this page be?
 *
 * The model returns a layout spec. It never returns markup, and every value in the
 * spec is an id, an enum or a column heading — the one exception is `rationale`,
 * the only prose it is permitted to emit anywhere in the system.
 *
 * Consequence: it cannot say anything false about a dish, because it is not the one
 * saying anything about the dish. That is a stronger safety property than reviewing
 * generated copy, and it is structural rather than procedural.
 */

export const layoutSpecSchema = z.object({
  blocks: z.array(
    z.object({
      component: z.string(),
      treatment: z.enum(["full", "collapsed", "oneline"]),
      recipeIds: z.array(z.string()).default([]),
      techniqueTag: z.string().optional(),
      axes: z.array(z.string()).default([]).describe("ComparisonTable only. Chosen for this household."),
      emphasis: z.array(z.number()).default([]).describe("ComparisonTable only: which value per row carries the answer.")
    })
  ),
  rationale: z
    .string()
    .describe("One sentence, under 25 words, stating an inference about this household. Never a count.")
});

export type LayoutSpec = z.infer<typeof layoutSpecSchema>;

const describe = (c: ComponentSpec) =>
  `${c.name} — ${c.intent} Treatments: ${c.treatments.join("/")}. Max ${c.adjacency.maxPerPage} per page.` +
  (c.slots.requires ? ` NEEDS ${c.slots.requires}` : "") +
  (c.adjacency.neverWith?.length ? ` Never with: ${c.adjacency.neverWith.join(", ")}.` : "") +
  (c.adjacency.mustFollow?.length ? ` Must follow: ${c.adjacency.mustFollow.join(" or ")}.` : "");

const prompt = (
  manifest: Manifest,
  eligible: ComponentSpec[],
  recipes: Recipe[],
  profile: Profile,
  household: Household,
  fired: FiredObligation[]
) => `
Compose one home page for one household, out of a fixed vocabulary.

You are choosing WHICH blocks appear, IN WHAT ORDER, AT WHAT DEPTH, and which
recipes go in them. You are not designing anything: type, colour, spacing and the
components themselves were decided in advance by a person.

THE VOCABULARY YOU MAY USE — already filtered to what this household qualifies for.
Anything not on this list does not exist for this page.
${eligible.map(describe).join("\n")}

ALREADY PLACED BY THE APPLICATION — DO NOT INCLUDE THESE IN YOUR OUTPUT
These are obligations. They are rendered automatically for any recipe you place.
Listing one in your blocks array is an error and the whole spec is rejected.
${fired.length ? fired.map((f) => `${f.name} — fires automatically if you place "${f.props.recipeTitle}"`).join("\n") : "(none fired)"}

ASSEMBLIES — one unit, not two blocks. Include EVERY member, adjacent, in this
exact order, or include none of them. A partial assembly is rejected.
${manifest.assemblies.map((a) => `${a.name}: ${a.members.join(" then ")}`).join("\n")}

INVARIANTS
${manifest.invariants.map((i) => `- ${i}`).join("\n")}

THE CONTENT — "techniques" is a list of individual tags. When a block takes a
techniqueTag, pass exactly one of them, never a joined string.
${recipes.map((r) => `${r.id} ${r.title} — techniques: ${r.technique.join(", ")}; serves ${r.yield}; ${r.activeTime} min active, ${r.totalTime} total; ${r.ingredientCount} ingredients; allergens ${r.allergens.join("/") || "none"}${r.makeAhead ? "; make-ahead" : ""}${r.forkPoint ? "; forks" : ""}`).join("\n")}

THIS HOUSEHOLD
${profile.characterization}
What matters most: ${profile.salientInference}
Cooked: ${profile.signals.cookedRecipeIds.join(", ") || "nothing"}
Repeats: ${profile.signals.repeatRecipeIds.join(", ") || "none"}
Abandoned: ${profile.signals.abandonedRecipeIds.join(", ") || "none"}
Rhythm: ${profile.signals.rhythm ?? "none detected"}
Declared at signup (weak evidence): ${JSON.stringify(household.declared)}

RULES
- At most ${manifest.density.maxBlocks} blocks, and at most ${manifest.density.maxFullImages} at "full".
  Above that a page stops being composed and starts being a dump.
- Only use a treatment the component actually supports.
- Order is meaning. What comes first is what this household opens the page for.
- Absence is a decision. A recipe site's home page with no recipe above the fold is
  a legitimate composition if this household's history argues for it.

RATIONALE
One sentence shown on the page. It must state an inference about them, not a count,
and it must reference the history — "across the last ninety days", "the four dishes
you keep returning to". Under 25 words.
`;

/** The cheap, per-view call. See the note in lib/signals/profile.ts. */
const COMPOSE_MODEL = process.env.MISE_COMPOSE_MODEL ?? "anthropic/claude-sonnet-5";

const hasKey = hasGatewayKey;

export const compose = async (args: {
  manifest: Manifest;
  eligible: ComponentSpec[];
  recipes: Recipe[];
  profile: Profile;
  household: Household;
  fired: FiredObligation[];
  repairNotes?: string[];
}): Promise<{ spec: LayoutSpec; ms: number; live: boolean }> => {
  if (!hasKey()) return { spec: stubSpec(args.eligible, args.recipes, args.profile), ms: 0, live: false };

  const started = Date.now();
  const { object } = await generateObject({
    model: COMPOSE_MODEL,
    schema: layoutSpecSchema,
    temperature: 0,
    // Arrangement, not judgment: the judgment already happened in call 1, which
    // runs nightly and keeps its reasoning budget. Measured on the compose call:
    // 16.5s -> 4.8s, output tokens 1525 -> 290, which is what makes "fast and
    // cheap" true when said on stage.
    //
    // NOT free, though. With thinking off the model needs more repair passes —
    // it has emitted an obligation it may not place and split an assembly, both
    // caught by validation. Keep an eye on whether the repair rate is acceptable
    // before treating this as settled.
    providerOptions: { anthropic: { thinking: { type: "disabled" } } },
    prompt:
      prompt(args.manifest, args.eligible, args.recipes, args.profile, args.household, args.fired) +
      (args.repairNotes?.length
        ? `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED. Fix exactly these and return a whole new spec:\n${args.repairNotes.map((n) => `- ${n}`).join("\n")}`
        : "")
  });
  return { spec: object, ms: Date.now() - started, live: true };
};

/** No API key: a deterministic, obviously-mechanical layout so the plumbing runs. */
const stubSpec = (eligible: ComponentSpec[], recipes: Recipe[], profile: Profile): LayoutSpec => ({
  blocks: eligible.slice(0, 4).map((c, i) => ({
    component: c.name,
    treatment: c.treatments.includes("full") ? ("full" as const) : c.treatments[0],
    recipeIds: (profile.signals.cookedRecipeIds.length ? profile.signals.cookedRecipeIds : recipes.map((r) => r.id)).slice(0, i === 0 ? 4 : 1),
    axes: [],
    emphasis: []
  })),
  rationale: "[stub composition — no model available]"
});
