import type { ComponentSpec, Manifest, Predicate } from "@/lib/manifest/load";
import type { Recipe } from "@/lib/types";
import type { Household, Profile } from "@/lib/signals/types";

/**
 * Everything the model is NOT allowed to decide.
 *
 * Facts are computed from content, profile and state. Obligations fire on them and
 * are placed before the model is consulted; permissions gate what the model is even
 * shown. By the time a prompt is built, most of the decisions are already made.
 */

export type Facts = Record<string, number | string | boolean>;

export const computeFacts = (
  recipes: Recipe[],
  profile: Profile,
  household: Household,
  now: { timeOfDay: "morning" | "afternoon" | "evening" }
): Facts => {
  const byTechnique = new Map<string, Recipe[]>();
  for (const r of recipes) {
    for (const t of r.technique) byTechnique.set(t, [...(byTechnique.get(t) ?? []), r]);
  }
  const maxSharing = Math.max(0, ...[...byTechnique.values()].map((v) => v.length));

  const cookedIds = new Set(profile.signals.cookedRecipeIds);
  const cookedTechniqueCounts = [...byTechnique.entries()].map(
    ([, rs]) => rs.filter((r) => cookedIds.has(r.id)).length
  );

  const allergies = new Set(household.declared.dietary.flatMap((d) => DIETARY_TO_ALLERGEN[d] ?? []));
  const allergenMatches = recipes.filter((r) => r.allergens.some((a) => allergies.has(a))).length;

  return {
    // content — questions about the corpus, not about the person
    "content.comparable": recipes.length,
    "content.forkPoints": recipes.filter((r) => r.forkPoint).length,
    "content.sharedTechnique": maxSharing,
    "content.makeAhead": recipes.filter((r) => r.makeAhead).length,
    "content.makeAheadShared": recipes.filter((r) => r.makeAhead).length,
    "content.plannedRecipes": profile.signals.repeatRecipeIds.length,
    "content.yieldExceedsHousehold": recipes.some((r) => r.yield > household.declared.size),

    // user — derived from ninety days of behaviour, never from what they declared
    "user.techniqueRepeats": Math.max(0, ...cookedTechniqueCounts),
    "user.techniqueAttempts": Math.max(0, ...cookedTechniqueCounts),
    "user.cookedOfComparable": cookedIds.size,
    "user.abandonedOrRepeated": profile.signals.abandonedRecipeIds.length + profile.signals.repeatRecipeIds.length,
    "user.makeAheadPattern": profile.signals.makeAheadPattern,
    "user.expandsTechnique": profile.signals.expandsTechnique,
    "user.repeats": profile.signals.repeatRecipeIds.length,

    // state — session and account, not history. Where cart and auth would live.
    "state.timeOfDay": now.timeOfDay,
    "state.pantryKnown": household.pantry.length > 0,
    "state.pantryGaps": 0, // needs per-recipe ingredient lists — see docs/CONTENT-GAP.md
    "state.dietarySplit": household.declared.dietary.length > 0 && household.declared.size > 1,
    "state.allergenMatches": allergenMatches
  };
};

const DIETARY_TO_ALLERGEN: Record<string, string[]> = {
  "dairy-free": ["dairy"],
  "gluten-free": ["gluten"],
  pescatarian: [],
  vegetarian: []
};

const test = (p: Predicate, facts: Facts): boolean => {
  const actual = facts[p.fact];
  if (actual === undefined) return false;
  switch (p.op) {
    case "==": return actual === p.value;
    case ">=": return Number(actual) >= Number(p.value);
    case ">": return Number(actual) > Number(p.value);
    case "<=": return Number(actual) <= Number(p.value);
    case "<": return Number(actual) < Number(p.value);
  }
};

/**
 * PERMISSIONS. The model is only ever shown components it is actually allowed to
 * use — typically half the vocabulary drops out. A technique explainer is not
 * eligible for someone who has never attempted the technique.
 */
export const eligible = (manifest: Manifest, facts: Facts): ComponentSpec[] =>
  manifest.components.filter((c) => c.requires.every((p) => test(p, facts)));

export type FiredObligation = {
  name: string;
  treatment: "full";
  placement: string;
  props: Record<string, unknown>;
};

/**
 * OBLIGATIONS, in two halves.
 *
 * The condition is evaluated in code — the model is never asked whether one
 * applies. But an allergen notice attaches to a *dish on the page*, and which
 * dishes are on the page is not known until after composition. So:
 *
 *   1. `obligationCandidates` runs first and goes into the prompt as a statement of
 *      fact: place any of these and a notice will accompany it.
 *   2. `placeObligations` runs after, and instantiates a notice for every candidate
 *      the composition actually included.
 *
 * The model still has no vote at either end. It cannot suppress a notice, and it
 * cannot place one — step 2 is unconditional.
 */
export const obligationCandidates = (
  manifest: Manifest,
  facts: Facts,
  recipes: Recipe[],
  household: Household
): FiredObligation[] => {
  const allergies = new Set(household.declared.dietary.flatMap((d) => DIETARY_TO_ALLERGEN[d] ?? []));
  const out: FiredObligation[] = [];

  for (const o of manifest.obligations) {
    if (!test(o.requiredWhen, facts)) continue;
    if (o.name !== "AllergenNotice") continue;
    for (const r of recipes) {
      const hit = r.allergens.find((a) => allergies.has(a));
      if (!hit) continue;
      out.push({
        name: o.name,
        treatment: "full",
        placement: o.locked.placement,
        props: { allergen: hit, recipeTitle: r.title, recipeId: r.id }
      });
    }
  }
  return out;
};

/** Which candidates the finished composition actually triggered. */
export const placeObligations = (
  candidates: FiredObligation[],
  recipeIdsOnPage: Set<string>
): FiredObligation[] => candidates.filter((c) => recipeIdsOnPage.has(c.props.recipeId as string));
