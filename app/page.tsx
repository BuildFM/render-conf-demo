import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadManifest } from "@/lib/manifest/load";
import { defaultPageSpec } from "@/lib/compose/default-page";
import { validate } from "@/lib/compose/validate";
import { resolveBlock } from "@/lib/render/resolve";
import { registry } from "@/lib/render/registry";
import type { Recipe } from "@/lib/types";
import type { Ingredient } from "@/lib/render/resolve";
import type { Profile } from "@/lib/signals/types";
import { SiteChrome } from "@/components/blocks/site-chrome";
import { SectionHead } from "@/components/layout/section-head";
import { SignalBand } from "@/components/layout/signal-band";
import { TelemetryRail } from "@/components/stage/telemetry-rail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const read = async <T,>(p: string): Promise<T> =>
  JSON.parse(await readFile(path.join(process.cwd(), p), "utf8")) as T;

/** Beat 0. No household, no model, no signal — a person arranged this in advance. */
const DefaultHome = async () => {
  const manifest = await loadManifest();
  const recipes = await read<Recipe[]>("lib/content/recipes.json");
  const ingredientsRaw = await read<Record<string, Ingredient[]>>("lib/content/ingredients.json");
  const ingredients = new Map(Object.entries(ingredientsRaw).filter(([k]) => k !== "_"));

  const spec = defaultPageSpec();
  const errors = validate(spec, manifest, [], new Set(recipes.map((r) => r.id)));

  const emptyProfile = {
    signals: { cookedRecipeIds: [], repeatRecipeIds: [], abandonedRecipeIds: [] }
  } as unknown as Profile;

  const resolved = spec.blocks.map((b) =>
    resolveBlock(b, {
      recipes: new Map(recipes.map((r) => [r.id, r])),
      profile: emptyProfile,
      householdSize: 4,
      cookDates: new Map(),
      ingredients,
      pantry: []
    })
  );

  return (
    <>
      <SiteChrome />
      <main className="canvas" style={{ paddingBlock: "56px", display: "flex", flexDirection: "column", gap: "56px" }}>
        {/* Consecutive blocks under one section head are one group. Rendering each
            in its own wrapper put a 56px section gap between rows that are meant to
            read as a contiguous index. */}
        {groupBySection(spec.blocks, resolved).map((group, gi) => (
          <section key={gi} style={{ display: "flex", flexDirection: "column", gap: group.title ? "24px" : "0" }}>
            {group.title ? <SectionHead title={group.title} rule="signal" /> : null}
            <div style={{ display: "flex", flexDirection: "column", gap: group.tight ? "0" : "40px" }}>
              {group.items.map(({ component, props }, i) => {
                const Block = registry[component];
                return Block ? <Block key={i} {...props} /> : null;
              })}
            </div>
          </section>
        ))}
      </main>
      <SignalBand lines={["Mise en place", "Everything in its place", "before the fire"]}>
        {spec.rationale}
      </SignalBand>
      <TelemetryRail
        items={[
          ["manifest", manifest.hash],
          ["page", "default — no household"],
          ["blocks", `${resolved.filter((r) => r.ok).length}/${spec.blocks.length}`],
          ["density", `${spec.blocks.length}/${manifest.density.maxBlocks}`],
          ["model", "none"]
        ]}
        warnings={[
          ...errors.map((e) => `invalid: ${e}`),
          ...resolved.filter((r) => !r.ok).map((d) => `dropped ${d.ok ? "" : `${d.component} — ${d.reason}`}`)
        ]}
      />
    </>
  );
};

/** Groups consecutive blocks that share a section head. A group whose blocks are
 *  all the same component is "tight" — an index, not a stack of sections. */
const groupBySection = (
  blocks: { section?: string; component: string }[],
  resolved: { ok: boolean; component: string; props?: Record<string, unknown> }[]
) => {
  const groups: { title?: string; tight: boolean; items: { component: string; props: Record<string, unknown> }[] }[] = [];
  blocks.forEach((b, i) => {
    const r = resolved[i];
    if (!r?.ok) return;
    if (b.section || groups.length === 0) groups.push({ title: b.section, tight: false, items: [] });
    groups[groups.length - 1].items.push({ component: r.component, props: r.props ?? {} });
  });
  for (const g of groups) g.tight = g.items.length > 1 && new Set(g.items.map((i) => i.component)).size === 1;
  return groups;
};

export default DefaultHome;
