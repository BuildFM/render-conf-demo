/**
 * Content consistency. Cheap to run, and it catches the class of error that would
 * otherwise show up as a block silently never appearing.
 *
 *   node scripts/check-content.mjs
 */

import { readFileSync } from "node:fs";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const recipes = read("lib/content/recipes.json");
const ingredients = read("lib/content/ingredients.json");
const editorial = read("lib/content/editorial.json");

const problems = [];
const note = (m) => problems.push(m);

for (const r of recipes) {
  const list = ingredients[r.id];
  if (!list) {
    note(`${r.id} ${r.title}: no ingredients`);
    continue;
  }
  if (list.length !== r.ingredientCount) {
    note(`${r.id} ${r.title}: ingredientCount says ${r.ingredientCount}, list has ${list.length}`);
  }
  // A dish declaring dairy must actually contain something from the dairy section,
  // and vice versa — the obligation fires on `allergens`, so a mismatch is the
  // quietest possible way to get a safety claim wrong.
  const hasDairyIngredient = list.some((i) => i.section === "Dairy");
  if (r.allergens.includes("dairy") !== hasDairyIngredient) {
    note(`${r.id} ${r.title}: allergens ${JSON.stringify(r.allergens)} disagrees with the ingredient list`);
  }
  const hasFish = list.some((i) => i.section === "Fish");
  if (r.allergens.includes("fish") !== hasFish) {
    note(`${r.id} ${r.title}: fish allergen disagrees with the ingredient list`);
  }
  if (r.forkPoint && !editorial.forks[r.id]) {
    note(`${r.id} ${r.title}: has a forkPoint but no authored branches`);
  }
}

for (const id of Object.keys(editorial.forks).filter((k) => k !== "_")) {
  if (!recipes.some((r) => r.id === id)) note(`forks: ${id} is not a recipe`);
}

const tags = new Set(recipes.flatMap((r) => r.technique));
for (const t of tags) {
  if (!editorial.techniques[t]) note(`technique "${t}" has no editorial — blocks keyed to it will never resolve`);
}

if (problems.length) {
  console.error(`${problems.length} problem(s):`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(`ok — ${recipes.length} recipes, ${Object.keys(editorial.forks).length - 1} forks, ${tags.size} technique tags`);
