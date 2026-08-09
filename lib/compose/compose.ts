import { generateObject } from "ai";
import { z } from "zod";
import type { Manifest, ComponentSpec } from "@/lib/manifest/load";
import type { Recipe } from "@/lib/types";
import type { Household, Occasion, Profile } from "@/lib/signals/types";
import { occasionBrief } from "@/lib/occasion";
import type { FiredObligation } from "./gates";
import { canLead } from "./gates";
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

/**
 * The column headings a ComparisonTable may use. An ENUM, not free text.
 *
 * These were `z.array(z.string())` — the one place in the whole spec where the
 * model wrote prose that reached a finished page, and it went wrong twice. It
 * produced "The split itself", which no reader could decode; then it produced
 * "Protein", which the resolver has no way to compute, so two thirds of Twin B's
 * table rendered as a column of em-dashes. Constraining the wording in the prompt
 * fixed the first and could never have fixed the second.
 *
 * A heading the app cannot fill is a dead column, and the fix is the same one the
 * whole demo argues for: give the model a vocabulary instead of a blank. Every
 * member here has a resolver in `lib/render/resolve.ts`, and that map is exhaustive
 * over this list — add a heading without a way to compute it and it fails to
 * typecheck rather than rendering a dash.
 */
export const AXES = [
  "Active time",
  "Total time",
  "Technique",
  "Make-ahead",
  "Dairy",
  "Serves",
  "Ingredients",
  "Where it splits"
] as const;

export const layoutSpecSchema = z.object({
  /* Naming the dominant block is a separate decision from listing the blocks, and
     making it separate is what stops the model reaching for whatever is generically
     useful. It has to commit to what the page is about before it fills the page. */
  /* OPTIONAL IN THE SCHEMA, REQUIRED IN THE PROMPT — and those are different jobs.
   *
   * Measured, not guessed: composing h-learner during the occasion, the model
   * returned a well-formed `blocks` array and NO `dominant` and NO `rationale` on
   * roughly two calls in three. Both scalars, dropped together, `finishReason:
   * "stop"` and 178 output tokens — not truncation, just a model that answered the
   * question the prompt spent forty lines asking and skipped the two it mentions
   * once each. Three retries at rising temperature all did the same, so the page
   * fell back to the hand-authored default about half the time it was loaded.
   *
   * A required field that the model reliably omits does not make the field arrive —
   * it converts a recoverable gap into a thrown request. So the schema stops
   * demanding what it cannot enforce, and `dominant` is filled in code below: it is
   * DERIVABLE, because the validator already requires it to equal blocks[0], and a
   * value the app can compute was never worth a 500. The prompt still asks for it,
   * because naming the lead before listing blocks is a commitment device that
   * earns its keep whenever more than one block may lead. */
  dominant: z
    .string()
    .optional()
    .describe(
      "REQUIRED IN YOUR ANSWER. The COMPONENT NAME of the lead block — e.g. \"PrepSchedule\". " +
        "Exactly as spelled in the LEAD list. Not a recipe title, not a description. " +
        "It must equal blocks[0].component."
    ),
  blocks: z.array(
    z.object({
      component: z.string(),
      treatment: z.enum(["hero", "full", "collapsed", "oneline"]),
      recipeIds: z.array(z.string()).default([]),
      techniqueTag: z.string().optional(),
      axes: z
        .array(z.enum(AXES))
        .default([])
        .describe("ComparisonTable only. 2–4 of these, chosen for this household."),
      emphasis: z.array(z.number()).default([]).describe("ComparisonTable only: which value per row carries the answer.")
    })
  ),
  /* Optional for the same reason as `dominant`, and unlike `dominant` it is NOT
   * derivable — it is the one sentence in the system the model actually writes. So
   * a missing one is a validation error rather than a silent blank: the repair pass
   * asks again, and only an answer that is still missing it falls back. The band at
   * the foot of the page is the page explaining itself; rendering it empty is worse
   * than rendering the default page. */
  rationale: z
    .string()
    .optional()
    .describe("REQUIRED IN YOUR ANSWER. One sentence, under 25 words, stating an inference about this household. Never a count.")
});

export type LayoutSpec = z.infer<typeof layoutSpecSchema>;

/**
 * THE ANSWER WAS RIGHT. THE ENVELOPE WAS WRONG.
 *
 * Measured on the occasion prompt, where roughly half of all loads fell back to the
 * default page: the model returns the whole, correct spec — four good blocks, the
 * dominant name, a rationale in the house voice — JSON-encoded as a STRING, inside
 * the `blocks` field that should have held the array:
 *
 *   {"blocks": "{\"blocks\":[…],\"dominant\":\"ShoppingList\",\"rationale\":\"…\"}"}
 *
 * So the parse fails, `dominant` and `rationale` read as undefined, and a
 * composition that was correct in every particular is thrown away. Re-asking is the
 * wrong response — nothing about the ANSWER was wrong, and a second call at a higher
 * temperature reproduces the same envelope often enough to burn the whole ladder.
 * The retry prompt already begs it not to do this ("not as JSON encoded inside a
 * string field"), which is where the previous attempt to fix this by wording ran out.
 *
 * Unwrapping costs nothing, needs no model call, and cannot invent anything: it only
 * ever un-nests fields the model already wrote.
 */
export const unwrapDoubleEncoded = (value: unknown): unknown => {
  if (!value || typeof value !== "object") return value;
  const v = value as Record<string, unknown>;
  if (typeof v.blocks !== "string") return value;
  try {
    const inner: unknown = JSON.parse(v.blocks);
    if (Array.isArray(inner)) return { ...v, blocks: inner };
    /* The whole object, encoded into one of its own fields. Inner wins: the outer
       copy is the envelope, and any dominant/rationale out there is a duplicate. */
    if (inner && typeof inner === "object" && Array.isArray((inner as { blocks?: unknown }).blocks)) {
      return { ...v, ...(inner as Record<string, unknown>) };
    }
  } catch {
    /* Not JSON. Leave it: the schema reports it and the retry ladder takes over. */
  }
  return value;
};

/** A block after the application has decided how wide it is. */
export type PlacedBlock = LayoutSpec["blocks"][number] & { span: "full" | "half" };
export type Axis = (typeof AXES)[number];

const describe = (c: ComponentSpec) =>
  `${c.name} — ${c.intent} Treatments: ${c.treatments.join("/")}. Widths: ${c.spans.join("/")}. Max ${c.adjacency.maxPerPage} per page.` +
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
  fired: FiredObligation[],
  occasion: { occasion: Occasion; daysUntil: number } | null,
  facts: Record<string, number | string | boolean>
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
${occasion ? `
THIS FORTNIGHT ONLY — a temporary job, and while it lasts it outranks the brief
${occasionBrief(occasion.occasion, occasion.daysUntil)}
The brief above still describes the person. The occasion describes THE JOB THIS
PAGE HAS TODAY, and the job changes as the date closes: deciding what to make,
buying it, getting ahead of it, then running the day. **The LEAD list below has
already been narrowed to today's job — take the lead it offers.** Do not lead with
a block about the occasion in general when the list offers the block about what
they are actually doing this week. After the date the occasion is gone and the page
goes back to the brief, so do not treat it as a change in who they are.
` : ""}
You are choosing WHICH blocks appear, IN WHAT ORDER, AT WHAT DEPTH, and which
recipes go in them. You are not designing anything: type, colour, spacing and the
components themselves were decided in advance by a person.

THE VOCABULARY YOU MAY USE — already filtered to what this household qualifies for.
Anything not on this list does not exist for this page.

LEAD — can be what a page is about RIGHT NOW. blocks[0] is one of these.
${eligible.filter((c) => canLead(c, facts)).map(describe).join("\n") || "(none)"}

SUPPORT — useful beside a lead, never the reason for the page today.
${eligible.filter((c) => !canLead(c, facts)).map(describe).join("\n")}

Widths are not your decision. Each block above lists the widths the design system
permits it, and the application pairs blocks into rows afterwards.

ALREADY PLACED BY THE APPLICATION — DO NOT INCLUDE THESE IN YOUR OUTPUT
These are obligations. They are rendered automatically for any recipe you place.
Listing one in your blocks array is an error and the whole spec is rejected.
${fired.length ? fired.map((f) => `${f.name} — fires automatically if you place "${f.props.recipeTitle}"`).join("\n") : "(none fired)"}

ASSEMBLIES — one unit, not two blocks. Include EVERY member, adjacent, in this
exact order, or include none of them. A partial assembly is rejected.
${manifest.assemblies.length ? manifest.assemblies.map((a) => `${a.name}: ${a.members.join(" then ")}`).join("\n") : "(none apply to this page)"}

INVARIANTS
${manifest.invariants.map((i) => `- ${i}`).join("\n")}

THE CONTENT — "techniques" is a list of individual tags. When a block takes a
techniqueTag, pass exactly one of them, never a joined string.
${recipes.map((r) => `${r.id} ${r.title} — techniques: ${r.technique.join(", ")}; serves ${r.yield}; ${r.activeTime} min active, ${r.totalTime} total; ${r.ingredientCount} ingredients; allergens ${r.allergens.join("/") || "none"}${r.makeAhead ? "; HAS A MAKE-AHEAD STEP" : ""}${r.forkPoint ? `; SPLITS PARTWAY (${r.forkPoint}) so one pot serves two constraints` : ""}`).join("\n")}

THIS HOUSEHOLD
${householdContext(profile, household)}

${(() => {
  const leads = eligible.filter((c) => canLead(c, facts));
  return leads.length === 1
    ? `THE LEAD IS ALREADY DECIDED
Exactly one block qualifies to lead this page today: ${leads[0].name}.
So "dominant" MUST be "${leads[0].name}" and blocks[0].component MUST be
"${leads[0].name}", at the most prominent treatment it supports. This is not a
preference — the filtering decided it from behaviour and from what day it is, and a
spec that opens with anything else is rejected.`
    : "";
})()}

THE OBJECT YOU RETURN HAS THREE KEYS. All three, every time:
  "dominant"  — the component name of the lead block. Same string as blocks[0].component.
  "blocks"    — the array.
  "rationale" — the one sentence described at the bottom of this prompt.
An answer containing only "blocks" is the most common way this goes wrong. The
array is the longest part of the answer, not the whole of it.

OUTPUT ORDER — do this in this order, it matters
1. Pick the LEAD. It is blocks[0] and it goes in "dominant", at the most prominent
   treatment it supports. If only one lead is listed, that is the answer — the
   filtering already decided, and it decided from ninety days of behaviour.
   A SUPPORT block cannot open the page while any lead is listed, at any treatment,
   including "hero". Putting RecipeCard first because a dish feels like a friendly
   opening is the specific mistake: it gives this household the page everybody who
   has no history gets.
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
- ComparisonTable's "axes" are COLUMN HEADINGS and you pick them from a fixed list:
  ${AXES.join(", ")}. Two to four, and choose the ones that separate THESE dishes for
  THIS household — a column where every row reads the same is a wasted column.
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
  facts: Record<string, number | string | boolean>;
  /** The fast layer. Null for most requests, and null again the day after. */
  occasion?: { occasion: Occasion; daysUntil: number } | null;
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
    prompt(args.manifest, args.eligible, args.recipes, args.profile, args.household, args.fired, args.occasion ?? null, args.facts) +
    (args.repairNotes?.length
      ? `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED. Fix exactly these and return a whole new spec:\n${args.repairNotes.map((n) => `- ${n}`).join("\n")}`
      : "");

  const started = Date.now();

  /* Two paths, one prompt and one schema. The local one bypasses the AI SDK because
     Ollama's OpenAI-compatible endpoint cannot turn thinking off — see
     lib/compose/ollama.ts, where that cost an hour. */
  let usage: { inputTokens: number; outputTokens: number } | null = null;
  /**
   * One retry on a SCHEMA failure, which is a different failure from an invalid
   * layout and was previously not handled at all.
   *
   * `generateObject` throws when the response does not match — it does not return
   * something the validator can reject — so the repair pass downstream never saw it
   * and the throw went straight through the page. Rare enough to miss until the
   * occasion prompt made it common.
   *
   * Two different failures wear the same error, and they want opposite responses:
   *   - a MALFORMED answer, which a retry at a nudged temperature can fix;
   *   - a correct answer in a broken envelope, which `salvage` unwraps for free.
   * Salvage runs first on every attempt. Asking again for something the model
   * already got right costs a call and usually reproduces the same envelope.
   */
  /** Recover a spec the model got right but wrapped wrongly. Returns null when the
   *  answer is genuinely malformed, and the temperature ladder takes it from there. */
  const salvage = (e: { value?: unknown; text?: string }): LayoutSpec | null => {
    const candidates: unknown[] = [e?.value];
    try {
      if (e?.text) candidates.push(JSON.parse(e.text));
    } catch {
      /* not JSON at all */
    }
    for (const c of candidates) {
      const parsed = layoutSpecSchema.safeParse(unwrapDoubleEncoded(c));
      if (parsed.success) {
        console.warn("[compose] recovered a double-encoded spec — the answer was valid, the envelope was not");
        return parsed.data;
      }
    }
    return null;
  };

  const askOnce = async (temperature: number): Promise<LayoutSpec> => {
    const r = await generateObject({
      model: model!,
      schema: layoutSpecSchema,
      temperature,
      // Arrangement, not judgment: the judgment already happened in call 1,
      // which runs nightly and keeps its reasoning budget. Measured on the
      // compose call: 16.5s -> 4.8s, output tokens 1525 -> 290, which is what
      // makes "fast and cheap" true when said on stage.
      providerOptions,
      prompt: temperature === 0 ? text : `${text}

Your previous answer was malformed. Return the result as a single structured object matching the schema exactly — not as text, and not as JSON encoded inside a string field. Name the dominant block, and give the one-sentence rationale.`
    });
    usage = { inputTokens: r.usage?.inputTokens ?? 0, outputTokens: r.usage?.outputTokens ?? 0 };
    return r.object;
  };

  /** One attempt, with the envelope repaired locally before the failure counts. */
  const attempt = (temperature: number): Promise<LayoutSpec> =>
    askOnce(temperature).catch((e) => {
      const recovered = salvage(e as { value?: unknown; text?: string });
      return recovered ? recovered : Promise.reject(e);
    });

  const schemaMiss = (e: { name?: string; message?: string }) => {
    const hit = e?.name === "AI_NoObjectGeneratedError" || /did not match schema|No object generated/.test(e?.message ?? "");
    if (process.env.MISE_DEBUG_RETRY) console.error(`[retry] name=${e?.name} hit=${hit} msg=${String(e?.message).slice(0,80)}`);
    return hit;
  };

  const raw = local
    ? await generateLocalObject({ model: localName, prompt: text, schema: layoutSpecSchema })
    : await attempt(0)
        .catch((e) => (schemaMiss(e) ? attempt(0.3) : Promise.reject(e)))
        .catch((e) => (schemaMiss(e) ? attempt(0.6) : Promise.reject(e)));

  /* The lead, named by the app when the model did not name it. Not a guess: the
     validator rejects any spec where `dominant` and blocks[0] disagree, so blocks[0]
     IS the answer and the only question was whether the model bothered to say it. */
  const object: LayoutSpec = { ...raw, dominant: raw.dominant ?? raw.blocks[0]?.component };

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
