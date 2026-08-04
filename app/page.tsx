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
      <main style={{ padding: "40px", display: "flex", flexDirection: "column", gap: "56px" }}>
        {resolved.map((r, i) => {
          if (!r.ok) return null;
          const Block = registry[r.component];
          return Block ? <Block key={i} {...r.props} /> : null;
        })}
      </main>
      <SignalBand lines={["Mise en place", "Everything in its place", "before the fire"]}>
        {spec.rationale}
      </SignalBand>
      <TelemetryRail
        items={[
          ["manifest", manifest.hash],
          ["page", "default — no household"],
          ["blocks", `${resolved.filter((r) => r.ok).length}/${spec.blocks.length}`],
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

export default DefaultHome;
