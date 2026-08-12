import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { generateObject } from "ai";
import { profileSchema, type CookEvent, type Household, type Profile } from "./types";
import type { Recipe } from "@/lib/types";
import { hasGatewayKey } from "@/lib/env";

/**
 * CALL 1 — inference. What kind of cook is this?
 *
 * In: the raw event log, ~200 rows, nothing pre-aggregated.
 * Out: a characterization plus the one sentence that goes on screen.
 *
 * Why this needs a model and not a query: counting is easy. A query can tell you
 * this person opened eleven recipes with a make-ahead step. What it cannot do is
 * decide that make-ahead affinity is the fact worth acting on, out of the several
 * hundred true statements available about the same log. Selecting which pattern is
 * salient is the judgment, and it is the thing the demo is showing off.
 *
 * Nightly in principle. Cached to disk here, because the profile changes slowly by
 * definition and the stage does not need it recomputed.
 */

const CACHE_DIR = path.join(process.cwd(), "lib/signals/cache");

/** Exported so scripts/cost.mjs can price the real prompt rather than a rebuilt one. */
export const profilePromptFor = (household: Household, events: CookEvent[], recipes: Recipe[]) => `
WHAT MISE IS
A recipe site whose actual product is teaching people to cook. It ships a guided
cook mode — the reader works through a numbered method one step at a time, on
screen, while cooking — and technique material attached to every dish, which they
can open or ignore. Reading a recipe here is not a page view; it is a walk-through
with a beginning, a middle and an end.

That is why this log exists and why it has the shape it has. The site knows which
step was on screen when someone stopped, because putting one step on screen IS the
product. It knows which technique notes were opened, because opening them is the
thing it is trying to get people to do. None of it is inferred, bought or tracked
across the web: it is a site watching people use the feature it is built around.

You are reading ninety days of one household's behaviour on that site.

WHAT THEY DECLARED AT SIGNUP — treat this as weak evidence. People describe
themselves aspirationally, and two households can declare identically and behave
nothing alike.
${JSON.stringify(household.declared)}

THE RECIPES THEY COULD HAVE COOKED, with the method the guided mode walks them
through. The step numbers below are the SAME numbers the log reports — when a row
says someone quit at step 3, step 3 is printed here and you can say what it was.
${recipes.map((r) => `${r.id} ${r.title} — technique: ${r.technique.join("/")}; ${r.ingredientCount} ingredients; allergens: ${r.allergens.join("/") || "none"}; ${r.makeAhead ? "has a make-ahead step" : "no make-ahead step"}${r.forkPoint ? "; forks partway" : ""}
${(r.steps ?? []).map((s, i) => `     ${i + 1}. ${s}`).join("\n")}`).join("\n")}

THE LOG — ${events.length} events, oldest first
${events.map((e) => `${e.at.slice(0, 10)} ${e.type.padEnd(9)} ${e.recipeId}${e.atStep !== undefined ? ` at step ${e.atStep}` : ""}${e.component ? ` ${e.component}` : ""}`).join("\n")}

Your job is NOT to summarise this log. Hundreds of true statements can be made
about it and almost all of them are worthless. Your job is to decide which single
pattern is worth acting on, and to say it in one sentence.

Three things worth watching for, because counting misses all of them:
- The most-opened dish and the most-cooked dish are often different dishes. What
  someone keeps looking at and never makes is a fact about them, but it is rarely
  the useful one.
- An avoidance may have a condition attached. Someone who abandons a dish
  containing an ingredient, but repeatedly cooks a different dish containing the
  same ingredient, is not avoiding the ingredient.
- Where in a recipe someone quits matters, and you can now read what they quit
  in the middle of. Quitting at step one is a reaction to the list or the shopping;
  quitting halfway is a reaction to the cooking itself. Name the step by what it
  ASKS OF THEM, using the text above.
- "saved" is the one action here that cost them something deliberate. A dish saved
  and never cooked is not a failure of the dish — it is the distance between who
  someone means to be and what they did on a Tuesday, and that distance is usually
  the most useful thing in the log.

DO NOT INVENT DETAIL. Every concrete claim you make — a step, a time, an
ingredient, a count — must be readable off the lists above. If you want to say
what someone quit in the middle of, quote the step. If the log does not support a
detail, leave the detail out; a plainer true sentence beats a vivid invented one,
and this text is shown to an audience beside the data it came from.

Write the salient inference as something they would recognise about themselves and
would not have thought to say. Never a count.

PLAIN ENGLISH, in both fields. Say it the way you would say it to somebody standing
next to you in a kitchen: short common words, one clause where one will do, no
metaphor, no wordplay, no rhythm, no sentence built so that it can be quoted. This
text is read aloud beside the data it came from, and writing that draws attention to
itself reads as a machine performing rather than a system being useful.

  Good:  "They read the technique notes before cooking, and quit when the
          ingredient list is long."
  Bad:   "They circle a dish for weeks, then cook something else entirely."
          — a line of prose. Say what they did.
`;

/** Routed through the Vercel AI Gateway: a plain "provider/model" string routes
 *  automatically, authenticated by AI_GATEWAY_API_KEY (or a Vercel OIDC token).
 *  Overridable by env so the slug can be corrected without a code change —
 *  run `node scripts/list-models.mjs` to see what the gateway actually offers. */
const PROFILE_MODEL = process.env.MISE_PROFILE_MODEL ?? "anthropic/claude-opus-5";

const hasKey = hasGatewayKey;

export const getProfile = async (
  household: Household,
  events: CookEvent[],
  recipes: Recipe[]
): Promise<{ profile: Profile; cached: boolean; ms: number }> => {
  const key = createHash("sha256")
    .update(JSON.stringify({ h: household.id, n: events.length, last: events.at(-1)?.at }))
    .digest("hex")
    .slice(0, 12);
  const file = path.join(CACHE_DIR, `${household.id}.${key}.json`);

  try {
    const hit = JSON.parse(await readFile(file, "utf8")) as Profile;
    return { profile: hit, cached: true, ms: 0 };
  } catch {
    /* fall through */
  }

  if (!hasKey()) return { profile: derivedFallback(events), cached: false, ms: 0 };

  const started = Date.now();
  const prompt = profilePromptFor(household, events, recipes);

  /* One retry, off temperature 0, and a check the schema cannot make.
     A generation came back structurally valid and semantically empty — no salient
     inference and no cooked recipes against a log with four completions. Because
     it parsed, it cached, and every page built from it silently lost its
     vocabulary. The schema can insist a string is non-empty; only this can insist
     the answer is about the log it was given. Retrying at temperature 0 would
     reproduce the same output, so the second attempt is nudged. */
  let object: Profile | null = null;
  for (const temperature of [0, 0.4]) {
    const attempt = await generateObject({ model: PROFILE_MODEL, schema: profileSchema, temperature, prompt });
    if (agreesWithLog(attempt.object, events)) {
      object = attempt.object;
      break;
    }
    console.warn(`profile for ${household.id} disagreed with its own log at temperature ${temperature}`);
  }
  if (!object) throw new Error(`profile for ${household.id} came back empty twice — refusing to cache it`);

  const ms = Date.now() - started;

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(object, null, 2));
  return { profile: object, cached: false, ms };
};

/** Cheap contradictions between a profile and the log it was derived from. Not a
 *  quality judgment — just "did it read the thing at all". */
const agreesWithLog = (p: Profile, events: CookEvent[]): boolean => {
  const cooked = new Set(events.filter((e) => e.type === "completed").map((e) => e.recipeId));
  const abandoned = new Set(events.filter((e) => e.type === "abandoned").map((e) => e.recipeId));
  if (cooked.size > 0 && p.signals.cookedRecipeIds.length === 0) return false;
  if (abandoned.size > 0 && p.signals.abandonedRecipeIds.length === 0) return false;
  /* Ids it reports as cooked that were never completed — invention, not omission. */
  return p.signals.cookedRecipeIds.every((id) => cooked.has(id));
};

/**
 * No API key: derive the signals mechanically so the pipeline still runs.
 *
 * This is deliberately NOT a substitute. It produces the counts and none of the
 * judgment — which is exactly the point the demo is making, so the fallback
 * announces itself rather than pretending.
 */
const derivedFallback = (events: CookEvent[]): Profile => {
  const count = (t: string) =>
    events.filter((e) => e.type === t).reduce<Record<string, number>>((a, e) => ({ ...a, [e.recipeId]: (a[e.recipeId] ?? 0) + 1 }), {});
  const completed = count("completed");
  const abandoned = count("abandoned");
  const cooked = Object.keys(completed);

  return {
    characterization: "Derived without a model. Counts only — no inference was made.",
    salientInference: "[no model available — this sentence is the part that needs one]",
    signals: {
      cookedRecipeIds: cooked,
      repeatRecipeIds: Object.entries(completed).filter(([, n]) => n > 1).map(([id]) => id),
      abandonedRecipeIds: Object.keys(abandoned),
      neverOpens: [],
      makeAheadPattern: cooked.length > 1,
      expandsTechnique: events.some((e) => e.type === "expanded"),
      abandonThreshold: null,
      rhythm: null
    }
  };
};
