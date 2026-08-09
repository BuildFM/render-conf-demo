/**
 * What this system actually costs to run, measured — not estimated.
 *
 * The talk's closing argument turns on this number, and "expensive" is the kind
 * of claim a room of engineers checks. So: make one real call of each kind, read
 * the token counts the API reports back, and price them.
 *
 *   npx tsx --env-file=.env.local scripts/cost.mjs
 *
 * Two calls, two very different economics — that split IS the finding:
 *   profile     Opus 5,   once per household per NIGHT.  The judgment.
 *   composition Sonnet 5, once per view (cacheable).     The arrangement.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

if (!process.env.AI_GATEWAY_API_KEY && process.env.VERCEL_AI_GATEWAY_API_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY;
}
process.env.MISE_NO_CACHE = "1";

const ROOT = process.cwd();
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

/* Per million tokens. Sonnet 5 has an introductory rate through 2026-08-31 —
   both are shown, because the talk is after it and the standard rate is the
   honest number to quote on stage. */
const PRICE = {
  "anthropic/claude-opus-5": { in: 5.0, out: 25.0, label: "Opus 5" },
  "anthropic/claude-sonnet-5": { in: 3.0, out: 15.0, label: "Sonnet 5" },
  "anthropic/claude-sonnet-5-intro": { in: 2.0, out: 10.0, label: "Sonnet 5 (intro)" }
};

const { generateObject } = await import("ai");
const { loadManifest } = await import("../lib/manifest/load.ts");
const { computeFacts, eligible, obligationCandidates } = await import("../lib/compose/gates.ts");
const { layoutSpecSchema } = await import("../lib/compose/compose.ts");

const recipes = read("lib/content/recipes.json");
const { households } = read("lib/content/households.json");
const ingredients = new Map(Object.entries(read("lib/content/ingredients.json")).filter(([k]) => k !== "_"));
const manifest = await loadManifest();

const files = readdirSync(path.join(ROOT, "lib/signals/cache"));
const profileFor = (id) => read(`lib/signals/cache/${files.find((f) => f.startsWith(`${id}.`))}`);

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const acid = (s) => `\x1b[33m${s}\x1b[0m`;

const usd = (n) => (n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
const cost = (usage, price) =>
  (usage.inputTokens / 1e6) * price.in + (usage.outputTokens / 1e6) * price.out;

/* ---- the per-view call, measured on the real prompt ---------------------- */



const h = households.find((x) => x.id === "h-twin-a");
const profile = profileFor(h.id);
const events = read(`lib/signals/logs/${h.id}.json`);
const facts = computeFacts(recipes, profile, h, { timeOfDay: "evening" }, ingredients, events);
const allowed = eligible(manifest, facts);
const candidates = obligationCandidates(manifest, facts, recipes, h);

/* Call compose through its own module so the prompt is byte-identical to
   production — a cost model built on a hand-rebuilt prompt measures nothing. */
const { compose } = await import("../lib/compose/compose.ts");
const composed = await compose({
  manifest, eligible: allowed, recipes, profile, household: h, fired: candidates, facts
});

console.log(`\n${bold("measured, one real call of each kind")}\n`);

if (!composed.usage) {
  console.log("compose did not report usage — see the note in lib/compose/compose.ts");
  process.exit(1);
}

const cu = composed.usage;
const composeStd = cost(cu, PRICE["anthropic/claude-sonnet-5"]);
const composeIntro = cost(cu, PRICE["anthropic/claude-sonnet-5-intro"]);

console.log(dim("COMPOSITION · Sonnet 5 · once per view"));
console.log(`  tokens      ${cu.inputTokens} in · ${cu.outputTokens} out`);
console.log(`  per view    ${acid(usd(composeStd))}   ${dim(`(${usd(composeIntro)} at the intro rate)`)}`);
console.log(`  per 1k      ${usd(composeStd * 1000)}`);
console.log(`  per 1M      ${usd(composeStd * 1e6)}`);

/* ---- the nightly call ---------------------------------------------------- */

const { profilePromptFor } = await import("../lib/signals/profile.ts");
const { profileSchema } = await import("../lib/signals/types.ts");

console.log(`\n${dim("PROFILE · Opus 5 · once per household per NIGHT")}`);
if (!profilePromptFor) {
  console.log("  (not exported — see note below)");
} else {
  const { usage: pu } = await generateObject({
    model: "anthropic/claude-opus-5",
    schema: profileSchema,
    temperature: 0,
    prompt: profilePromptFor(h, events, recipes)
  });
  const pCost = cost(pu, PRICE["anthropic/claude-opus-5"]);
  console.log(`  tokens      ${pu.inputTokens} in · ${pu.outputTokens} out`);
  console.log(`  per user    ${acid(usd(pCost))} per night`);
  console.log(`  1k users    ${usd(pCost * 1000)} / night   ${usd(pCost * 1000 * 30)} / month`);
  console.log(`  1M users    ${usd(pCost * 1e6)} / night   ${acid(usd(pCost * 1e6 * 30))} / month`);
}

console.log(
  `\n${dim("The per-view call is cheap and cacheable. The nightly judgment is per-user\nand cannot be shared — that is where the wall is.")}\n`
);
