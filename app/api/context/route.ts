import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { householdContext } from "@/lib/compose/compose";
import { computeFacts, eligible, test } from "@/lib/compose/gates";
import { loadManifest } from "@/lib/manifest/load";
import { getProfile } from "@/lib/signals/profile";
import { activeOccasion, effectiveToday } from "@/lib/occasion";
import type { Ingredient } from "@/lib/render/resolve";
import type { CookEvent, Household, Occasion } from "@/lib/signals/types";
import type { Recipe } from "@/lib/types";

/**
 * What each household's data looks like, for the stage view.
 *
 * The demo showed the manifest — the cause every page shares — and never showed
 * the cause that differs. Three pages made by one vocabulary out of three people,
 * with the people off screen, is an argument with a term missing; the room has to
 * take on trust that the input differed at all.
 *
 * The response is deliberately in two halves, because the person's data is used
 * twice, in two places, for two different jobs:
 *
 *   gates  — evaluated in CODE, never sent to the model. These decide which
 *            components the model is allowed to use at all (`vocabulary 9/15`).
 *   sent   — the six lines the model actually receives. These decide how the
 *            allowed components are arranged.
 *
 * That split is the interesting half. A personalization engine has one of these;
 * this has both, and the model is on the wrong side of the more powerful one.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const read = async <T,>(p: string): Promise<T> =>
  JSON.parse(await readFile(path.join(process.cwd(), p), "utf8")) as T;

/** `user.techniqueRepeats` → `technique repeats`. Matches the humanising the
 *  blocks list already does, so a condition there and a value here read as the
 *  same vocabulary rather than two spellings of it. */
const humanize = (fact: string) =>
  fact
    .replace(/^[a-z]+\./, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();

const OPS: Record<string, string> = { ">=": "≥", "<=": "≤", ">": ">", "<": "<" };

export const GET = async () => {
  const manifest = await loadManifest();
  const recipes = await read<Recipe[]>("lib/content/recipes.json");
  const { households } = await read<{ households: Household[] }>("lib/content/households.json");
  const ingredientsRaw = await read<Record<string, Ingredient[]>>("lib/content/ingredients.json");
  const ingredients = new Map(Object.entries(ingredientsRaw).filter(([k]) => k !== "_"));
  const { occasions } = await read<{ occasions: Occasion[] }>("lib/content/occasions.json");
  const now = { timeOfDay: "evening" as const };

  const out = await Promise.all(
    households.map(async (household) => {
      const events = await read<CookEvent[]>(`lib/signals/logs/${household.id}.json`);
      const { profile } = await getProfile(household, events, recipes);
      /* WITH the occasion, or the panel contradicts the page beside it. The stage
         view exists to show the gating the page used; computing facts without the
         fast layer had it reporting that ShoppingList was not permitted on the very
         page that was leading with it. */
      const occasion = activeOccasion(occasions, household.id, effectiveToday());
      const facts = computeFacts(recipes, profile, household, now, ingredients, events, occasion);
      const allowed = eligible(manifest, facts);

      /* Only `user.*`. `content.*` describes the recipe library and is identical for
         everyone; `state.*` is the session. Neither is data about this person, and
         putting them here would pad the panel with rows that never differ between
         the three columns — which is the one thing the panel exists to show. */
      const userFacts = Object.keys(facts)
        .filter((k) => k.startsWith("user."))
        .sort();

      const gates = userFacts.map((fact) => {
        const actual = facts[fact];
        /* The thresholds declared against this fact anywhere in the manifest. With
           exactly one, the row can show the test and whether it passed; with
           several, the value alone is honest and the blocks list carries the
           conditions in full. */
        const predicates = manifest.components
          .flatMap((c) => c.requires)
          .filter((p) => p.fact === fact);
        const distinct = [...new Map(predicates.map((p) => [`${p.op}${p.value}`, p])).values()];
        const only = distinct.length === 1 ? distinct[0] : null;

        return {
          label: humanize(fact),
          value: typeof actual === "boolean" ? (actual ? "yes" : "no") : String(actual),
          test: only && only.op !== "==" ? `${OPS[only.op] ?? only.op} ${String(only.value)}` : null,
          /* No test shown, no verdict shown. For a boolean gate the value is
             already the whole answer, and a tick with nothing to tick against
             reads as decoration. */
          pass: only && only.op !== "==" ? test(only, facts) : null
        };
      });

      return {
        id: household.id,
        label: household.label,
        /* Rendered rather than raw so the three columns line up and the twins'
           identical blocks are comparable by eye, line for line. */
        declared: Object.entries(household.declared).map(([k, v]) => ({
          key: humanize(k),
          value: Array.isArray(v) ? (v.join(", ") || "none") : String(v)
        })),
        gates,
        vocabulary: { allowed: allowed.length, total: manifest.components.length },
        /* Verbatim. Same function the prompt calls. */
        sent: householdContext(profile, household)
      };
    })
  );

  return NextResponse.json({ households: out }, { headers: { "cache-control": "no-store" } });
};
