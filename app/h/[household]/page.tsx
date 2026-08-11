import { notFound } from "next/navigation";

import { runPipeline } from "@/lib/compose/pipeline";
import { parseOverrides } from "@/lib/compose/overrides";
import { registry } from "@/lib/render/registry";
import { SiteChrome } from "@/components/blocks/site-chrome";
import { BlockStamp } from "@/components/layout/block-stamp";
import { SignalBand } from "@/components/layout/signal-band";
import { TelemetryRail } from "@/components/stage/telemetry-rail";
import { VocabularyStrip } from "@/components/stage/vocabulary-strip";

// Both required: the manifest is re-read from disk on every request, which is what
// makes editing it on stage change these pages with no rebuild.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The ten stages run in `lib/compose/pipeline.ts`; this file only renders them.
 *
 * They were inline here until the twins view needed to run them twice. Splitting the
 * pipeline out is what keeps the two routes agreeing about what a household is
 * eligible for — the alternative was a second copy, which this codebase has already
 * paid for twice.
 */
const HomePage = async ({
  params,
  searchParams
}: {
  params: Promise<{ household: string }>;
  /* `?today=` moves the clock. The occasion beat is one occasion seen from three
     distances and that cannot be recorded in real time. Unset, it is the real date.
     `?facts=` forces behavioural facts — see lib/compose/overrides.ts.
     `?strip=0` drops the vocabulary strip, for the stage view's iframes. */
  searchParams?: Promise<{ today?: string; facts?: string; strip?: string }>;
}) => {
  const { household: id } = await params;
  const { today, facts: factsParam, strip } = (await searchParams) ?? {};

  const run = await runPipeline({
    householdId: id,
    today,
    overrides: parseOverrides(factsParam)
  });
  if (!run) notFound();

  const { manifest, household, spec, rows, fired, dropped, drift, errors, facts, allowed, chosen, overrides, factsOverridden, resolved, telemetry: t } = run;

  const placedObligations = new Set<string>();

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
              const cspec = manifest.components.find((c) => c.name === r.component);
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
                    <BlockStamp label={cspec?.label ?? ""} lead={i === 0} />
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

      {/* The cause, enumerated. Instrumentation rather than page — it sits below the
          signal band, on the raised ground, for the same reason the telemetry rail
          does: the artifact ends where the apparatus begins.

          Suppressed inside the stage view, which measures each pane from the bottom
          of the last child and would otherwise draw every page into a frame three
          times taller than the page. */}
      {strip !== "0" && (
      <VocabularyStrip
        components={manifest.components}
        obligations={manifest.obligations}
        firedObligations={[...new Set(fired.map((f) => f.name))]}
        facts={facts}
        eligible={allowed.map((c) => c.name)}
        chosen={chosen}
        overrides={overrides}
        basePath={`/h/${household.id}`}
        today={today}
      />
      )}

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
          /* "withheld" is not cosmetic. An overridden page is composed WITHOUT the
             nightly characterization, because it describes the household as they
             really behave — see the note on `factsOverridden`. The rail is where the
             system admits what it did, so it has to admit this one too. */
          [
            "profile",
            factsOverridden ? "withheld — facts overridden" : t.profileCached ? "cached" : t.live ? `${t.profileMs}ms` : "no key"
          ],
          /* Labelled, because an unexplained 0ms reads as a broken counter rather
             than as the system being cheap. A repair is reported even when the first
             call was a hit: saying "cache hit" while a live model call is happening
             is how a permanently-repairing page hid in plain sight. */
          [
            "compose",
            !t.live ? "stub" : t.repaired ? `repair ${t.composeMs}ms` : t.composeCached ? "cache hit" : `${t.composeMs}ms`
          ],
          /* Which model, in frame. A local run and a hosted one are otherwise
             indistinguishable on screen, and the latency claim means nothing
             without it. */
          ["model", t.composeModelLabel],
          ["repaired", t.repaired ? "yes" : "no"],
          ["fallback", t.fellBack ? "DEFAULT PAGE" : "no"],
          ["assemblies", t.assembled.length ? t.assembled.join("; ") : "intact"],
          ["total", `${t.totalMs()}ms`]
        ]}
        warnings={[
          ...(drift.missingComponent.length || drift.missingEntry.length
            ? [`drift: ${[...drift.missingComponent, ...drift.missingEntry].join(", ")}`]
            : []),
          ...(drift.missingLabel.length ? [`unnamed in the manifest: ${drift.missingLabel.join(", ")}`] : []),
          ...(t.composeFailed
            ? [`fell back to the default page — the model returned nothing usable: ${t.composeFailed}`]
            : t.fellBack
              ? [`fell back to the default page — ${errors.length} unrecoverable error(s)`]
              : []),
          ...errors.map((e) => `invalid: ${e}`),
          ...dropped.map((d) => `dropped ${d.ok ? "" : `${d.component} — ${d.reason}`}`),
          ...(t.live ? [] : ["NO AI_GATEWAY_API_KEY — composition is a stub, not a model"])
        ]}
      />
    </>
  );
};

export default HomePage;
