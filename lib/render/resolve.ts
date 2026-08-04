import type { Recipe } from "@/lib/types";
import type { Profile } from "@/lib/signals/types";
import type { LayoutSpec } from "@/lib/compose/compose";
import editorial from "@/lib/content/editorial.json";

/**
 * Where "the model never emits a fact" is enforced.
 *
 * The spec contains ids, enums and column headings. This turns them into props by
 * looking every value up in the content store. The model named the members and the
 * axes; the app supplies what is true about them.
 *
 * A block whose content does not exist returns null and is dropped with a note,
 * rather than rendering something half-populated.
 */

type Ed = typeof editorial;
const techniques = editorial.techniques as unknown as Record<string, Ed["techniques"]["weighted-sear"]>;

type Fork = {
  forkPoint: string;
  shared: string;
  branches: [{ label: string; title: string; body: string }, { label: string; title: string; body: string }];
};

export type Ingredient = { name: string; qty: string; section: string };

export type Resolved =
  | { ok: true; component: string; props: Record<string, unknown> }
  | { ok: false; component: string; reason: string };

const dateOf = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "");

const dedupe = (items: { name: string; qty: string }[]) => {
  const seen = new Map<string, { name: string; qty: string }>();
  for (const i of items) if (!seen.has(i.name)) seen.set(i.name, i);
  return [...seen.values()];
};
const dedupeStrings = (xs: string[]) => [...new Set(xs)];

export const resolveBlock = (
  block: LayoutSpec["blocks"][number],
  ctx: {
    recipes: Map<string, Recipe>;
    profile: Profile;
    householdSize: number;
    cookDates: Map<string, string[]>;
    ingredients: Map<string, Ingredient[]>;
    pantry: string[];
  }
): Resolved => {
  const pick = (ids: string[]) => ids.map((id) => ctx.recipes.get(id)).filter((r): r is Recipe => Boolean(r));
  const rs = pick(block.recipeIds);
  const fail = (reason: string): Resolved => ({ ok: false, component: block.component, reason });
  const ok = (props: Record<string, unknown>): Resolved => ({ ok: true, component: block.component, props });

  const tag = block.techniqueTag ?? rs[0]?.technique[0];
  const tech = tag ? techniques[tag] : undefined;

  switch (block.component) {
    case "TechniqueThread": {
      if (rs.length < 3) return fail("needs at least three attempts");
      if (!tech) return fail(`no editorial for technique "${tag}"`);
      const narrative = editorial.threadNarrative as Record<string, string>;
      const entries = rs.flatMap((r) => {
        const dates = ctx.cookDates.get(r.id) ?? [];
        return dates.map((d, i) => ({
          recipe: r,
          date: dateOf(d),
          changed:
            narrative[`${r.id}:${["first", "second", "third"][i] ?? "third"}`] ??
            narrative[r.id] ??
            ""
        }));
      })
        .filter((e) => e.changed)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      if (entries.length < 3) return fail("not enough narrated attempts");
      return ok({
        title: `${entries.length} attempts\nat one idea`,
        entries,
        untried: (editorial.untried as Record<string, string>)[tag!] ?? "",
        treatment: block.treatment
      });
    }

    case "WhyThisWorks": {
      if (rs.length < 3) return fail("needs three or more dishes");
      if (!tech) return fail(`no editorial for technique "${tag}"`);
      const ev = editorial.evidence as Record<string, string>;
      return ok({
        principle: tech.principle,
        body: tech.whyBody,
        recipes: rs,
        evidence: rs.map((r) => ev[r.id] ?? r.technique[0]),
        treatment: block.treatment
      });
    }

    case "SkillPrimer": {
      if (!tech) return fail(`no editorial for technique "${tag}"`);
      return ok({
        technique: tech.label,
        title: tech.primer.title,
        body: tech.primer.body,
        steps: tech.primer.steps,
        numeral: tech.primer.numeral,
        readingTime: tech.primer.readingTime,
        treatment: block.treatment
      });
    }

    case "TroubleshootingList": {
      if (!tech) return fail(`no editorial for technique "${tag}"`);
      return ok({ items: tech.troubleshooting, treatment: block.treatment });
    }

    case "TechniqueNote": {
      if (!tech) return fail(`no editorial for technique "${tag}"`);
      return ok({ technique: tech.label, body: tech.note, treatment: block.treatment });
    }

    case "RecipeCard": {
      if (!rs[0]) return fail("no recipe");
      return ok({ recipe: rs[0], treatment: block.treatment });
    }

    case "TonightShortlist": {
      if (rs.length < 2) return fail("needs two to four recipes");
      return ok({ recipes: rs.slice(0, 4), treatment: block.treatment });
    }

    case "MakeAheadCallout": {
      const r = rs.find((x) => x.makeAhead);
      if (!r) return fail("no recipe with a make-ahead step");
      return ok({ step: r.makeAhead, recipeTitle: r.title, treatment: block.treatment });
    }

    case "FromYourHistory": {
      const r = rs[0];
      if (!r) return fail("no recipe");
      const n = (ctx.cookDates.get(r.id) ?? []).length;
      if (n < 2) return fail("not a repeat");
      return ok({ text: `you have cooked this ${n} times since May`, recipe: r });
    }

    case "LeftoversNote": {
      const r = rs.find((x) => x.yield > ctx.householdSize);
      if (!r) return fail("nothing yields more than the household");
      return ok({ text: `serves ${r.yield}, which is ${r.yield - ctx.householdSize} more than tonight needs`, recipeTitle: r.title });
    }

    case "ComparisonTable": {
      if (rs.length < 3) return fail("needs three to five dishes");
      if (block.axes.length < 2) return fail("needs at least two axes");
      const value = (r: Recipe, axis: string): string => {
        const a = axis.toLowerCase();
        if (a.includes("active")) return `${r.activeTime} min`;
        if (a.includes("total") || a.includes("oven") || a.includes("time")) return `${Math.round(r.totalTime / 60)} hr`;
        if (a.includes("ahead")) return r.makeAhead ? "Yes" : "No";
        if (a.includes("dairy")) return r.allergens.includes("dairy") ? "Dairy" : "None";
        if (a.includes("serve") || a.includes("feed")) return String(r.yield);
        if (a.includes("ingredient")) return String(r.ingredientCount);
        if (a.includes("fork") || a.includes("split")) return r.forkPoint ?? "No";
        return "—";
      };
      return ok({
        title: "Compared for your kitchen",
        axes: block.axes,
        rows: rs.map((r) => ({ recipe: r, values: block.axes.map((a) => value(r, a)), emphasis: block.emphasis })),
        treatment: block.treatment
      });
    }

    case "ForkedRecipeCard": {
      const r = rs.find((x) => x.forkPoint);
      if (!r) return fail("no recipe with a fork point");
      const fork = (editorial.forks as unknown as Record<string, Fork>)[r.id];
      if (!fork) return fail(`no branches authored for ${r.id}`);
      return ok({
        recipe: { ...r, summary: fork.shared },
        forkPoint: fork.forkPoint,
        branches: fork.branches,
        treatment: block.treatment
      });
    }

    case "ShoppingList": {
      if (rs.length < 2) return fail("needs two or more planned recipes");
      const bySection = new Map<string, { name: string; qty: string }[]>();
      for (const r of rs) {
        for (const i of ctx.ingredients.get(r.id) ?? []) {
          bySection.set(i.section, [...(bySection.get(i.section) ?? []), { name: i.name, qty: i.qty }]);
        }
      }
      if (!bySection.size) return fail("no ingredients for those recipes");
      const order = ["Produce", "Butcher", "Fish", "Dairy", "Dry goods"];
      const sections = [...bySection.entries()]
        .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
        .map(([name, items]) => ({ name, items: dedupe(items) }));
      return ok({ sections, treatment: block.treatment });
    }

    case "PantryMatch": {
      const pool = rs.length ? rs : [...ctx.recipes.values()];
      const have = ctx.pantry.map((p) => p.toLowerCase());
      const missingFor = (r: Recipe) =>
        (ctx.ingredients.get(r.id) ?? [])
          .filter((i) => !have.some((h) => i.name.toLowerCase().includes(h) || h.includes(i.name.toLowerCase())))
          .map((i) => i.name);
      const matches = pool
        .map((r) => ({ recipe: r, missing: missingFor(r) }))
        .sort((a, b) => a.missing.length - b.missing.length)
        .slice(0, 4);
      if (!matches.length) return fail("nothing to match");
      return ok({
        have: ctx.pantry,
        missing: dedupeStrings(matches.flatMap((m) => m.missing)).slice(0, 6),
        matches,
        treatment: block.treatment
      });
    }

    case "SubstitutionTable": {
      const r = rs[0];
      if (!r) return fail("no recipe");
      const have = ctx.pantry.map((p) => p.toLowerCase());
      const gaps = (ctx.ingredients.get(r.id) ?? []).filter(
        (i) => !have.some((h) => i.name.toLowerCase().includes(h) || h.includes(i.name.toLowerCase()))
      );
      if (!gaps.length) return fail("no gaps against this pantry");
      const subs = editorial.substitutions as unknown as Record<string, string>;
      const rows = gaps
        .filter((g) => subs[g.name])
        .map((g) => ({ wants: g.name, have: ctx.pantry[0] ?? "—", note: subs[g.name] }));
      if (!rows.length) return fail("no substitutions authored for those gaps");
      return ok({ rows, treatment: block.treatment });
    }

    case "PrepSchedule": {
      const aheads = rs.filter((r) => r.makeAhead);
      if (aheads.length < 2) return fail("needs two or more recipes with a make-ahead step");
      const shared = aheads[0];
      const days = [
        {
          day: "Sunday",
          tasks: aheads.map((r, i) => ({
            text: r.makeAhead!,
            recipeTitle: r.title,
            sharedBase: i === 0
          }))
        },
        ...aheads.slice(1).map((r, i) => ({
          day: ["Tuesday", "Wednesday", "Thursday"][i] ?? "Later",
          tasks: [{ text: `Finish ${r.title.toLowerCase()}.`, recipeTitle: r.title, sharedBase: false }]
        }))
      ];
      return ok({ title: `${shared.title}\nfeeds the week`, days, treatment: block.treatment });
    }

    case "StoryIntro":
      return fail("no editorial authored");

    case "SeasonalNote":
      return fail("no editorial authored");

    default:
      return fail("no resolver");
  }
};
