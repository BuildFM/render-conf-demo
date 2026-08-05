import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";

import { loadManifest, checkDrift } from "@/lib/manifest/load";
import { computeFacts, eligible, obligationCandidates, placeObligations, completeAssemblies, enforceAdjacency } from "@/lib/compose/gates";
import { compose, remember } from "@/lib/compose/compose";
import { defaultPageSpec } from "@/lib/compose/default-page";
import { validate } from "@/lib/compose/validate";
import { resolveBlock } from "@/lib/render/resolve";
import { registry, registryNames } from "@/lib/render/registry";
import { getProfile } from "@/lib/signals/profile";
import type { CookEvent, Household } from "@/lib/signals/types";
import type { Recipe } from "@/lib/types";
import type { Ingredient } from "@/lib/render/resolve";
import { SiteChrome } from "@/components/blocks/site-chrome";
import { SignalBand } from "@/components/layout/signal-band";
import { TelemetryRail } from "@/components/stage/telemetry-rail";

// Both required: the manifest is re-read from disk on every request, which is what
// makes editing it on stage change these pages with no rebuild.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const read = async <T,>(p: string): Promise<T> =>
  JSON.parse(await readFile(path.join(process.cwd(), p), "utf8")) as T;

const HomePage = async ({ params }: { params: Promise<{ household: string }> }) => {
  const { household: id } = await params;
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

  /* 02 — resolve state */
  const now = { timeOfDay: "evening" as const };

  /* facts, computed from content + profile + state */
  const facts = computeFacts(recipes, profile, household, now, ingredients, events);

  /* 03 — obligation conditions are evaluated in code, before the model is consulted.
     Instances attach after composition, to the dishes actually on the page. */
  const candidates = obligationCandidates(manifest, facts, recipes, household);

  /* 04 — permissions: the model only ever sees what it is allowed to use */
  const allowed = eligible(manifest, facts);

  /* 05 — compose */
  let { spec, ms: composeMs, live, model: composeModelLabel, cached: composeCached, cacheKey } = await compose({
    manifest, eligible: allowed, recipes, profile, household, fired: candidates
  });

  /* 05b — assemblies are completed and adjacencies enforced in code, not requested
     of the model. Applied to every composition including the repair, or the retry
     silently skips it. */
  const finalize = (s: typeof spec) => {
    const done = completeAssemblies(s.blocks, manifest, (component, near) => {
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
    const ordered = enforceAdjacency(done.blocks, manifest);
    return { spec: { ...s, blocks: ordered.blocks }, completed: [...done.completed, ...ordered.moved] };
  };

  let assembled = finalize(spec);
  spec = assembled.spec;

  /* 06 / 07 — validate, then one repair, then fall back */
  const known = new Set(recipes.map((r) => r.id));
  let errors = validate(spec, manifest, candidates, known, allowed);
  let repaired = false;
  if (errors.length && live) {
    repaired = true;
    const retry = await compose({
      manifest, eligible: allowed, recipes, profile, household, fired: candidates, repairNotes: errors
    });
    const retryAssembled = finalize(retry.spec);
    const retryErrors = validate(retryAssembled.spec, manifest, candidates, known, allowed);
    if (!retryErrors.length) {
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
  let fellBack = false;
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

  const onPage = new Set(spec.blocks.flatMap((b) => b.recipeIds));
  const fired = placeObligations(candidates, onPage);

  const placedObligations = new Set<string>();

  const resolved = spec.blocks.map((b) =>
    resolveBlock(b, {
      recipes: byId, profile, householdSize: household.declared.size,
      cookDates, ingredients, pantry: household.pantry
    })
  );
  const dropped = resolved.filter((r) => !r.ok);

  /* 09 — render */
  return (
    <>
      <SiteChrome />

      <main className="canvas" style={{ paddingBlock: "56px", display: "flex", flexDirection: "column", gap: "56px" }}>
        {/* Obligations sit immediately before the first block that mentions their
            recipe — which is what the manifest has always said and what the renderer
            was ignoring by dumping them all at the top. An allergen notice above a
            dish is information; the same notice at the top of a page about something
            else is an alarm. */}
        {resolved.map((r, i) => {
          if (!r.ok) return null;
          const Block = registry[r.component];
          if (!Block) return null;
          const ids = spec.blocks[i].recipeIds ?? [];
          const attached = fired.filter(
            (f) => ids.includes(f.props.recipeId as string) && !placedObligations.has(f.props.recipeId as string)
          );
          attached.forEach((f) => placedObligations.add(f.props.recipeId as string));
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {attached.map((f, j) => {
                const Obligation = registry[f.name];
                return <Obligation key={`o${j}`} {...(f.props as Record<string, never>)} />;
              })}
              <Block {...r.props} />
            </div>
          );
        })}
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
          ...(drift.ok ? [] : [`drift: ${[...drift.missingComponent, ...drift.missingEntry].join(", ")}`]),
          ...(fellBack ? [`fell back to the default page — ${errors.length} unrecoverable error(s)`] : []),
          ...errors.map((e) => `invalid: ${e}`),
          ...dropped.map((d) => `dropped ${d.ok ? "" : `${d.component} — ${d.reason}`}`),
          ...(live ? [] : ["NO AI_GATEWAY_API_KEY — composition is a stub, not a model"])
        ]}
      />
    </>
  );
};

export default HomePage;
