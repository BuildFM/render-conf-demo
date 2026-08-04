/**
 * Ninety days of behaviour for three households.
 *
 * Read the RULES below, not the generated rows. The rows are 600-odd events; the
 * rules are twenty lines and they are the thing to check. Each household's rule
 * set encodes one pattern worth acting on, buried in enough ordinary browsing
 * that finding it is a judgment rather than a count — which is the whole reason
 * the profile pass needs a model and not a SQL query.
 *
 * Deterministic: seeded PRNG, fixed window, no Date.now(). Re-running produces
 * byte-identical output, so the demo is reproducible across recording takes.
 *
 *   node scripts/generate-logs.mjs
 */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECIPES = JSON.parse(readFileSync(path.join(ROOT, "lib/content/recipes.json"), "utf8"));
const OUT = path.join(ROOT, "lib/signals/logs");

const START = new Date("2026-05-06T00:00:00Z"); // 90 days back from 2026-08-04
const DAYS = 90;

const byId = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
const all = RECIPES.map((r) => r.id);
const dairy = RECIPES.filter((r) => r.allergens.includes("dairy")).map((r) => r.id);
const forked = RECIPES.filter((r) => r.forkPoint).map((r) => r.id);

/* ---------------------------------------------------------------- prng ---- */

const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const make = (seed) => {
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return {
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p
  };
};

const stamp = (day, hour, minute) => {
  const d = new Date(START);
  d.setUTCDate(d.getUTCDate() + day);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
};

/* --------------------------------------------------------------- rules ---- */

/**
 * THE LEARNER — cooks alone, twice a week, and keeps returning to one technique.
 *
 * The pattern to find: every dish they have gone back to is weighted-sear wearing
 * different ingredients, and they have never once started the pan cold. The
 * variable they have not tried is the inference; it is not in the data as a fact.
 *
 * The noise: they browse three or four other things a session and cook none of
 * them, so "opened" counts alone point at the wrong dishes.
 */
const learner = () => {
  const rng = make(11);
  const events = [];
  const arc = [
    { day: 6, id: "041", outcome: "abandoned", atStep: 3 },
    { day: 20, id: "041", outcome: "completed" },
    { day: 34, id: "032", outcome: "completed" },
    { day: 51, id: "033", outcome: "completed" },
    { day: 69, id: "034", outcome: "completed" },
    { day: 83, id: "041", outcome: "completed", returned: true }
  ];
  const arcDays = new Set(arc.map((a) => a.day));

  for (let day = 0; day < DAYS; day++) {
    const dow = (START.getUTCDay() + day) % 7;
    const cooksToday = dow === 2 || dow === 6; // Tuesday, Saturday
    if (!cooksToday && !arcDays.has(day)) continue;

    const hour = dow === 6 ? 11 : 18;
    const step = arc.find((a) => a.day === day);

    // Browsing: things they look at and do not cook.
    const browse = new Set();
    for (let i = 0; i < rng.int(2, 4); i++) browse.add(rng.pick(all));
    if (step) browse.delete(step.id);
    let m = 0;
    for (const id of browse) {
      events.push({ type: "opened", recipeId: id, at: stamp(day, hour, (m += 3)) });
      events.push({ type: "skipped", recipeId: id, at: stamp(day, hour, (m += 2)) });
    }

    if (!step) continue;

    events.push({
      type: step.returned ? "returned" : "opened",
      recipeId: step.id,
      at: stamp(day, hour, (m += 4))
    });
    // They read the why before they cook. Every time, without exception.
    events.push({
      type: "expanded",
      recipeId: step.id,
      component: rng.chance(0.5) ? "TechniqueNote" : "WhyThisWorks",
      at: stamp(day, hour, (m += 2))
    });
    events.push({
      type: step.outcome,
      recipeId: step.id,
      ...(step.atStep ? { atStep: step.atStep } : {}),
      at: stamp(day, hour, (m += 25))
    });
  }
  return events;
};

/**
 * TWIN A — six people, cooks most nights, decides by comparing.
 *
 * The pattern to find: they do not avoid dairy. They avoid dishes where the dairy
 * cannot be separated. Cacio e pepe and anchovy butter get opened and dropped;
 * charred cabbage — same allergen, but it forks — gets cooked repeatedly. A rule
 * keyed on "dairy-free" gets this exactly backwards.
 *
 * The noise: three or four opens before every cook, so their most-opened dish and
 * their most-cooked dish are not the same dish.
 */
const twinA = () => {
  const rng = make(23);
  const events = [];
  const unforkedDairy = dairy.filter((id) => !byId[id].forkPoint);

  for (let day = 0; day < DAYS; day++) {
    const dow = (START.getUTCDay() + day) % 7;
    if (dow === 0 || rng.chance(0.15)) continue; // most nights, not all
    const hour = 17;
    let m = 0;

    // Compare two or three candidates before committing.
    const candidates = new Set();
    while (candidates.size < rng.int(2, 3)) candidates.add(rng.pick(all));
    for (const id of candidates) {
      events.push({ type: "opened", recipeId: id, at: stamp(day, hour, (m += 4)) });
    }

    // Anything with unseparable dairy is dropped almost immediately.
    for (const id of candidates) {
      if (unforkedDairy.includes(id)) {
        events.push({ type: "abandoned", recipeId: id, atStep: 1, at: stamp(day, hour, (m += 2)) });
        candidates.delete(id);
      }
    }
    if (candidates.size === 0) continue;

    // They cook the forked one when there is one.
    const forkedChoice = [...candidates].find((id) => forked.includes(id));
    const choice = forkedChoice ?? rng.pick([...candidates]);
    for (const id of candidates) {
      if (id !== choice) events.push({ type: "skipped", recipeId: id, at: stamp(day, hour, (m += 1)) });
    }
    events.push({ type: "completed", recipeId: choice, at: stamp(day, hour, (m += 30)) });
  }
  return events;
};

/**
 * TWIN B — six people, identical declared profile to Twin A, entirely different week.
 *
 * The pattern to find: they run a weekly loop. Sunday is a production session and
 * the weekdays are assembly, so everything they keep has a step that can be done
 * on Sunday. They also quit anything long: seven ingredients is the wall, and they
 * quit at step zero, which means it is the list they are reacting to, not the cook.
 *
 * The tell that this is not Twin A: same size, same time budget, same stated skill,
 * same dietary constraint. Nothing declared separates them.
 */
const twinB = () => {
  const rng = make(37);
  const events = [];
  const ABANDON_AT = 7; // ingredients
  const staples = ["038", "036", "035", "032"]; // all ≤ 6 ingredients, all make-ahead-able
  const longOnes = all.filter((id) => byId[id].ingredientCount >= ABANDON_AT);

  for (let day = 0; day < DAYS; day++) {
    const dow = (START.getUTCDay() + day) % 7;
    let m = 0;

    if (dow === 0) {
      // Sunday: the production session.
      const hour = 10;
      for (const id of staples.slice(0, rng.int(2, 3))) {
        events.push({ type: "returned", recipeId: id, at: stamp(day, hour, (m += 5)) });
        events.push({ type: "completed", recipeId: id, at: stamp(day, hour, (m += 40)) });
      }
      // One ambitious look, abandoned on sight of the list.
      if (rng.chance(0.6)) {
        const id = rng.pick(longOnes);
        events.push({ type: "opened", recipeId: id, at: stamp(day, hour, (m += 6)) });
        events.push({ type: "abandoned", recipeId: id, atStep: 0, at: stamp(day, hour, (m += 1)) });
      }
      continue;
    }

    if (dow === 2 || dow === 4 || dow === 6) {
      // Weeknight: assembly from what Sunday produced.
      const hour = 18;
      const id = rng.pick(staples);
      events.push({ type: "returned", recipeId: id, at: stamp(day, hour, (m += 2)) });
      events.push({ type: "completed", recipeId: id, at: stamp(day, hour, (m += 15)) });
      if (rng.chance(0.35)) {
        const other = rng.pick(longOnes);
        events.push({ type: "opened", recipeId: other, at: stamp(day, hour, (m += 3)) });
        events.push({ type: "abandoned", recipeId: other, atStep: 0, at: stamp(day, hour, (m += 1)) });
      }
    }
  }
  return events;
};

/* ---------------------------------------------------------------- write ---- */

mkdirSync(OUT, { recursive: true });

const sets = [
  ["h-learner", learner()],
  ["h-twin-a", twinA()],
  ["h-twin-b", twinB()]
];

for (const [id, events] of sets) {
  events.sort((a, b) => a.at.localeCompare(b.at));
  writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(events, null, 2) + "\n");
  const kinds = events.reduce((acc, e) => ({ ...acc, [e.type]: (acc[e.type] ?? 0) + 1 }), {});
  console.log(`${id.padEnd(12)} ${String(events.length).padStart(4)} events  ${JSON.stringify(kinds)}`);
}
