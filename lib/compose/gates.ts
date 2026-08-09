import type { ComponentSpec, Manifest, Predicate } from "@/lib/manifest/load";
import type { Recipe } from "@/lib/types";
import type { Household, Occasion, Profile } from "@/lib/signals/types";

/**
 * Everything whose dietary constraints have to be honoured on this page.
 *
 * The household's declared diet, plus anything an active occasion carries. This is
 * the whole mechanism behind the beat's best moment: the learner records no allergy
 * at all, and the notice still fires — for a guest, above the one dish with butter
 * in it, and nowhere else.
 *
 * Nothing new had to be said in the manifest for that to work. The obligation
 * already read "an allergen present in a dish on this page"; it was never about the
 * household, and this is simply a second source for the same fact.
 */
export type AllergenSource = "household" | "guest";

/* A MAP, NOT A SET — the source is half the fact.
 *
 * Merging both sources into a set and forgetting which one matched produced a
 * notice on the learner's page reading "Allergy warning · dairy" for a household
 * that declares no allergy at all. True, and unreadable as true: nothing said the
 * constraint belonged to somebody coming to dinner. The household's own diet needs
 * no explanation; a guest's does, and the page has to be able to give it. */
const allergensInForce = (household: Household, occasion: Occasion | null): Map<string, AllergenSource> => {
  const out = new Map<string, AllergenSource>();
  for (const a of occasion?.avoid ?? []) out.set(a, "guest");
  /* Declared last and wins: if the cook cannot eat it either, it is theirs, and
     "for a guest" would be the smaller half of the truth. */
  for (const d of household.declared.dietary) {
    for (const a of DIETARY_TO_ALLERGEN[d] ?? []) out.set(a, "household");
  }
  return out;
};

/**
 * Everything the model is NOT allowed to decide.
 *
 * Facts are computed from content, profile and state. Obligations fire on them and
 * are placed before the model is consulted; permissions gate what the model is even
 * shown. By the time a prompt is built, most of the decisions are already made.
 */

export type Facts = Record<string, number | string | boolean>;

export type OccasionPhase = "none" | "choosing" | "shopping" | "prep" | "cooking";

/**
 * WHAT JOB IS THE PAGE DOING TODAY, by subtraction.
 *
 * Exported so anything that needs to name a moment — the facts below, the index of
 * demo routes — asks the same function. A second copy of these thresholds would
 * eventually disagree with this one and the copy would be the lie.
 */
export const occasionPhase = (daysUntil: number | null): OccasionPhase =>
  daysUntil === null
    ? "none"
    : daysUntil >= 10
      ? "choosing"
      : daysUntil >= 4
        ? "shopping"
        : daysUntil >= 1
          ? "prep"
          : "cooking";

export const computeFacts = (
  recipes: Recipe[],
  profile: Profile,
  household: Household,
  now: { timeOfDay: "morning" | "afternoon" | "evening" },
  ingredients: Map<string, { name: string }[]> = new Map(),
  /* Structural rather than the CookEvent import: this only ever reads two fields,
     and a narrower shape keeps the compose gates independent of the signals layer. */
  events: { type: string; recipeId?: string }[] = [],
  /** The fast layer. Null for most requests, and null again the day after. */
  occasion: { occasion: Occasion; daysUntil: number } | null = null
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

  const allergies = allergensInForce(household, occasion?.occasion ?? null);
  const allergenMatches = recipes.filter((r) => r.allergens.some((a) => allergies.has(a))).length;


  /* Feeding more people than live here is the fact that makes half the occasion
     vocabulary eligible, and it is a comparison rather than a flag — an occasion for
     four in a household of six changes nothing about how a page should be built. */
  const scaleUp = occasion ? occasion.occasion.guests > household.declared.size : false;

  /**
   * WHAT JOB IS THIS PAGE DOING TODAY.
   *
   * The single most important fact in this map. An occasion is not one state, it is
   * four jobs in sequence, and they want different pages — not the same page with
   * fewer rows. Deciding what to cook, buying it, getting ahead of it, and running
   * the day are different tasks and the page should be ABOUT the current one.
   *
   * Derived by subtraction, in code. The model is never asked what phase it is.
   */
  const phase = occasionPhase(occasion?.daysUntil ?? null);

  return {
    // content — questions about the corpus, not about the person
    "content.comparable": recipes.length,
    "content.forkPoints": recipes.filter((r) => r.forkPoint).length,
    "content.sharedTechnique": maxSharing,
    "content.makeAhead": recipes.filter((r) => r.makeAhead).length,
    "content.makeAheadShared": recipes.filter((r) => r.makeAhead).length,
    /* During an occasion the planned dishes ARE the menu — four dishes somebody has
       committed to for a date. Outside one, the closest thing to a plan is what they
       keep coming back to. Same question, two sources. */
    "content.plannedRecipes": occasion?.occasion.menu?.length
      ? occasion.occasion.menu.length
      : profile.signals.repeatRecipeIds.length,
    "content.yieldExceedsHousehold": recipes.some((r) => r.yield > household.declared.size),

    // user — derived from ninety days of behaviour, never from what they declared
    "user.techniqueRepeats": Math.max(0, ...cookedTechniqueCounts),
    "user.techniqueAttempts": Math.max(0, ...cookedTechniqueCounts),
    "user.cookedOfComparable": cookedIds.size,
    "user.abandonedOrRepeated": profile.signals.abandonedRecipeIds.length + profile.signals.repeatRecipeIds.length,
    "user.makeAheadPattern": profile.signals.makeAheadPattern,
    /* PRESSURE, not habit — and the distinction is the reason the occasion changes
       anything.

       A shopping list is for someone who plans. The learner does not plan, so it has
       never been eligible for them and that is correct. But eight people are coming,
       and cooking for eight is planning whether or not you are a planner. The fact
       these blocks actually want is "is this household under planning pressure right
       now", which is true for two different reasons: they always are, or this
       fortnight they are.

       Written as one fact rather than as an OR in the manifest on purpose. The
       manifest goes on a screen in front of six hundred people and a predicate
       language with boolean operators in it stops being readable at a glance — the
       disjunction belongs in the code that computes the fact, not in the artifact
       that states the rule. */
    "state.planningPressure":
      (profile.signals.repeatRecipeIds.length >= 2 && profile.signals.makeAheadPattern) || scaleUp,
    "state.makeAheadPressure":
      profile.signals.makeAheadPattern || phase === "shopping" || phase === "prep",
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
    "state.allergenMatches": allergenMatches,

    /* occasion — the fast layer. Absent for most requests, and absent again the day
       after. These are the only facts in this map with an expiry date.

       `daysUntil` is what makes three moments out of one occasion: preconditions
       key on it, so the vocabulary offered at fourteen days out is not the
       vocabulary offered on the morning. Nobody wrote three pages. */
    "state.occasionPhase": phase,
    "state.hasOccasion": occasion !== null,
    /* Sequencing work across days is what Twin B does every week by temperament, and
       what anybody does in the last three days before eight people arrive. One fact,
       two reasons — and it is what keeps PrepSchedule off the shopping page, where it
       would compete with the list for the same job. */
    "state.sequencingPressure": profile.signals.abandonThreshold !== null || phase === "prep",
    "state.occasionGuests": occasion?.occasion.guests ?? 0,
    "state.occasionScaleUp": scaleUp,
    /* 999 rather than 0 when absent, so a `<=` precondition does not quietly become
       true for every household that has no occasion at all. A missing fact and a
       fact worth zero are different things and this is the one place it bites. */
    "state.daysUntil": occasion?.daysUntil ?? 999
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

/**
 * May this block be what the page is ABOUT — right now?
 *
 * `role` alone could not express this. A shopping list is what the page is about on
 * the Tuesday before eight people come, and a supporting detail every other day of
 * its life. Stating that as two components would be two templates; stating it as a
 * permanent promotion would let it open a page for somebody who is not shopping.
 *
 * So leading is a permission like any other, and permissions can be conditional.
 * `leadWhen` is the condition. This is the statement that makes four differently
 * shaped pages out of one vocabulary.
 */
/**
 * The assemblies that are actually in force for this page.
 *
 * An assembly says two blocks move as one unit. That is only a coherent rule while
 * BOTH of them are available — and with conditional leads they are not always. On
 * the shopping day the list is what the page is about and the schedule is not
 * eligible at all, so PlanTheWeek is not a unit that exists today, and gluing the
 * list to an absent partner deleted the lead off its own page.
 *
 * Filtering here rather than special-casing it downstream keeps the two places that
 * care — the completer and the validator — asking the same question.
 */
export const activeAssemblies = (manifest: Manifest, allowed: ComponentSpec[]): Manifest["assemblies"] => {
  const names = new Set(allowed.map((c) => c.name));
  return manifest.assemblies.filter((a) => a.members.every((m) => names.has(m)));
};

export const canLead = (c: ComponentSpec, facts: Facts): boolean =>
  c.role === "lead" || ((c.leadWhen?.length ?? 0) > 0 && c.leadWhen!.every((p) => test(p, facts)));

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
  household: Household,
  occasion: Occasion | null = null
): FiredObligation[] => {
  const allergies = allergensInForce(household, occasion);
  const out: FiredObligation[] = [];

  for (const o of manifest.obligations) {
    if (!test(o.requiredWhen, facts)) continue;
    if (o.name !== "AllergenNotice") continue;
    for (const r of recipes) {
      const hit = r.allergens.find((a) => allergies.has(a));
      if (!hit) continue;
      const source = allergies.get(hit)!;
      out.push({
        name: o.name,
        treatment: "full",
        placement: o.locked.placement,
        props: {
          allergen: hit,
          recipeTitle: r.title,
          recipeId: r.id,
          source,
          /* Whose constraint this is, in words, and only when the answer is not
             "the person reading". The occasion authored the sentence; the app does
             not write one, the same rule every other block lives under. */
          detail: source === "guest" ? occasion?.avoidNote : undefined
        }
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
 * HOW WIDE EACH BLOCK IS — decided by the application, from what the manifest permits.
 *
 * This was briefly a field the model filled in, and it cost about half of all
 * compositions: one more decision per block, and the answers came back as JSON
 * encoded inside a string field often enough to be unusable on a stage.
 *
 * It should never have been asked. Which blocks belong on a page is a judgment about
 * a person; whether two adjacent blocks can share a row is a fact about the design
 * system, and the design system already states it — `spans` on each component. So
 * the model chooses the blocks and the app pairs consecutive supports that both
 * permit half.
 *
 * The lead is never paired: it opens the page, and a half-width opening is not one.
 * Neither is a block that belongs to an assembly paired with one that does not —
 * an assembly is one unit and a shared row is a visual claim that two blocks belong
 * together, so pairing ShoppingList with the block after it split PlanTheWeek on
 * screen after the completer and the validator had both spent a pass keeping it
 * whole. Members may share a row with each other; the boundary is what is closed.
 *
 * Returns the ROWS as well as the spans, because who shares a row with whom is this
 * function's decision and the renderer used to re-derive it from the spans alone.
 * It scanned only the blocks that resolved, so one dropped block re-paired two
 * blocks that were never paired here.
 *
 * Runs after adjacency, because moving a block changes who its neighbours are.
 */
export const enforceSpans = <T extends { component: string; treatment?: string }>(
  blocks: T[],
  manifest: Manifest
): { blocks: (T & { span: "full" | "half" })[]; paired: string[]; rows: number[][] } => {
  const spec = (n: string) => manifest.components.find((c) => c.name === n);
  const mayHalf = (b: T, i: number) => i > 0 && (spec(b.component)?.spans ?? ["full"]).includes("half");

  /* A SHARED ROW IS A CLAIM THAT TWO BLOCKS ARE COMPARABLE.
   *
   * Permission alone was the whole test, and permission says nothing about size: a
   * RecipeCard with a photograph came out 996px tall beside a one-line
   * MakeAheadCallout of 96px, leaving nine hundred pixels of empty column next to
   * it. Two blocks in a row read as a pair; one of them being ten times the other
   * reads as a mistake.
   *
   * Height is not knowable here — this runs on the server, before anything is
   * measured — but the manifest already carries the fact that decides it. A block
   * showing a photograph is tall, and it is the only reliably tall thing in the
   * vocabulary. So a photograph may share a row with another photograph, and text
   * with text; the boundary between them is where the mismatch lives. */
  const showsPhoto = (b: T) =>
    Boolean(spec(b.component)?.carriesPhoto) && (b.treatment === "hero" || b.treatment === "full");
  const comparable = (a: T, b: T) => showsPhoto(a) === showsPhoto(b);

  const memberOf = new Map<string, string>();
  for (const a of manifest.assemblies) for (const m of a.members) memberOf.set(m, a.name);
  const sameUnit = (a: T, b: T) => memberOf.get(a.component) === memberOf.get(b.component);

  const span: ("full" | "half")[] = blocks.map(() => "full");
  const paired: string[] = [];
  const rows: number[][] = blocks.length ? [[0]] : [];
  for (let i = 1; i < blocks.length; i++) {
    const pairable =
      i < blocks.length - 1 &&
      span[i] !== "half" &&
      mayHalf(blocks[i], i) &&
      mayHalf(blocks[i + 1], i + 1) &&
      sameUnit(blocks[i], blocks[i + 1]) &&
      comparable(blocks[i], blocks[i + 1]);
    if (pairable) {
      span[i] = "half";
      span[i + 1] = "half";
      paired.push(`${blocks[i].component} + ${blocks[i + 1].component} share a row`);
      rows.push([i, i + 1]);
      i++;
    } else {
      rows.push([i]);
    }
  }
  return { blocks: blocks.map((b, i) => ({ ...b, span: span[i] })), paired, rows };
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
