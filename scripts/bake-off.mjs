/**
 * Which model can actually do this job — measured, not guessed.
 *
 * For this workload the differentiator is not general intelligence. It is whether a
 * model can read a vocabulary plus a constraint list and emit a small, schema-valid
 * object that obeys the constraints. We already have an oracle for that: the
 * validator. So the metric is FIRST-PASS VALIDITY — what fraction of compositions
 * survive without a repair call — alongside latency.
 *
 * That is the honest comparison, because a local model that is twice as fast but
 * needs a repair pass half the time is not faster.
 *
 *   node scripts/bake-off.mjs --local qwen3.6 qwen2.5:14b        # compare local models
 *   node scripts/bake-off.mjs --runs 8 --local qwen3.6           # more samples
 *   npx tsx --env-file=.env.local scripts/bake-off.mjs --gateway # the hosted baseline
 *
 * Runs every household, every model, N times each. Models are loaded one at a time
 * and this machine has 18GB — do not expect to hold two large ones at once.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

if (!process.env.AI_GATEWAY_API_KEY && process.env.VERCEL_AI_GATEWAY_API_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY;
}

/* Mandatory. This script runs the same inputs repeatedly in ONE process, which is
   exactly what the compose cache is built to collapse — leave it on and every run
   after the first reports 0ms and 100% validity, and the benchmark measures the
   Map rather than the model. */
process.env.MISE_NO_CACHE = "1";

const args = process.argv.slice(2);
const runs = Number(args[args.indexOf("--runs") + 1]) || 5;
const gateway = args.includes("--gateway");
const localAt = args.indexOf("--local");
const localModels = localAt >= 0 ? args.slice(localAt + 1).filter((a) => !a.startsWith("--")) : [];

if (!gateway && !localModels.length) {
  console.log("usage: bake-off.mjs [--runs N] (--gateway | --local <model> [<model>...])");
  process.exit(1);
}

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const bad = (s) => `\x1b[31m${s}\x1b[0m`;

const recipes = read("lib/content/recipes.json");
const { households } = read("lib/content/households.json");
const ingredients = new Map(Object.entries(read("lib/content/ingredients.json")).filter(([k]) => k !== "_"));

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const median = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);

const trial = async (label, configure) => {
  configure();

  /* Re-imported per model: the module reads its configuration at import time, and a
     cached copy would quietly benchmark the previous model under a new name. */
  const bust = `?m=${encodeURIComponent(label)}`;
  const { loadManifest } = await import(`../lib/manifest/load.ts${bust}`);
  const { computeFacts, eligible, obligationCandidates, completeAssemblies, enforceAdjacency } = await import(
    `../lib/compose/gates.ts${bust}`
  );
  const { compose } = await import(`../lib/compose/compose.ts${bust}`);
  const { validate } = await import(`../lib/compose/validate.ts${bust}`);

  const manifest = await loadManifest();
  const known = new Set(recipes.map((r) => r.id));
  /* Profile caches are named "<household>.<contentHash>.json", so the household id
     is a PREFIX and not the stem. Matching on the stem silently skipped every
     household and reported a confident 0/0 — a benchmark that measures nothing is
     worse than no benchmark, so this resolves the file and fails loudly if it cannot. */
  const cacheDir = "lib/signals/cache";
  const files = readdirSync(path.join(ROOT, cacheDir));
  const profileFile = (id) => files.find((f) => f === `${id}.json` || f.startsWith(`${id}.`));

  const latencies = [];
  let attempted = 0;
  let valid = 0;
  let threw = 0;
  const failures = new Map();

  for (let i = 0; i < runs; i++) {
    for (const h of households) {
      const pf = profileFile(h.id);
      if (!pf) throw new Error(`no cached profile for ${h.id} — render the page once to generate it`);
      const profile = read(`${cacheDir}/${pf}`);
      const events = read(`lib/signals/logs/${h.id}.json`);
      const facts = computeFacts(recipes, profile, h, { timeOfDay: "evening" }, ingredients, events);
      const allowed = eligible(manifest, facts);
      const candidates = obligationCandidates(manifest, facts, recipes, h);

      attempted++;
      try {
        const { spec, ms } = await compose({
          manifest, eligible: allowed, recipes, profile, household: h, fired: candidates
        });
        latencies.push(ms);

        /* Same finalisation the page does, or the comparison flatters the model by
           counting failures the app already repairs in code. */
        const done = completeAssemblies(spec.blocks, manifest, (component, near) => {
          const cs = manifest.components.find((c) => c.name === component);
          if (!cs || !allowed.some((c) => c.name === component)) return null;
          return {
            component,
            treatment: cs.treatments.includes(near.treatment) ? near.treatment : cs.treatments[0],
            recipeIds: near.recipeIds,
            axes: [],
            emphasis: []
          };
        });
        const ordered = enforceAdjacency(done.blocks, manifest);
        const errors = validate({ ...spec, blocks: ordered.blocks }, manifest, candidates, known, allowed);

        if (!errors.length) valid++;
        else for (const e of errors) failures.set(e, (failures.get(e) ?? 0) + 1);

        process.stdout.write(errors.length ? bad("·") : ok("·"));
      } catch (e) {
        threw++;
        const msg = String(e.message ?? e).split("\n")[0].slice(0, 70);
        failures.set(`THREW: ${msg}`, (failures.get(`THREW: ${msg}`) ?? 0) + 1);
        process.stdout.write(bad("x"));
      }
    }
  }
  process.stdout.write("\n");

  return { label, attempted, valid, threw, latencies, failures };
};

const results = [];

if (gateway) {
  results.push(
    await trial("gateway/sonnet-5", () => {
      delete process.env.MISE_PROVIDER;
    })
  );
}

for (const m of localModels) {
  console.log(dim(`\nloading ${m} …`));
  results.push(
    await trial(`ollama/${m}`, () => {
      process.env.MISE_PROVIDER = "ollama";
      process.env.MISE_OLLAMA_MODEL = m;
    })
  );
}

console.log(`\n${bold("first-pass validity — no repair call")}   ${dim(`${runs} runs × ${households.length} households`)}\n`);
console.log(dim("model".padEnd(26) + "valid".padEnd(12) + "p50".padEnd(10) + "slowest".padEnd(10) + "errors"));

for (const r of results) {
  const rate = pct(r.valid, r.attempted);
  const p50 = `${median(r.latencies)}ms`;
  const max = r.latencies.length ? `${Math.max(...r.latencies)}ms` : "—";
  const colour = r.valid === r.attempted ? ok : bad;
  console.log(
    r.label.padEnd(26) +
      colour(`${r.valid}/${r.attempted} ${rate}`.padEnd(12)) +
      p50.padEnd(10) +
      max.padEnd(10) +
      (r.threw ? bad(`${r.threw} threw`) : "")
  );
}

for (const r of results) {
  if (!r.failures.size) continue;
  console.log(`\n${dim(`why ${r.label} failed`)}`);
  for (const [msg, n] of [...r.failures.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${bad(String(n).padStart(3))}  ${msg}`);
  }
}

console.log(
  `\n${dim("A model that is twice as fast and needs a repair half the time is not faster.")}`
);
