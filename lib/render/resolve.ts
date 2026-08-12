import type { Recipe } from "@/lib/types";
import type { Occasion, Profile } from "@/lib/signals/types";
import type { Axis, LayoutSpec } from "@/lib/compose/compose";
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

type Branch = { label: string; title: string; body: string; steps?: string[] };
type Fork = {
  forkPoint: string;
  shared: string;
  branches: [Branch, Branch];
};

export type Ingredient = {
  name: string;
  qty: string;
  section: string;
  /** Comes out of a tap. A real part of the recipe and not a thing you buy, so the
   *  shopping list leaves it out — see the filter in the ShoppingList case. */
  tap?: boolean;
};

export type Resolved =
  /** `recipeIds` is what the block ACTUALLY renders, which is not always what the
   *  spec named: menu-wide blocks resolve against the occasion menu, and most
   *  blocks show a subset of what they were handed. Obligations attach to dishes on
   *  the page, so they have to be placed against this rather than against the spec —
   *  a dish that reached the page through the menu was getting no allergen notice
   *  at all. */
  | { ok: true; component: string; props: Record<string, unknown>; recipeIds: string[] }
  | { ok: false; component: string; reason: string };

const dateOf = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "");

const dedupe = (items: { name: string; qty: string }[]) => {
  const seen = new Map<string, { name: string; qty: string }>();
  for (const i of items) if (!seen.has(i.name)) seen.set(i.name, i);
  return [...seen.values()];
};
const dedupeStrings = (xs: string[]) => [...new Set(xs)];

/**
 * How each column heading is computed. Keyed by the AXES enum, so the map is
 * EXHAUSTIVE by construction — a heading added to the vocabulary without a way to
 * fill it fails to typecheck.
 *
 * The previous version matched substrings against a free-text heading and returned
 * an em-dash when nothing matched. The model asked for "Protein", nothing matched,
 * and two thirds of Twin B's table rendered as dashes. A fallback that produces a
 * plausible-looking empty cell is worse than one that will not compile.
 */
const AXIS_VALUE: Record<Axis, (r: Recipe) => string> = {
  "Active time": (r) => `${r.activeTime} min`,
  "Total time": (r) => (r.totalTime >= 90 ? `${Math.round(r.totalTime / 60)} hr` : `${r.totalTime} min`),
  Technique: (r) => r.technique.join(", "),
  "Make-ahead": (r) => (r.makeAhead ? "Yes" : "No"),
  Dairy: (r) => (r.allergens.includes("dairy") ? "Dairy" : "None"),
  Serves: (r) => String(r.yield),
  Ingredients: (r) => String(r.ingredientCount),
  "Where it splits": (r) => r.forkPoint ?? "Does not split"
};

export const resolveBlock = (
  block: LayoutSpec["blocks"][number],
  ctx: {
    recipes: Map<string, Recipe>;
    profile: Profile;
    householdSize: number;
    cookDates: Map<string, string[]>;
    ingredients: Map<string, Ingredient[]>;
    pantry: string[];
    /** The fast layer, when one is in force. Absent for most requests. */
    occasion?: { occasion: Occasion; daysUntil: number } | null;
  }
): Resolved => {
  const pick = (ids: string[]) => ids.map((id) => ctx.recipes.get(id)).filter((r): r is Recipe => Boolean(r));

  /**
   * THE MENU IS A DECISION, NOT A RE-ROLL.
   *
   * A menu chosen fourteen days out is a fact by day three — but the composer picks
   * recipe ids fresh on every call, so the hero photograph changed between moments
   * and the page appeared to say the dinner had changed. It had not. It looked like
   * the system was guessing rather than remembering, which is the opposite of the
   * argument.
   *
   * So while an occasion carries a menu, that menu is what the MENU-WIDE blocks
   * resolve against. The model still chooses WHICH blocks and what the page is
   * about; it no longer gets to re-decide a question that was answered a fortnight
   * ago.
   *
   * Menu-wide is the whole scope, and the scope matters. These three blocks are
   * about the occasion as a set — the plan, the shop for it, the run-up to it — so
   * "all four dishes" is the right answer regardless of which ids the model typed.
   * Every other block is about A DISH, and topping those up from the menu meant a
   * RecipeCard composed for one recipe silently rendered a different one: the page
   * showed pork belly while the validator, the rail and the obligations were all
   * still reasoning about chicken. A block that is about a dish keeps the dish it
   * was given; on-menu picks simply sort first, so an occasion page leads with what
   * is actually being served.
   */
  const MENU_WIDE = new Set(["OccasionPlan", "ShoppingList", "PrepSchedule"]);
  const menu = ctx.occasion?.occasion.menu ?? [];
  const chosen = block.recipeIds;
  const rs = (() => {
    if (!menu.length) return pick(chosen);
    const onMenu = chosen.filter((id) => menu.includes(id));
    if (!MENU_WIDE.has(block.component)) {
      return pick([...onMenu, ...chosen.filter((id) => !menu.includes(id))]);
    }
    /* Keep the model's picks that are on the menu — it still decides which dish this
       block leads with — and top up from the menu when it asked for something that
       is not being served. */
    const rest = menu.filter((id) => !onMenu.includes(id));
    return pick([...onMenu, ...rest]);
  })();
  const fail = (reason: string): Resolved => ({ ok: false, component: block.component, reason });
  /* `shown` is the dishes this block puts in front of a reader — passed explicitly
     by every case that renders a subset of `rs`, because "which dishes are on the
     page" is the question obligations are placed against. */
  const ok = (props: Record<string, unknown>, shown: Recipe[] = rs): Resolved => ({
    ok: true,
    component: block.component,
    props,
    recipeIds: [...new Set(shown.map((r) => r.id))]
  });

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
      }, entries.map((e) => e.recipe));
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
      }, []);
    }

    case "TroubleshootingList": {
      if (!tech) return fail(`no editorial for technique "${tag}"`);
      return ok({ items: tech.troubleshooting, treatment: block.treatment }, []);
    }

    case "TechniqueNote": {
      if (!tech) return fail(`no editorial for technique "${tag}"`);
      return ok({ technique: tech.label, body: tech.note, treatment: block.treatment }, []);
    }

    case "RecipeCard": {
      if (!rs[0]) return fail("no recipe");
      return ok({ recipe: rs[0], treatment: block.treatment }, [rs[0]]);
    }

    case "TonightShortlist": {
      if (rs.length < 2) return fail("needs two to four recipes");
      return ok({ recipes: rs.slice(0, 4), treatment: block.treatment }, rs.slice(0, 4));
    }

    case "MakeAheadCallout": {
      const r = rs.find((x) => x.makeAhead);
      if (!r) return fail("no recipe with a make-ahead step");
      return ok({ step: r.makeAhead, recipeTitle: r.title, treatment: block.treatment }, [r]);
    }

    case "FromYourHistory": {
      const r = rs[0];
      if (!r) return fail("no recipe");
      const n = (ctx.cookDates.get(r.id) ?? []).length;
      if (n < 2) return fail("not a repeat");
      return ok({ text: `you have cooked this ${n} times since May`, recipe: r }, [r]);
    }

    case "LeftoversNote": {
      const r = rs.find((x) => x.yield > ctx.householdSize);
      if (!r) return fail("nothing yields more than the household");
      return ok({ text: `serves ${r.yield}, which is ${r.yield - ctx.householdSize} more than tonight needs`, recipeTitle: r.title }, [r]);
    }

    case "ComparisonTable": {
      if (rs.length < 3) return fail("needs three to five dishes");
      if (block.axes.length < 2) return fail("needs at least two axes");
      const value = (r: Recipe, axis: Axis): string => AXIS_VALUE[axis](r);
      return ok({
        title: "Compared side by side",
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
      /* The steps BEFORE the split, so the card can show the dish being one dish
         before it becomes two. The block claimed "splits at step 4 of 6" while
         showing no steps at all, which left a fork with nothing visible to fork —
         three paragraphs where a method should be. "Step 4 of 6" means four is the
         first divergent step, so one through three are shared. */
      const forkStep = Number(/step (\d+)/i.exec(fork.forkPoint)?.[1] ?? 0);
      const all = r.steps ?? [];
      /* A fork is three parts, not two. The head is shared, each branch owns the
         same number of steps from the fork onward, and whatever is left is shared
         again — 031 diverges for exactly one step and then rejoins, which the card
         could not say at all while the branches were loose prose. Numbering only
         lines up if both branches are the same length; asserted where they are
         authored. */
      const branchLength = fork.branches[0].steps?.length ?? 0;
      return ok({
        /* `recipe` unmodified. It used to go out as `{ ...r, summary: fork.shared }`,
           which threw away the dish's own headnote — "Cabbage has enough sugar to
           behave like an onion if you let it" — and replaced it with a paragraph
           restating steps one to three. Once the method is on the card that
           paragraph was saying everything twice AND costing the card the one line
           that said what the dish was. */
        recipe: r,
        forkPoint: fork.forkPoint,
        /* The claim about the split, which belongs on the rule rather than at the
           top of the card. */
        sharedNote: fork.shared,
        forkStep,
        sharedSteps: forkStep > 1 ? all.slice(0, forkStep - 1) : [],
        tailSteps: branchLength ? all.slice(forkStep - 1 + branchLength) : [],
        branches: fork.branches,
        treatment: block.treatment
      }, [r]);
    }

    case "ShoppingList": {
      if (rs.length < 2) return fail("needs two or more planned recipes");
      const bySection = new Map<string, { name: string; qty: string }[]>();
      for (const r of rs) {
        for (const i of ctx.ingredients.get(r.id) ?? []) {
          /* Tap ingredients are not shopping. "Water — 400 ml" is a true line about
             the focaccia and a daft line on a list you take to a shop, and the room
             notices: nobody blames the model for it, because the model did not build
             this list, but somebody does ask about it. Filtered HERE rather than
             dropped from the fixture, so the recipe keeps its real ingredients — and
             filtered here only, because `state.pantryGaps` gates SubstitutionTable and
             quietly changing what counts as a gap changes what is eligible. */
          if (i.tap) continue;
          bySection.set(i.section, [...(bySection.get(i.section) ?? []), { name: i.name, qty: i.qty }]);
        }
      }
      if (!bySection.size) return fail("no ingredients for those recipes");
      /* THE ORDER YOU WALK A SHOP, and the reason the list is grouped at all.
         `Dry goods` was split into `Store cupboard` and `Spice rack` on 11 Aug — it
         was a catch-all holding forty of the corpus's sixty-eight ingredients, so
         every list came out as one enormous section beside two of one item, and no
         column arrangement could make that look like anything but a hole. */
      const order = ["Produce", "Butcher", "Fish", "Dairy", "Store cupboard", "Spice rack"];
      /* Unlisted sections sort LAST, not first. `indexOf` returns -1 for anything it
         does not know, which put a new section ahead of Produce — so adding one to
         the fixtures silently reordered the walk, and the failure looked like a data
         problem rather than a sorting one. */
      const rank = (name: string) => (order.indexOf(name) + 1 || order.length + 1);
      const sections = [...bySection.entries()]
        .sort((a, b) => rank(a[0]) - rank(b[0]))
        .map(([name, items]) => ({ name, items: dedupe(items) }));
      const occ = ctx.occasion;
      return ok({
        sections,
        standfirst: occ
          ? `Everything for ${occ.occasion.label.toLowerCase()}, ${occ.daysUntil === 0 ? "today" : occ.daysUntil === 1 ? "tomorrow" : `in ${occ.daysUntil} days`}. Walk the shop in this order.`
          : undefined,
        treatment: block.treatment
      });
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
      }, matches.map((m) => m.recipe));
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
      return ok({ rows, treatment: block.treatment }, [r]);
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
      const po = ctx.occasion;
      /* The days are named from the occasion date when there is one, and only the
         TITLE used to be. "Ahead of dinner, eight people" over Sunday/Tuesday/
         Wednesday told a cook two days out from a Saturday party to get ahead on a
         Sunday that falls after it. The last day of an occasion run-up is the
         occasion itself; earlier days count back from it, clamped at today, and
         days that collide once clamped merge rather than repeat a weekday. */
      const scheduled = po
        ? (() => {
            const target = new Date(`${po.occasion.date}T12:00:00`);
            const merged: typeof days = [];
            days.forEach((d, i) => {
              const back = Math.min(days.length - 1 - i, Math.max(0, po.daysUntil));
              const on = new Date(target);
              on.setDate(on.getDate() - back);
              const day = on.toLocaleDateString("en-GB", { weekday: "long" });
              const last = merged[merged.length - 1];
              if (last?.day === day) last.tasks = [...last.tasks, ...d.tasks];
              else merged.push({ ...d, day });
            });
            return merged;
          })()
        : days;
      return ok({
        title: po ? `Ahead of\n${po.occasion.label.toLowerCase()}` : `${shared.title}\nfeeds the week`,
        days: scheduled,
        /* The shared base is `aheads[0]` — the same dish the title names and the
           only day carrying an acid rule. Any other image would contradict the
           block. */
        image: shared.image ? { ...shared.image, tag: `Fig. ${shared.id}` } : undefined,
        treatment: block.treatment
      }, aheads);
    }

    /**
     * The occasion, sequenced backwards from the date.
     *
     * Every value here comes from the content store or from arithmetic on the
     * occasion. The model chose WHICH dishes; it did not write a task, a day, a
     * quantity or the guest count. Same rule as everywhere else — it cannot say
     * anything false about a dish because it is not the thing saying it.
     */
    case "OccasionPlan": {
      const occ = ctx.occasion;
      if (!occ) return fail("no occasion in force");
      if (rs.length < 2) return fail("needs at least two dishes to sequence");

      const { occasion, daysUntil } = occ;
      const aheads = rs.filter((r) => r.makeAhead);
      const sameDay = rs.filter((r) => !r.makeAhead);

      /* Stages are derived from how much time is actually left, which is why the
         three moments in the demo are one component and not three. At fourteen days
         out there is a shopping stage; on the morning there is not, because there is
         no morning on which "order the pork" is useful advice. */
      const stages: { when: string; tasks: { text: string; recipeTitle?: string; ahead?: boolean }[] }[] = [];

      if (daysUntil >= 7) {
        stages.push({
          when: "This week",
          tasks: [
            {
              text: `Decide the menu and shop for anything that keeps. ${rs.length} dishes, ${occasion.guests} people.`,
              ahead: true
            }
          ]
        });
      }

      if (aheads.length && daysUntil >= 1) {
        stages.push({
          when: daysUntil >= 4 ? "Up to three days before" : "The day before",
          tasks: aheads.map((r) => ({ text: r.makeAhead!, recipeTitle: r.title, ahead: true }))
        });
      }

      stages.push({
        when: daysUntil === 0 ? "This morning" : "On the day",
        tasks: [
          ...sameDay.map((r) => ({
            text: r.steps?.[0] ? `${r.steps[0]}` : `Make ${r.title.toLowerCase()}.`,
            recipeTitle: r.title
          })),
          ...(aheads.length
            ? [{ text: `Bring everything back to room temperature and finish.`, ahead: false }]
            : [])
        ]
      });

      /* Scaling is a statement, not a control. The stepper in this system exists for
         the case where the site does not know how many people are eating — here it
         does, because somebody put it in a form. */
      /* Per dish, because dishes are not written for the same number. One factor
         off the largest yield read "×1 on every quantity" for a menu containing a
         cabbage written for four — a cook following that page makes half of it. */
      const scaledTo =
        occasion.guests > ctx.householdSize
          ? {
              servings: occasion.guests,
              dishes: rs.map((r) => ({
                title: r.title,
                from: r.yield,
                factor: (occasion.guests / r.yield).toFixed(2).replace(/\.?0+$/, "")
              }))
            }
          : undefined;

      const lead = rs.find((r) => r.image) ?? rs[0];
      return ok({
        title: occasion.label,
        standfirst:
          daysUntil === 0
            ? `${occasion.guests} people, today.`
            : `${occasion.guests} people, ${daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`}.`,
        stages,
        scaledTo,
        guestNote: occasion.avoidNote,
        image: lead?.image ? { ...lead.image, tag: `Fig. ${lead.id}` } : undefined,
        treatment: block.treatment
      });
    }

    /* StoryIntro was here. Cut from the manifest on 5 Aug: no editorial was ever
       authored so it could never render, and with `requires: []` it was offered to
       every household — the most tempting block on the menu and the only one that
       always failed. Three local model families led Twin A's page with it, three
       times each. The component and its /kit specimen remain; it is out of the
       vocabulary, not out of the design system. */
    case "SeasonalNote": {
      const month = new Date().toISOString().slice(5, 7);
      const text = (editorial.seasonal as unknown as Record<string, string>)[month];
      if (!text) return fail(`no seasonal line for month ${month}`);
      return ok({ text }, []);
    }

    default:
      return fail("no resolver");
  }
};
