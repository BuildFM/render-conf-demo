/**
 * Put the manifest back to its pre-beat state, so the next take can start clean.
 *
 * Live, the manifest edit happens once. Recorded, it happens nine times, and the
 * reset between takes cannot be a hand edit — one stray character and the take you
 * eventually keep was shot against a file that differs from the committed one.
 *
 *   node scripts/stage-reset.mjs            → before: no obligation declared
 *   node scripts/stage-reset.mjs --after    → after:  AllergenNotice declared
 *   node scripts/stage-reset.mjs --status   → which state the file is in now
 *
 * Only the `obligations` section moves. Everything else in the manifest is left
 * byte-identical, which is also why the fixtures hold one section rather than two
 * whole files — a full copy would go stale the next time a component changes.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(root, "lib/manifest/manifest.json");
const fixture = (which) => path.join(root, `lib/manifest/fixtures/obligations.${which}.txt`);

/* Duplicated from lib/manifest/slice.ts rather than imported: this script has to
   run under plain node with no loader, because it runs between takes when nothing
   else is allowed to go wrong. Fifteen lines is a fair price. */
const spliceObligations = (raw, replacement) => {
  const key = '"obligations":';
  const start = raw.indexOf(key);
  if (start < 0) throw new Error("no obligations section in the manifest");

  let i = raw.indexOf("[", start);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return raw.slice(0, start) + replacement.trimEnd() + raw.slice(i + 1);
};

const args = process.argv.slice(2);
const raw = readFileSync(MANIFEST, "utf8");

if (args.includes("--status")) {
  const declared = /"name":\s*"AllergenNotice"/.test(raw);
  console.log(declared ? "after  — AllergenNotice is declared" : "before — no obligation declared");
  process.exit(0);
}

const which = args.includes("--after") ? "after" : "before";
const next = spliceObligations(raw, readFileSync(fixture(which), "utf8"));
writeFileSync(MANIFEST, next, "utf8");

console.log(`manifest → ${which}`);

/* The compose cache is keyed on the manifest hash, so take 1 composes for real and
   every take after it is served from the Map — the beat would show "cache hit"
   where the room needs to see four seconds of a model working. */
if (process.env.MISE_NO_CACHE !== "1") {
  console.log(
    "\n\x1b[33mrecording?\x1b[0m start the dev server with MISE_NO_CACHE=1 — resetting the\n" +
      "manifest returns it to a hash that is already cached, and the beat will show\n" +
      '"cache hit" instead of a real composition from take 2 onward.'
  );
}
if (which === "before") {
  console.log("\nthe six lines to type, in order:\n");
  console.log(readFileSync(fixture("after"), "utf8").split("\n").slice(1, -2).join("\n"));
}
