import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { profileSchema, type CookEvent, type Household, type Profile } from "./types";
import type { Recipe } from "@/lib/types";

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

const prompt = (household: Household, events: CookEvent[], recipes: Recipe[]) => `
You are reading ninety days of one household's behaviour on a recipe site.

WHAT THEY DECLARED AT SIGNUP — treat this as weak evidence. People describe
themselves aspirationally, and two households can declare identically and behave
nothing alike.
${JSON.stringify(household.declared)}

THE RECIPES THEY COULD HAVE COOKED
${recipes.map((r) => `${r.id} ${r.title} — technique: ${r.technique.join("/")}; ${r.ingredientCount} ingredients; allergens: ${r.allergens.join("/") || "none"}; ${r.makeAhead ? "has a make-ahead step" : "no make-ahead step"}${r.forkPoint ? "; forks partway" : ""}`).join("\n")}

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
- Where in a recipe someone quits matters. Quitting at step zero is a reaction to
  the list; quitting at step four is a reaction to the cooking.

Write the salient inference as something they would recognise about themselves and
would not have thought to say. Never a count.
`;

const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

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
  const { object } = await generateObject({
    model: anthropic("claude-opus-5"),
    schema: profileSchema,
    temperature: 0,
    prompt: prompt(household, events, recipes)
  });
  const ms = Date.now() - started;

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(object, null, 2));
  return { profile: object, cached: false, ms };
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
