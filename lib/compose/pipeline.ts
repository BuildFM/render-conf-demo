import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadManifest, checkDrift } from "@/lib/manifest/load";
import { computeFacts, eligible, obligationCandidates, placeObligations, completeAssemblies, enforceAdjacency, enforceSpans, activeAssemblies } from "@/lib/compose/gates";
import { compose, remember } from "@/lib/compose/compose";
import { defaultPageSpec } from "@/lib/compose/default-page";
import { validate } from "@/lib/compose/validate";
import { resolveBlock } from "@/lib/render/resolve";
import { registryNames } from "@/lib/render/registry";
import { getProfile } from "@/lib/signals/profile";
import { activeOccasion, effectiveToday } from "@/lib/occasion";
import { applyOverrides, type Overrides } from "@/lib/compose/overrides";
import type { CookEvent, Household, Occasion } from "@/lib/signals/types";
import type { Recipe } from "@/lib/types";
import type { Ingredient } from "@/lib/render/resolve";

/**
 * The ten stages, in one place, so that more than one route can run them.
 *
 * This used to live inline in `app/h/[household]/page.tsx`, which was fine while
 * exactly one route composed a page. The twins view composes two, and the only two
 * ways to give it what it needs are to export this or to write a second copy of it —
 * and a second copy is the mistake this codebase has already made twice and paid for
 * twice (`satisfiesMustFollow` held by both the enforcer and the validator; the
 * display copy of `test()` the stage view nearly grew). A display that computes its
 * own answer eventually disagrees with the pipeline, and then the display is the lie.
 *
 * Rendering is NOT here. This returns the resolved blocks and the numbers; the route
 * decides what a page looks like. Eight of the ten stages below are code, and that
 * ratio is the argument the demo is making — it is worth being able to read them in
 * order in one file.
 */

const read = async <T,>(p: string): Promise<T> =>
  JSON.parse(await readFile(path.join(process.cwd(), p), "utf8")) as T;

export type PipelineArgs = {
  householdId: string;
  /** `?today=` — moves the clock. Unset, it is the real date. */
  today?: string;
  /** `?facts=` — forces behavioural facts. Empty for an honest load. */
  overrides?: Overrides;
};

export type PipelineResult = Awaited<ReturnType<typeof runPipeline>>;

/** Null when there is no such household — the route turns that into a 404. */
export const runPipeline = async ({ householdId, today, overrides = new Map() }: PipelineArgs) => {
  const t0 = Date.now();

  /* 01 — load the manifest, and check it against what is actually built */
  const manifest = await loadManifest();
  const drift = checkDrift(manifest, registryNames);

  /* content and signals */
  const recipes = await read<Recipe[]>("lib/content/recipes.json");
  const { households } = await read<{ households: Household[] }>("lib/content/households.json");
  const household = households.find((h) => h.id === householdId);
  if (!household) return null;
  const events = await read<CookEvent[]>(`lib/signals/logs/${householdId}.json`);
  const ingredientsRaw = await read<Record<string, Ingredient[]>>("lib/content/ingredients.json");
  const ingredients = new Map(Object.entries(ingredientsRaw).filter(([k]) => k !== "_"));

  /* the slow call — nightly in principle, cached here */
  const { profile, cached, ms: profileMs } = await getProfile(household, events, recipes);

  /* 02 — resolve state, slow layer and fast layer both */
  const now = { timeOfDay: "evening" as const };
  const { occasions } = await read<{ occasions: Occasion[] }>("lib/content/occasions.json");
  const occasion = activeOccasion(occasions, householdId, effectiveToday(today));

  /* facts, computed from content + profile + state — and then, only when the URL
     says so, a few of them forced. Everything downstream runs against the overridden
     map, because the point of the override is to watch the REAL pipeline gate a
     household that does not exist. A display-only override would prove nothing. */
  const facts = applyOverrides(
    computeFacts(recipes, profile, household, now, ingredients, events, occasion),
    overrides
  );
  const factsOverridden = overrides.size > 0;

  /* 03 — obligation conditions are evaluated in code, before the model is consulted.
     Instances attach after composition, to the dishes actually on the page. */
  const candidates = obligationCandidates(manifest, facts, recipes, household, occasion?.occasion ?? null);

  /* 04 — permissions: the model only ever sees what it is allowed to use */
  const allowed = eligible(manifest, facts);

  /* An assembly only binds while both its members are eligible — see activeAssemblies. */
  const scoped = { ...manifest, assemblies: activeAssemblies(manifest, allowed) };

  /* 05 — compose.

     Wrapped, because "the model returned nothing usable" is a different failure from
     "the model returned an invalid layout" and only the second one was handled. A
     schema miss throws out of generateObject, so it skipped the repair pass, skipped
     the fallback, and took the whole request down with a 500 — on a recording day,
     the worst outcome in the system. The rule was always that a half-valid layout
     never reaches a person; no layout at all is the same rule. */
  let composeFailed: string | null = null;
  const composed = await compose({
    manifest: scoped, eligible: allowed, recipes, profile, household, fired: candidates, occasion, facts, factsOverridden
  }).catch((e: unknown) => {
    composeFailed = e instanceof Error ? e.message.split("\n")[0] : String(e);
    return {
      spec: defaultPageSpec(),
      ms: 0,
      live: false,
      model: "fallback",
      cached: false,
      cacheKey: null as string | null,
      usage: null
    };
  });

  /* Only the two the repair pass replaces are mutable. */
  const { live, model: composeModelLabel, cached: composeCached, cacheKey } = composed;
  let { spec, ms: composeMs } = composed;

  /* 05b — assemblies are completed and adjacencies enforced in code, not requested
     of the model. Applied to every composition including the repair, or the retry
     silently skips it. */
  const finalize = (s: typeof spec) => {
    const done = completeAssemblies(s.blocks, scoped, (component, near) => {
      const cs = manifest.components.find((c) => c.name === component);
      if (!cs || !allowed.some((c) => c.name === component)) return null;
      return {
        component,
        treatment: cs.treatments.includes(near.treatment) ? near.treatment : cs.treatments[0],
        /* All of the anchor's recipes, not the first. A completed ShoppingList
           built from one recipe fails resolution — it needs two or more planned
           dishes — and the assembly it was meant to finish renders with a hole. */
        recipeIds: near.recipeIds,
        axes: [],
        emphasis: []
      };
    });
    const ordered = enforceAdjacency(done.blocks, scoped);
    return {
      spec: { ...s, blocks: ordered.blocks },
      completed: [...done.completed, ...ordered.moved]
    };
  };

  let assembled = finalize(spec);
  spec = assembled.spec;

  /* 06 / 07 — validate, then one repair, then fall back */
  const known = new Set(recipes.map((r) => r.id));
  let errors = composeFailed ? [] : validate(spec, scoped, candidates, known, allowed, facts);
  let repaired = false;
  if (errors.length && live) {
    repaired = true;
    /* Wrapped for the same reason the first call is: the repair runs the same retry
       ladder against the same schema, and a miss on all three attempts threw out of
       generateObject, past the fallback, and took the request down with a 500. The
       repair path is the one where schema misses are MOST likely — it is only
       reached because something already went wrong. */
    let retry: Awaited<ReturnType<typeof compose>> | null = null;
    try {
      retry = await compose({
        manifest: scoped, eligible: allowed, recipes, profile, household, fired: candidates, occasion, facts, factsOverridden, repairNotes: errors
      });
    } catch (e: unknown) {
      composeFailed = e instanceof Error ? e.message.split("\n")[0] : String(e);
    }
    const retryAssembled = retry ? finalize(retry.spec) : null;
    const retryErrors = retryAssembled
      ? validate(retryAssembled.spec, scoped, candidates, known, allowed, facts)
      : errors;
    if (retry && retryAssembled && !retryErrors.length) {
      spec = retryAssembled.spec;
      assembled = retryAssembled;
      composeMs += retry.ms;
      errors = [];
    } else {
      errors = retryErrors;
    }
  }

  /* Still invalid after one repair: fall back to the hand-authored default page.
     A half-valid layout never reaches a person — build spec §7b. The failure is
     surfaced in the rail rather than swallowed. */
  let fellBack = Boolean(composeFailed);
  if (errors.length) {
    fellBack = true;
    spec = defaultPageSpec();
  }

  /* Keep only what passed. A fallback is never cached — the next load should get a
     fresh attempt rather than being pinned to the default page for the session.
     *
     * `|| repaired` is load-bearing and was missing. A cache hit skipped the store,
     * so a cached spec that stopped validating — because the VALIDATOR changed, not
     * the manifest — was repaired on every single load and the repair was thrown
     * away every single time. Twin B did exactly that: it reported "cache hit" while
     * making a live model call on each request, and its block count moved between
     * reloads because the repair is nondeterministic. Repairing means the entry is
     * stale by definition, so replace it. */
  if (live && !fellBack && (!composeCached || repaired)) {
    remember(cacheKey, { spec, ms: composeMs, model: composeModelLabel });
  }

  /* 08 — resolve slots: ids in, values out. The model never supplied a fact. */
  const cookDates = new Map<string, string[]>();
  for (const e of events) {
    if (e.type === "completed") cookDates.set(e.recipeId, [...(cookDates.get(e.recipeId) ?? []), e.at]);
  }
  const byId = new Map(recipes.map((r) => [r.id, r]));

  const resolved = spec.blocks.map((b) =>
    resolveBlock(b, {
      recipes: byId, profile, householdSize: household.declared.size,
      cookDates, ingredients, pantry: household.pantry, occasion
    })
  );
  const dropped = resolved.filter((r) => !r.ok);

  /* What is ON THE PAGE, from the blocks that actually rendered — not from the ids
     the model named. Those two stopped being the same thing when menu-wide blocks
     began resolving against the occasion menu: a dish that reached the page through
     the menu was invisible here, so its allergen notice was filtered out and a
     guest who cannot eat dairy got a brown-butter dish with no warning. A block
     that failed to resolve is not on the page either, and used to count. */
  const onPage = new Set(resolved.flatMap((r) => (r.ok ? r.recipeIds : [])));
  const fired = placeObligations(candidates, onPage);

  /* 08a — the application decides widths, from what the manifest permits. */
  const placedSpans = enforceSpans(spec.blocks, scoped);

  /* 08b — the rows enforceSpans decided, with blocks that failed to resolve taken
     out of them. Re-deriving the pairs here from spans alone meant scanning only
     the blocks that resolved: drop one half and its partner paired with whatever
     came next instead — two blocks the layout stage never put together. Who shares
     a row is a layout decision and there is now one place that makes it. */
  const rows = placedSpans.rows
    .map((row) =>
      row.flatMap((i) => (resolved[i].ok ? [{ r: resolved[i] as Extract<(typeof resolved)[number], { ok: true }>, i }] : []))
    )
    .filter((row) => row.length > 0);

  /* The vocabulary strip's third state, and it is read off what RESOLVED rather than
     off what the model named. A chip filled in for a block that failed to build would
     say the model put something on the page that is not on the page — the same
     distinction `onPage` above exists to keep. */
  const chosen = spec.blocks
    .map((b, i) => ({ component: b.component, treatment: b.treatment, ok: resolved[i]?.ok ?? false }))
    .filter((b) => b.ok)
    .map(({ component, treatment }) => ({ component, treatment }));

  return {
    manifest,
    household,
    facts,
    factsOverridden,
    overrides,
    today,
    allowed,
    chosen,
    spec,
    resolved,
    rows,
    fired,
    dropped,
    drift,
    errors,
    telemetry: {
      profileCached: cached,
      profileMs,
      composeMs,
      composeModelLabel,
      composeCached,
      composeFailed: composeFailed as string | null,
      live,
      repaired,
      fellBack,
      assembled: assembled.completed,
      totalMs: () => Date.now() - t0
    }
  };
};
