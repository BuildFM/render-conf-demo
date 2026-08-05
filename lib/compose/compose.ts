import { generateObject } from "ai";
import { z } from "zod";
import type { Manifest, ComponentSpec } from "@/lib/manifest/load";
import type { Recipe } from "@/lib/types";
import type { Household, Profile } from "@/lib/signals/types";
import type { FiredObligation } from "./gates";
import { composeModel, hasComposeModel } from "./model";
import * as cache from "./cache";
import { generateLocalObject } from "./ollama";

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
  /* Naming the dominant block is a separate decision from listing the blocks, and
     making it separate is what stops the model reaching for whatever is generically
     useful. It has to commit to what the page is about before it fills the page. */
  dominant: z
    .string()
    .describe(
      "The COMPONENT NAME of the lead block — e.g. \"PrepSchedule\". Exactly as spelled in " +
        "the LEAD list. Not a recipe title, not a description. It must equal blocks[0].component."
    ),
  blocks: z.array(
    z.object({
      component: z.string(),
      treatment: z.enum(["hero", "full", "collapsed", "oneline"]),
      recipeIds: z.array(z.string()).default([]),
      techniqueTag: z.string().optional(),
      axes: z
        .array(z.string())
        .default([])
        .describe(
          "ComparisonTable only. 2–4 COLUMN HEADINGS chosen for this household. Each names " +
            'what its column measures, in one to three words — "Active time", "Total time", ' +
            '"Where it splits", "Hands off". Sentence case. Never a sentence, never a phrase ' +
            'about the dishes, never a comment on the comparison itself.'
        ),
      emphasis: z.array(z.number()).default([]).describe("ComparisonTable only: which value per row carries the answer.")
    })
  ),
  rationale: z
    .string()
    .describe("One sentence, under 25 words, stating an inference about this household. Never a count.")
});

export type LayoutSpec = z.infer<typeof layoutSpecSchema>;

const describe = (c: ComponentSpec) =>
  `${c.name} [${c.role}] — ${c.intent} Treatments: ${c.treatments.join("/")}. Max ${c.adjacency.maxPerPage} per page.` +
  (c.slots.requires ? ` NEEDS ${c.slots.requires}` : "") +
  (c.adjacency.neverWith?.length ? ` Never with: ${c.adjacency.neverWith.join(", ")}.` : "") +
  (c.adjacency.mustFollow?.length ? ` Must follow: ${c.adjacency.mustFollow.join(" or ")}.` : "");

/**
 * Everything the model is told about one person, and nothing else.
 *
 * Extracted from the prompt template so `/api/context` can put it on screen —
 * the stage view shows these exact bytes, because a panel that paraphrased what
 * was sent would be a claim about the system rather than the system. Six lines is
 * also the honest headline: the model gets a characterization, three id lists, a
 * rhythm and the signup form. It never receives the facts that gated the
 * vocabulary — those are evaluated in code and decide what it is allowed to see.
 */
export const householdContext = (profile: Profile, household: Household) =>
  [
    profile.characterization,
    `Cooked: ${profile.signals.cookedRecipeIds.join(", ") || "nothing"}`,
    `Repeats: ${profile.signals.repeatRecipeIds.join(", ") || "none"}`,
    `Abandoned: ${profile.signals.abandonedRecipeIds.join(", ") || "none"}`,
    `Rhythm: ${profile.signals.rhythm ?? "none detected"}`,
    `Declared at signup (weak evidence): ${JSON.stringify(household.declared)}`
  ].join("\n");

const prompt = (
  manifest: Manifest,
  eligible: ComponentSpec[],
  recipes: Recipe[],
  profile: Profile,
  household: Household,
  fired: FiredObligation[]
) => `
Compose one home page for one household, out of a fixed vocabulary.

THE ONE THING THIS PAGE IS ABOUT
  "${profile.salientInference}"

That sentence is the brief. It was inferred from ninety days of this household's
behaviour and it is the reason this page is different from anybody else's. Your
first job is to pick the ONE block that most directly embodies it — if the sentence
is about dishes that branch, that is a fork card, not a shortlist; if it is about a
weekly rhythm, that is a schedule, not a browse. Give that block the most prominent
treatment it supports and put it first. Everything else on the page supports it.

You are choosing WHICH blocks appear, IN WHAT ORDER, AT WHAT DEPTH, and which
recipes go in them. You are not designing anything: type, colour, spacing and the
components themselves were decided in advance by a person.

THE VOCABULARY YOU MAY USE — already filtered to what this household qualifies for.
Anything not on this list does not exist for this page.

LEAD — can be what a page is about. blocks[0] is one of these.
${eligible.filter((c) => c.role === "lead").map(describe).join("\n") || "(none)"}

SUPPORT — useful beside a lead, never the reason for the page.
${eligible.filter((c) => c.role !== "lead").map(describe).join("\n")}

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
${recipes.map((r) => `${r.id} ${r.title} — techniques: ${r.technique.join(", ")}; serves ${r.yield}; ${r.activeTime} min active, ${r.totalTime} total; ${r.ingredientCount} ingredients; allergens ${r.allergens.join("/") || "none"}${r.makeAhead ? "; HAS A MAKE-AHEAD STEP" : ""}${r.forkPoint ? `; SPLITS PARTWAY (${r.forkPoint}) so one pot serves two constraints` : ""}`).join("\n")}

THIS HOUSEHOLD
${householdContext(profile, household)}

OUTPUT ORDER — do this in this order, it matters
1. Pick the LEAD. It is blocks[0] and it goes in "dominant", at the most prominent
   treatment it supports. If only one lead is listed, that is the answer — the
   filtering already decided, and it decided from ninety days of behaviour.
2. Add two or three SUPPORT blocks that are about the same thing as the lead.
3. If a support block does not relate to the lead, leave it out. Three blocks that
   agree beat four that do not.

RULES
- At most ${manifest.density.maxBlocks} blocks. Fewer is better. This is a composed
  page, not a directory — every block has to be about the same thing.
- ONE BLOCK DECIDES THE SHAPE OF THE PAGE. Choose it first: the thing this
  household opens the site for. Give it the most prominent treatment it supports,
  put it first, and let the remaining two or three support it. A page where four
  blocks are equally important is a page with nothing to say.
- Every block must relate to the others. Do not place a block about a dish that
  appears nowhere else on the page — an orphan line reads as debris.
- At most ${manifest.density.maxFullImages} blocks carrying a photograph. Only ${manifest.components
    .filter((c) => c.carriesPhoto)
    .map((c) => c.name)
    .join(", ")} do, and only at "hero" or "full".
- At most ${manifest.density.maxDisplayXL} block may take the page's giant headline.
  RecipeCard at "hero" and TechniqueThread at "full" both claim it, so they cannot
  appear on the same page. Choose which one this household opens the page for.
- Only use a treatment the component actually supports.
- ComparisonTable's "axes" are COLUMN HEADINGS, and they are the only words on the
  finished page you write. Every other label is authored. So they have to sound like
  the rest of the page: one to three words naming what the column measures, the way a
  recipe site heads a column. "Active time". "Total time". "Where it splits".
  "Hands off". Not "The split itself", not "How they differ", not anything that
  describes the comparison rather than heading a column — a heading a reader has to
  decode is a heading that failed.
- Order is meaning. What comes first is what this household opens the page for.
- Absence is a decision. A recipe site's home page with no recipe above the fold is
  a legitimate composition if this household's history argues for it.

RATIONALE — the single most important thing you write
Say the brief at the top of this prompt again, in your own words, addressed TO this
person as "you". Same idea, tighter. Do not introduce a different observation — the
page and the sentence have to be about the same thing or neither lands.
UNDER 12 WORDS. It is the page explaining itself in the time it takes to read one
line, so it has to be the truest thing you can say about them.

  Good:  "You don't avoid dairy. You avoid dairy you can't set aside."
  Good:  "Everything you keep has a step you can do on Sunday."
  Good:  "Six attempts at one idea, and never once a cold pan."

  Bad:   "Chicken under a brick is opened constantly but rarely cooked, while
          charred cabbage and beans are what they actually make."
          — third person, a readout about a user rather than a product speaking
            to a person, and twice as long as it needs to be.
  Bad:   "You have opened eleven recipes with a make-ahead step."
          — a count. A query reaches that.
`;

/** The cheap, per-view call. See the note in lib/signals/profile.ts. Which model,
 *  and whether it is local, is decided in lib/compose/model.ts. */
const hasKey = hasComposeModel;

export const compose = async (args: {
  manifest: Manifest;
  eligible: ComponentSpec[];
  recipes: Recipe[];
  profile: Profile;
  household: Household;
  fired: FiredObligation[];
  repairNotes?: string[];
}): Promise<{
  spec: LayoutSpec;
  ms: number;
  live: boolean;
  model: string;
  cached: boolean;
  /** Hand back to `remember()` once the layout has actually passed validation. */
  cacheKey: string | null;
  /** Reported by the gateway. Null on the local path and on a cache hit — the
   *  cost script needs measured tokens, not an estimate from character counts. */
  usage: { inputTokens: number; outputTokens: number } | null;
}> => {
  if (!hasKey()) {
    return {
      spec: stubSpec(args.eligible, args.recipes, args.profile),
      ms: 0,
      live: false,
      model: "stub",
      cached: false,
      cacheKey: null,
      usage: null
    };
  }

  const { model, providerOptions, label, local, localName } = composeModel();

  /* A repair is a different call with a different prompt, and caching it would
     serve the repaired layout to the next first attempt. Repairs always run live
     and are never stored. */
  const repairing = Boolean(args.repairNotes?.length);
  const k = repairing ? null : cache.key({ ...args, model: label });

  if (k && cache.enabled()) {
    const hit = cache.get(k);
    if (hit) return { spec: hit.spec, ms: 0, live: true, model: hit.model, cached: true, cacheKey: k, usage: null };
  }

  const text =
    prompt(args.manifest, args.eligible, args.recipes, args.profile, args.household, args.fired) +
    (args.repairNotes?.length
      ? `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED. Fix exactly these and return a whole new spec:\n${args.repairNotes.map((n) => `- ${n}`).join("\n")}`
      : "");

  const started = Date.now();

  /* Two paths, one prompt and one schema. The local one bypasses the AI SDK because
     Ollama's OpenAI-compatible endpoint cannot turn thinking off — see
     lib/compose/ollama.ts, where that cost an hour. */
  let usage: { inputTokens: number; outputTokens: number } | null = null;
  const object = local
    ? await generateLocalObject({ model: localName, prompt: text, schema: layoutSpecSchema })
    : await (async () => {
        const r = await generateObject({
          model: model!,
          schema: layoutSpecSchema,
          temperature: 0,
          // Arrangement, not judgment: the judgment already happened in call 1,
          // which runs nightly and keeps its reasoning budget. Measured on the
          // compose call: 16.5s -> 4.8s, output tokens 1525 -> 290, which is what
          // makes "fast and cheap" true when said on stage.
          providerOptions,
          prompt: text
        });
        usage = { inputTokens: r.usage?.inputTokens ?? 0, outputTokens: r.usage?.outputTokens ?? 0 };
        return r.object;
      })();

  /* Deliberately NOT stored here. A layout is only worth keeping once it has passed
     validation — caching the raw output would pin an invalid composition and make
     every subsequent load pay for the same repair. The caller stores it, after. */
  return { spec: object, ms: Date.now() - started, live: true, model: label, cached: false, cacheKey: k, usage };
};

/** Store a composition that validated. The repaired layout is what gets kept when a
 *  repair happened, so the next load of the same inputs is valid immediately. */
export const remember = (
  cacheKey: string | null,
  entry: { spec: LayoutSpec; ms: number; model: string }
): void => {
  if (cacheKey && cache.enabled()) cache.set(cacheKey, entry);
};

/** No API key: a deterministic, obviously-mechanical layout so the plumbing runs. */
const stubSpec = (eligible: ComponentSpec[], recipes: Recipe[], profile: Profile): LayoutSpec => ({
  dominant: eligible[0]?.name ?? "RecipeCard",
  blocks: eligible.slice(0, 4).map((c, i) => ({
    component: c.name,
    treatment: c.treatments.includes("full") ? ("full" as const) : c.treatments[0],
    recipeIds: (profile.signals.cookedRecipeIds.length ? profile.signals.cookedRecipeIds : recipes.map((r) => r.id)).slice(0, i === 0 ? 4 : 1),
    axes: [],
    emphasis: []
  })),
  rationale: "[stub composition — no model available]"
});
