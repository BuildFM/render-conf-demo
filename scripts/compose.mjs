/**
 * Compose one household (or all) and print what happened, without a browser.
 *
 * Written because iterating through the dev server meant a slow loop with no view
 * of cause and effect: a constraint changed, four pages re-rendered, and the only
 * signal was whether something looked wrong. This prints the vocabulary the model
 * was offered, what it chose, whether that validates, and what resolved.
 *
 *   npx tsx --env-file=.env.local scripts/compose.mjs            # all households
 *   npx tsx --env-file=.env.local scripts/compose.mjs h-twin-a   # one
 *   npx tsx --env-file=.env.local scripts/compose.mjs --dry      # eligibility only, no model
 */
if (!process.env.AI_GATEWAY_API_KEY && process.env.VERCEL_AI_GATEWAY_API_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY;
}

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

const { loadManifest } = await import("../lib/manifest/load.ts");
const { computeFacts, eligible, obligationCandidates, placeObligations, completeAssemblies } =
  await import("../lib/compose/gates.ts");
const { compose } = await import("../lib/compose/compose.ts");
const { validate } = await import("../lib/compose/validate.ts");
const { resolveBlock } = await import("../lib/render/resolve.ts");

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const only = args.find((a) => !a.startsWith("--"));

const recipes = read("lib/content/recipes.json");
const { households } = read("lib/content/households.json");
const ingredients = new Map(Object.entries(read("lib/content/ingredients.json")).filter(([k]) => k !== "_"));
const manifest = await loadManifest();
const known = new Set(recipes.map((r) => r.id));

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const bad = (s) => `\x1b[31m${s}\x1b[0m`;
const acid = (s) => `\x1b[33m${s}\x1b[0m`;

console.log(dim(`manifest ${manifest.hash} · ${manifest.components.length} components · max ${manifest.density.maxBlocks} blocks\n`));

for (const h of households) {
  if (only && h.id !== only) continue;

  const events = read(`lib/signals/logs/${h.id}.json`);
  const cacheDir = "lib/signals/cache";
  const file = readdirSync(path.join(ROOT, cacheDir)).find((n) => n.startsWith(h.id));
  if (!file) {
    console.log(bad(`${h.id}: no cached profile — render the page once to generate it\n`));
    continue;
  }
  const profile = read(`${cacheDir}/${file}`);

  const facts = computeFacts(recipes, profile, h, { timeOfDay: "evening" }, ingredients, events);
  const allowed = eligible(manifest, facts);
  const leads = allowed.filter((c) => c.role === "lead");

  console.log(bold(`── ${h.id} · ${h.label}`));
  console.log(`   ${dim("brief")}    ${acid(profile.salientInference)}`);
  console.log(`   ${dim("leads")}    ${leads.length ? leads.map((c) => c.name).join(", ") : bad("NONE")}`);
  console.log(`   ${dim("support")}  ${dim(allowed.filter((c) => c.role !== "lead").map((c) => c.name).join(", "))}`);

  if (dry) {
    console.log("");
    continue;
  }

  const candidates = obligationCandidates(manifest, facts, recipes, h);
  const t = Date.now();
  let spec;
  try {
    ({ spec } = await compose({ manifest, eligible: allowed, recipes, profile, household: h, fired: candidates }));
  } catch (e) {
    // The gateway times out occasionally. One household failing should not take
    // the run down — the point of the harness is to see the other three.
    console.log(`   ${bad("failed")}   ${String(e.message ?? e).split("\n")[0].slice(0, 90)}\n`);
    continue;
  }

  const finalize = (s) => {
    const done = completeAssemblies(s.blocks, manifest, (component, near) => {
      const cs = manifest.components.find((c) => c.name === component);
      if (!cs || !allowed.some((c) => c.name === component)) return null;
      return {
        component,
        treatment: cs.treatments.includes(near.treatment) ? near.treatment : cs.treatments[0],
        recipeIds: near.recipeIds.slice(0, 1),
        axes: [],
        emphasis: []
      };
    });
    return { ...s, blocks: done.blocks };
  };
  spec = finalize(spec);
  const errors = validate(spec, manifest, candidates, known);
  const ms = Date.now() - t;

  const cookDates = new Map();
  for (const e of events) {
    if (e.type === "completed") cookDates.set(e.recipeId, [...(cookDates.get(e.recipeId) ?? []), e.at]);
  }
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const onPage = new Set(spec.blocks.flatMap((b) => b.recipeIds ?? []));
  const fired = placeObligations(candidates, onPage);

  console.log(`   ${dim("chose")}    ${bold(spec.dominant ?? "(no dominant named)")}  ${dim(`${ms}ms`)}`);
  spec.blocks.forEach((b, i) => {
    const r = resolveBlock(b, {
      recipes: byId, profile, householdSize: h.declared.size, cookDates, ingredients, pantry: h.pantry
    });
    const mark = r.ok ? ok("✓") : bad("✗");
    const why = r.ok ? "" : dim(` — ${r.reason}`);
    const ids = (b.recipeIds ?? []).join(",");
    console.log(`     ${i === 0 ? acid("▸") : " "} ${mark} ${b.component}${dim("@" + b.treatment)}${ids ? dim(" [" + ids + "]") : ""}${why}`);
  });
  if (fired.length) console.log(`   ${dim("obliged")}  ${fired.map((f) => `${f.name} → ${f.props.recipeTitle}`).join(", ")}`);
  console.log(`   ${dim("valid")}    ${errors.length ? bad(errors.length + " error(s)") : ok("yes")}`);
  errors.forEach((e) => console.log(`     ${bad("!")} ${e}`));
  console.log(`   ${dim("says")}     "${spec.rationale}"`);
  console.log("");
}
