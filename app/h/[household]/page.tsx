import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";

import { loadManifest, checkDrift } from "@/lib/manifest/load";
import { computeFacts, eligible, obligationCandidates, placeObligations, completeAssemblies, enforceAdjacency, enforceSpans, activeAssemblies } from "@/lib/compose/gates";
import { compose, remember } from "@/lib/compose/compose";
import { defaultPageSpec } from "@/lib/compose/default-page";
import { validate } from "@/lib/compose/validate";
import { resolveBlock } from "@/lib/render/resolve";
import { registry, registryNames } from "@/lib/render/registry";
import { getProfile } from "@/lib/signals/profile";
import { activeOccasion, effectiveToday, occasionBrief } from "@/lib/occasion";
import type { CookEvent, Household, Occasion } from "@/lib/signals/types";
import type { Recipe } from "@/lib/types";
import type { Ingredient } from "@/lib/render/resolve";
import { SiteChrome } from "@/components/blocks/site-chrome";
import { BlockStamp } from "@/components/layout/block-stamp";
import { SignalBand } from "@/components/layout/signal-band";
import { TelemetryRail } from "@/components/stage/telemetry-rail";

// Both required: the manifest is re-read from disk on every request, which is what
// makes editing it on stage change these pages with no rebuild.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const read = async <T,>(p: string): Promise<T> =>
  JSON.parse(await readFile(path.join(process.cwd(), p), "utf8")) as T;

const HomePage = async ({
  params,
  searchParams
}: {
  params: Promise<{ household: string }>;
  /* `?today=` moves the clock. The occasion beat is one occasion seen from three
     distances and that cannot be recorded in real time. Unset, it is the real date. */
  searchParams?: Promise<{ today?: string }>;
}) => {
  const { household: id } = await params;
  const { today } = (await searchParams) ?? {};
  const t0 = Date.now();

  /* 01 — load the manifest, and check it against what is actually built */
  const manifest = await loadManifest();
  const drift = checkDrift(manifest, registryNames);

  /* content and signals */
  const recipes = await read<Recipe[]>("lib/content/recipes.json");
  const { households } = await read<{ households: Household[] }>("lib/content/households.json");
  const household = households.find((h) => h.id === id);
  if (!household) notFound();
  const events = await read<CookEvent[]>(`lib/signals/logs/${id}.json`);
  const ingredientsRaw = await read<Record<string, Ingredient[]>>("lib/content/ingredients.json");
  const ingredients = new Map(Object.entries(ingredientsRaw).filter(([k]) => k !== "_"));

  /* the slow call — nightly in principle, cached here */
  const { profile, cached, ms: profileMs } = await getProfile(household, events, recipes);

  /* 02 — resolve state, slow layer and fast layer both */
  const now = { timeOfDay: "evening" as const };
  const { occasions } = await read<{ occasions: Occasion[] }>("lib/content/occasions.json");
  const occasion = activeOccasion(occasions, id, effectiveToday(today));

  /* facts, computed from content + profile + state */
  const facts = computeFacts(recipes, profile, household, now, ingredients, events, occasion);

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
  let { spec, ms: composeMs, live, model: composeModelLabel, cached: composeCached, cacheKey } = await compose({
    manifest: scoped, eligible: allowed, recipes, profile, household, fired: candidates, occasion, facts
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
        manifest: scoped, eligible: allowed, recipes, profile, household, fired: candidates, occasion, facts, repairNotes: errors
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

  const placedObligations = new Set<string>();

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

  /* 09 — render */
  return (
    <>
      <SiteChrome />

      <main className="canvas" style={{ paddingBlock: "56px", display: "flex", flexDirection: "column", gap: "56px" }}>
        {/* Obligations sit immediately before the first block that mentions their
            recipe — which is what the manifest has always said and what the renderer
            was ignoring by dumping them all at the top. An allergen notice above a
            dish is information; the same notice at the top of a page about something
            else is an alarm.

            Blocks are grouped into ROWS before rendering: consecutive "half" spans
            share a row, everything else takes the measure alone. This is the only
            place layout happens, and it is driven entirely by a value the manifest
            permitted and the model chose. Before it existed every page was a stack
            and only the content ever changed, which is how a composed interface ends
            up looking like a CMS. */}
        {rows.map((row, ri) => (
          <div
            key={ri}
            style={
              row.length > 1
                ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", alignItems: "start" }
                : undefined
            }
          >
            {row.map(({ r, i }) => {
              const Block = registry[r.component];
              if (!Block) return null;
              /* The dishes this block renders, not the ones the spec named — same
                 reason `onPage` is built from the resolution. A notice has to sit
                 above the block that shows its dish. */
              const ids = r.recipeIds;
              const attached = fired.filter(
                (f) => ids.includes(f.props.recipeId as string) && !placedObligations.has(f.props.recipeId as string)
              );
              attached.forEach((f) => placedObligations.add(f.props.recipeId as string));
              /* The stamp is the manifest speaking, so it is rendered HERE rather
                 than inside sixteen blocks: one position, one type size, and a new
                 component in the vocabulary is named on the page the moment it has
                 a manifest entry. `i === 0` is the lead by construction — blocks[0]
                 is what the page is about, which the validator already enforces. */
              const spec = manifest.components.find((c) => c.name === r.component);
              return (
                /* A CONTAINER, so a block can see how wide it actually got.
                   `spans: ["half"]` is a claim the manifest makes on a block's
                   behalf, and several blocks could not honour it: RecipeCard's
                   340px image well left a 190px text column in a 570px cell and
                   wrapped the method three words to a line. Blocks answer that
                   claim in their own stylesheets now, against this element. */
                <div
                  key={i}
                  style={{ display: "flex", flexDirection: "column", gap: "24px", containerType: "inline-size" }}
                >
                  {attached.map((f, j) => {
                    const Obligation = registry[f.name];
                    return <Obligation key={`o${j}`} {...(f.props as Record<string, never>)} />;
                  })}
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <BlockStamp label={spec?.label ?? ""} lead={i === 0} />
                    <Block {...r.props} />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </main>

      {/* The reasoning sentence. Always the same place — invariant 3. */}
      <SignalBand lines={["Mise en place", "Everything in its place", "before the fire"]}>
        {spec.rationale}
      </SignalBand>

      <TelemetryRail
        items={[
          ["manifest", manifest.hash],
          ["household", household.label],
          ["blocks", `${resolved.filter((r) => r.ok).length}/${spec.blocks.length}`],
          /* Chosen against the budget, and a different question from `blocks` above
             — that one is rendered-against-chosen and catches a block that was named
             but could not be built. Without this pair the manifest's density section
             has no readout anywhere: edit `maxBlocks` and nothing in frame moves,
             which reads as the manifest being ignored. It is not — but it binds far
             less often than it looks like it should, because the composition prompt
             asks for three or four blocks in its own words. Raising the cap frees
             the model rather than instructing it; lowering it bites immediately. */
          ["density", `${spec.blocks.length}/${manifest.density.maxBlocks}`],
          ["obligations", String(fired.length)],
          ["vocabulary", `${allowed.length}/${manifest.components.length}`],
          ["profile", cached ? "cached" : live ? `${profileMs}ms` : "no key"],
          /* Labelled, because an unexplained 0ms reads as a broken counter rather
             than as the system being cheap. A repair is reported even when the first
             call was a hit: saying "cache hit" while a live model call is happening
             is how a permanently-repairing page hid in plain sight. */
          [
            "compose",
            !live ? "stub" : repaired ? `repair ${composeMs}ms` : composeCached ? "cache hit" : `${composeMs}ms`
          ],
          /* Which model, in frame. A local run and a hosted one are otherwise
             indistinguishable on screen, and the latency claim means nothing
             without it. */
          ["model", composeModelLabel],
          ["repaired", repaired ? "yes" : "no"],
          ["fallback", fellBack ? "DEFAULT PAGE" : "no"],
          ["assemblies", assembled.completed.length ? assembled.completed.join("; ") : "intact"],
          ["total", `${Date.now() - t0}ms`]
        ]}
        warnings={[
          ...(drift.missingComponent.length || drift.missingEntry.length
            ? [`drift: ${[...drift.missingComponent, ...drift.missingEntry].join(", ")}`]
            : []),
          ...(drift.missingLabel.length ? [`unnamed in the manifest: ${drift.missingLabel.join(", ")}`] : []),
          ...(composeFailed
            ? [`fell back to the default page — the model returned nothing usable: ${composeFailed}`]
            : fellBack
              ? [`fell back to the default page — ${errors.length} unrecoverable error(s)`]
              : []),
          ...errors.map((e) => `invalid: ${e}`),
          ...dropped.map((d) => `dropped ${d.ok ? "" : `${d.component} — ${d.reason}`}`),
          ...(live ? [] : ["NO AI_GATEWAY_API_KEY — composition is a stub, not a model"])
        ]}
      />
    </>
  );
};

export default HomePage;
