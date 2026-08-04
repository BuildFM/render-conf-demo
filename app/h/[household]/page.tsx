import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";

import { loadManifest, checkDrift } from "@/lib/manifest/load";
import { computeFacts, eligible, obligationCandidates, placeObligations } from "@/lib/compose/gates";
import { compose, type LayoutSpec } from "@/lib/compose/compose";
import { validate } from "@/lib/compose/validate";
import { resolveBlock } from "@/lib/render/resolve";
import { registry, registryNames } from "@/lib/render/registry";
import { getProfile } from "@/lib/signals/profile";
import type { CookEvent, Household } from "@/lib/signals/types";
import type { Recipe } from "@/lib/types";
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

  /* the slow call — nightly in principle, cached here */
  const { profile, cached, ms: profileMs } = await getProfile(household, events, recipes);

  /* 02 — resolve state */
  const now = { timeOfDay: "evening" as const };

  /* facts, computed from content + profile + state */
  const facts = computeFacts(recipes, profile, household, now);

  /* 03 — obligation conditions are evaluated in code, before the model is consulted.
     Instances attach after composition, to the dishes actually on the page. */
  const candidates = obligationCandidates(manifest, facts, recipes, household);

  /* 04 — permissions: the model only ever sees what it is allowed to use */
  const allowed = eligible(manifest, facts);

  /* 05 — compose */
  let { spec, ms: composeMs, live } = await compose({
    manifest, eligible: allowed, recipes, profile, household, fired: candidates
  });

  /* 06 / 07 — validate, then one repair, then fall back */
  const known = new Set(recipes.map((r) => r.id));
  let errors = validate(spec, manifest, candidates, known);
  let repaired = false;
  if (errors.length && live) {
    repaired = true;
    const retry = await compose({
      manifest, eligible: allowed, recipes, profile, household, fired: candidates, repairNotes: errors
    });
    const retryErrors = validate(retry.spec, manifest, candidates, known);
    if (!retryErrors.length) {
      spec = retry.spec;
      composeMs += retry.ms;
      errors = [];
    } else {
      errors = retryErrors;
    }
  }

  /* 08 — resolve slots: ids in, values out. The model never supplied a fact. */
  const cookDates = new Map<string, string[]>();
  for (const e of events) {
    if (e.type === "completed") cookDates.set(e.recipeId, [...(cookDates.get(e.recipeId) ?? []), e.at]);
  }
  const byId = new Map(recipes.map((r) => [r.id, r]));

  const onPage = new Set(spec.blocks.flatMap((b) => b.recipeIds));
  const fired = placeObligations(candidates, onPage);

  const resolved = spec.blocks.map((b) =>
    resolveBlock(b, { recipes: byId, profile, householdSize: household.declared.size, cookDates })
  );
  const dropped = resolved.filter((r) => !r.ok);

  /* 09 — render */
  return (
    <>
      <SiteChrome />

      <main style={{ padding: "40px", display: "flex", flexDirection: "column", gap: "56px" }}>
        {fired.map((f, i) => {
          const Obligation = registry[f.name];
          return <Obligation key={`o${i}`} {...(f.props as Record<string, never>)} />;
        })}

        {resolved.map((r, i) => {
          if (!r.ok) return null;
          const Block = registry[r.component];
          return Block ? <Block key={i} {...r.props} /> : null;
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
          ["obligations", String(fired.length)],
          ["vocabulary", `${allowed.length}/${manifest.components.length}`],
          ["profile", cached ? "cached" : live ? `${profileMs}ms` : "no key"],
          ["compose", live ? `${composeMs}ms` : "stub"],
          ["repaired", repaired ? "yes" : "no"],
          ["total", `${Date.now() - t0}ms`]
        ]}
        warnings={[
          ...(drift.ok ? [] : [`drift: ${[...drift.missingComponent, ...drift.missingEntry].join(", ")}`]),
          ...errors.map((e) => `invalid: ${e}`),
          ...dropped.map((d) => `dropped ${d.ok ? "" : `${d.component} — ${d.reason}`}`),
          ...(live ? [] : ["NO ANTHROPIC_API_KEY — composition is a stub, not a model"])
        ]}
      />
    </>
  );
};

export default HomePage;
