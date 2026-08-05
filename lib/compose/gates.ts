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
  now: { timeOfDay: "morning" | "afternoon" | "evening" },
  ingredients: Map<string, { name: string }[]> = new Map(),
  /* Structural rather than the CookEvent import: this only ever reads two fields,
     and a narrower shape keeps the compose gates independent of the signals layer. */
  events: { type: string; recipeId?: string }[] = []
): Facts => {
  const pantry = household.pantry.map((p) => p.toLowerCase());
  const pantryGaps = recipes.reduce((n, r) => {
    const missing = (ingredients.get(r.id) ?? []).filter(
      (i) => !pantry.some((h) => i.name.toLowerCase().includes(h) || h.includes(i.name.toLowerCase()))
    );
    return n + (missing.length > 0 && missing.length <= 2 ? 1 : 0);
  }, 0);
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
    "user.expandsTechnique": events.some((e) => e.type === "expanded"),
    /* Intention on the record, contradicted by behaviour. Every other signal here
       is one thing — this one is the gap between two, which is why a query reaches
       "your saved recipes" and cannot reach "your saved recipes are a wish list". */
    "user.savedNeverCooked": (() => {
      const cooked = new Set(events.filter((e) => e.type === "completed").map((e) => e.recipeId));
      const saved = new Set(events.filter((e) => e.type === "saved").map((e) => e.recipeId));
      return [...saved].filter((id) => !cooked.has(id)).length;
    })(),
    "user.repeats": profile.signals.repeatRecipeIds.length,
    // Discriminating facts. A precondition true for every household is decoration:
    // it hands the model the whole vocabulary and it chooses generically.
    "user.cooksForkingDishes": recipes.filter((r) => r.forkPoint && cookedIds.has(r.id)).length,
    "user.abandonsOnListLength": profile.signals.abandonThreshold !== null,
    "user.hasRhythm": profile.signals.repeatRecipeIds.length >= 2 && profile.signals.makeAheadPattern,

    // state — session and account, not history. Where cart and auth would live.
    "state.timeOfDay": now.timeOfDay,
    "state.pantryKnown": household.pantry.length > 0,
    "state.pantryGaps": pantryGaps,
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

/** Exported so the stage view can show WHY a component was eligible using the same
 *  predicate that decided it. A second copy of this for display would eventually
 *  disagree with this one, and the display would be the lie — see the note on
 *  `satisfiesMustFollow`, which is the same lesson learned the hard way. */
export const test = (p: Predicate, facts: Facts): boolean => {
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

/**
 * ASSEMBLIES, enforced rather than requested.
 *
 * The manifest says an assembly moves as one unit: the model chooses whether it
 * appears, never the order within. Asking it to honour that in the output turns out
 * to be the single most common validation failure — four of five models split
 * ImprovisePath on the same household.
 *
 * So stop asking. If the model placed any member, it chose the assembly; the app
 * completes it, in order, adjacent. Same shape as obligations: the decision that
 * belongs to the model stays with the model, and the part that was never its
 * decision is done in code.
 */
export const completeAssemblies = <T extends { component: string }>(
  blocks: T[],
  manifest: Manifest,
  make: (component: string, near: T) => T | null
): { blocks: T[]; completed: string[] } => {
  let out = [...blocks];
  const completed: string[] = [];

  /* Completing an assembly can violate an adjacency rule that the model's own
     output did not. PlanTheWeek pulls in ShoppingList; ImprovisePath pulls in
     PantryMatch; the manifest forbids those two together. Auto-completion has to
     check what it is about to create, or the fix becomes the bug. */
  const conflicts = (candidate: string, present: string[]) => {
    const spec = manifest.components.find((c) => c.name === candidate);
    const banned = new Set(spec?.adjacency.neverWith ?? []);
    if (present.some((p) => banned.has(p))) return true;
    return present.some((p) =>
      (manifest.components.find((c) => c.name === p)?.adjacency.neverWith ?? []).includes(candidate)
    );
  };

  for (const a of manifest.assemblies) {
    const present = a.members.filter((m) => out.some((b) => b.component === m));
    if (present.length === 0 || present.length === a.members.length) {
      // Absent entirely, or whole — but possibly out of order. Normalise below.
    }
    if (present.length === 0) continue;

    const anchorIdx = out.findIndex((b) => a.members.includes(b.component));
    const anchor = out[anchorIdx];

    const unit: T[] = [];
    for (const m of a.members) {
      const existing = out.find((b) => b.component === m);
      if (existing) {
        unit.push(existing);
        continue;
      }
      if (conflicts(m, out.map((b) => b.component))) {
        out = out.filter((b) => !a.members.includes(b.component));
        completed.push(`${a.name}: dropped, ${m} conflicts with a block already placed`);
        break;
      }
      const built = make(m, anchor);
      if (!built) {
        // Cannot construct the missing member — drop the whole assembly rather
        // than render half of a flow.
        out = out.filter((b) => !a.members.includes(b.component));
        completed.push(`${a.name}: dropped, could not complete`);
        break;
      }
      unit.push(built);
      completed.push(`${a.name}: added ${m}`);
    }
    if (unit.length !== a.members.length) continue;

    out = out.filter((b) => !a.members.includes(b.component));
    out.splice(Math.min(anchorIdx, out.length), 0, ...unit);
  }

  /* Completion adds blocks, and the manifest caps them. A four-block page that
     picks up a fifth from PlanTheWeek is invalid on a rule the model never broke —
     it named four. Trim from the end, skipping the lead and never breaking an
     assembly open, rather than spending a model call to re-choose. */
  const memberOf = new Map<string, string>();
  for (const a of manifest.assemblies) for (const m of a.members) memberOf.set(m, a.name);

  while (out.length > manifest.density.maxBlocks) {
    let cut = -1;
    for (let i = out.length - 1; i > 0; i--) {
      if (!memberOf.has(out[i].component)) { cut = i; break; }
    }
    if (cut < 0) break; // everything left is a lead or inside an assembly
    completed.push(`density: dropped ${out[cut].component}, ${manifest.density.maxBlocks} blocks max`);
    out.splice(cut, 1);
  }

  return { blocks: out, completed };
};

/**
 * Is the block at `i` sitting after something it is allowed to follow?
 *
 * Adjacency is declared against UNITS, not against members. An assembly moves as
 * one thing, so a block that must follow PrepSchedule is satisfied by following the
 * PlanTheWeek assembly that PrepSchedule leads — otherwise the manifest contradicts
 * itself, and it did: MakeAheadCallout must directly follow PrepSchedule, and
 * PrepSchedule is never allowed to be the block directly before anything, because
 * ShoppingList is glued to it. Nothing could satisfy the rule and the page fell back
 * roughly one run in three.
 *
 * Shared by the enforcer and the validator so they cannot disagree — when they did,
 * the enforcer moved a block the validator then rejected, forever.
 */
export const satisfiesMustFollow = (
  blocks: { component: string }[],
  i: number,
  manifest: Manifest
): boolean => {
  const must = manifest.components.find((c) => c.name === blocks[i].component)?.adjacency.mustFollow ?? [];
  if (!must.length) return true;
  if (i === 0) return false;

  const memberOf = new Map<string, string>();
  for (const a of manifest.assemblies) for (const m of a.members) memberOf.set(m, a.name);

  /* The preceding unit: the block at i-1, plus any contiguous run before it that
     belongs to the same assembly. */
  const unit = [blocks[i - 1].component];
  const assembly = memberOf.get(blocks[i - 1].component);
  if (assembly) {
    for (let j = i - 2; j >= 0 && memberOf.get(blocks[j].component) === assembly; j--) {
      unit.push(blocks[j].component);
    }
  }

  return unit.some((c) => must.includes(c));
};

/**
 * Put blocks that declare a `mustFollow` next to something they are allowed to
 * follow — or take them off the page.
 *
 * Same argument as assemblies, and found the same way. Twin B failed about one run
 * in three, always identically: the model picked MakeAheadCallout, which must
 * directly follow a recipe or a schedule, and then placed it after ShoppingList.
 * PrepSchedule was already on the page. The composition was not wrong about what
 * belonged there, only about where — and where was never the model's decision to
 * make, because the manifest already states it.
 *
 * A repair pass for this costs a second model call to fix an ordering the design
 * system can fix arithmetically, and it fails often enough to fall back to the
 * default page on camera. So: move it, and if there is nothing on the page it may
 * follow, drop it rather than render a block the manifest forbids.
 *
 * Runs AFTER completeAssemblies — completion changes positions, and an adjacency
 * checked before it can be false afterwards.
 */
export const enforceAdjacency = <T extends { component: string }>(
  blocks: T[],
  manifest: Manifest
): { blocks: T[]; moved: string[] } => {
  const out = [...blocks];
  const moved: string[] = [];
  const memberOf = new Map<string, string>();
  for (const a of manifest.assemblies) for (const m of a.members) memberOf.set(m, a.name);

  /* An insertion point must never land inside an assembly — that would split a unit
     the manifest says moves whole. Slide past any run of members of the same one. */
  const clear = (at: number): number => {
    let i = at;
    while (i > 0 && i < out.length) {
      const a = memberOf.get(out[i].component);
      if (a && memberOf.get(out[i - 1].component) === a) i++;
      else break;
    }
    return i;
  };

  for (let pass = 0; pass < out.length; pass++) {
    let changed = false;

    for (let i = 0; i < out.length; i++) {
      const spec = manifest.components.find((c) => c.name === out[i].component);
      const must = spec?.adjacency.mustFollow ?? [];
      if (!must.length) continue;
      if (satisfiesMustFollow(out, i, manifest)) continue;

      /* Moving an assembly member would split its assembly. Leave it; validation
         reports it and the fallback catches it. This has not come up. */
      if (memberOf.has(out[i].component)) continue;

      const anchor = out.findIndex((b) => must.includes(b.component));
      const [block] = out.splice(i, 1);

      if (anchor < 0) {
        moved.push(`${block.component}: dropped, nothing on the page it may follow`);
      } else {
        const at = clear(out.findIndex((b) => must.includes(b.component)) + 1);
        out.splice(at, 0, block);
        moved.push(`${block.component}: moved after ${out[at - 1].component}`);
      }
      changed = true;
      break;
    }

    if (!changed) break;
  }

  return { blocks: out, moved };
};
