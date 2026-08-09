/**
 * Composition latency AND correctness, per model, against the real prompt.
 *
 * Speed alone is the wrong measure — a fast model that splits an assembly or
 * under-fills TechniqueThread costs a repair pass and ends up slower. This runs
 * each candidate through the actual pipeline and validates the output.
 *
 *   node --env-file=.env.local scripts/bench-models.mjs
 */
if (!process.env.AI_GATEWAY_API_KEY && process.env.VERCEL_AI_GATEWAY_API_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY;
}

import { readFileSync } from "node:fs";

const { loadManifest } = await import("../lib/manifest/load.ts");
const { computeFacts, eligible, obligationCandidates } = await import("../lib/compose/gates.ts");
const { compose } = await import("../lib/compose/compose.ts");
const { validate } = await import("../lib/compose/validate.ts");

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const recipes = read("lib/content/recipes.json");
const { households } = read("lib/content/households.json");
const ingredientsRaw = read("lib/content/ingredients.json");
const ingredients = new Map(Object.entries(ingredientsRaw).filter(([k]) => k !== "_"));

const CANDIDATES = [
  "anthropic/claude-sonnet-5",
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-sonnet-4.5",
  "openai/gpt-5.4",
  "google/gemini-3-flash"
];

const manifest = await loadManifest();
const known = new Set(recipes.map((r) => r.id));

console.log("model                          household   ms     blocks  valid  errors");
console.log("-".repeat(78));

for (const model of CANDIDATES) {
  process.env.MISE_COMPOSE_MODEL = model;
  for (const h of households) {
    const cacheFile = `lib/signals/cache`;
    const { readdirSync } = await import("node:fs");
    const f = readdirSync(cacheFile).find((n) => n.startsWith(h.id));
    if (!f) continue;
    const profile = read(`${cacheFile}/${f}`);

    const facts = computeFacts(recipes, profile, h, { timeOfDay: "evening" }, ingredients);
    const allowed = eligible(manifest, facts);
    const candidates = obligationCandidates(manifest, facts, recipes, h);

    try {
      const t = Date.now();
      const { spec } = await compose({
        manifest, eligible: allowed, recipes, profile, household: h, fired: candidates, facts
      });
      const ms = Date.now() - t;
      const errs = validate(spec, manifest, candidates, known, allowed);
      console.log(
        `${model.padEnd(30)} ${h.id.padEnd(11)} ${String(ms).padStart(5)}  ${String(spec.blocks.length).padStart(5)}   ${errs.length ? "NO " : "yes"}    ${errs[0] ? errs[0].slice(0, 40) : ""}`
      );
    } catch (e) {
      console.log(`${model.padEnd(30)} ${h.id.padEnd(11)}  FAILED  ${String(e.message).slice(0, 40)}`);
    }
  }
}
