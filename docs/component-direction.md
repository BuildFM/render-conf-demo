# Mise — composition blocks

Direction for Claude Design. Hand this over alongside the existing
`design_handoff_mise_home` kit.

---

## What this is

The Mise home page you already built is **one** composition. The demo generates
different ones per household from the same parts — which is the whole argument of
the talk. This brief asks for the **blocks** those compositions are assembled from.

**You already built the primitives.** These blocks are made *out of* them. Do not
restyle, fork, or reinvent anything in `components/core/` or `components/layout/` —
import and compose.

| Existing | Use it for |
|---|---|
| `DisplayHeading` | every block title |
| `Eyebrow` | the acid micro-label at the top of a block |
| `SectionHead` | block headers with the 2px acid rule |
| `Button`, `TextLink` | any action or navigation |
| `StatRow` | timings, yields, counts inside recipe blocks |
| `FigureWell` | every photograph, without exception |
| `IndexTable` | the row/column pattern `ComparisonTable` extends |
| `PrimerCard` | the card pattern `SkillPrimer` extends |
| `SignalBand` | **the reasoning sentence** — see below |
| `Masthead` | ships as-is, becomes `SiteChrome` |

Tokens, type scale, spacing and the anti-brief are unchanged and already correct.
Nothing in this brief overrides them.

---

## Three rules that make these drop into the app

1. **Export name must match exactly.** `TechniqueThread`, not
   `TechniqueThreadBlock`. The name is how the model refers to the component, so a
   rename breaks composition rather than just renaming a file.
2. **Blocks receive resolved values, never ids.** The model returns
   `recipeId: "r07"`; the app looks it up and passes a whole `Recipe`. No block
   fetches, awaits, or knows a model exists. Pure presentational functions.
3. **Every block takes `treatment`.** `"full" | "collapsed" | "oneline"` — same
   content, three densities. Absence is handled by the app, so no block needs an
   "absent" state.

```ts
type Recipe = {
  id: string
  title: string
  technique: string[]        // ["weighted-sear", "emulsion"]
  allergens: string[]        // ["dairy", "tree-nut"]
  yield: number
  activeTime: number         // minutes
  totalTime: number          // minutes
  image: { src: string; alt: string }
  forkPoint?: string         // where the method splits
  makeAhead?: string         // the step you can do the day before
  season?: string
}

type Treatment = "full" | "collapsed" | "oneline"
```

### What the three treatments mean here

Because the page is a composition, density is how the system says *how much this
matters right now*. Get this right and the argument reads visually.

- **`full`** — image, display title, body, stat row. The block owns its space.
- **`collapsed`** — no image, title at row scale (Archivo `wdth` 74 / 19px), one
  line of mono meta. Roughly an `IndexTable` row.
- **`oneline`** — a single mono sentence with an acid marker. No title, no
  chrome, no image.

**Images only appear at `full`.** This is deliberate: a page where every block
carries a photograph loses the structural contrast the demo depends on. Assume at
most two `full` image blocks on any page.

---

## What to build

Priority order. **P0 is on stage** — if you build nothing else, build these.
`TechniqueThread` and `ComparisonTable` carry the demo.

### P0 — the twelve

| Component | What it is for | Props |
|---|---|---|
| **`TechniqueThread`** ★ | The sequence of attempts at one technique, in order, with what changed each time and the one variable not yet tried. A recipe site's home page with **no recipes above the fold** — that is the point, so it must look intentional rather than empty. | `title: string`, `entries: { recipe: Recipe; date: string; changed: string }[]`, `untried: string`, `treatment` |
| **`ComparisonTable`** ★ | 3–5 dishes compared on axes chosen for this household. The axes are the point — they are not a filter UI's columns. Extends `IndexTable`. | `title: string`, `axes: string[]`, `rows: { recipe: Recipe; values: string[] }[]`, `treatment` |
| **`AllergenNotice`** | The obligation. Different in kind — see its own section below. | `allergen: string`, `recipeTitle: string` |
| `RecipeCard` | A single dish presented for selection. The workhorse; must be excellent at all three treatments. | `recipe: Recipe`, `treatment` |
| `ForkedRecipeCard` | A dish that splits partway to serve two constraints at one table. **The split should be visible in the layout**, not merely described — a rule that forks, two labelled branches. | `recipe: Recipe`, `forkPoint: string`, `branches: [string, string]`, `treatment` |
| `WhyThisWorks` | The principle shared across several dishes. The most editorial thing in the system — closest in register to the principle band. | `principle: string`, `body: string`, `recipes: Recipe[]`, `treatment` |
| `SkillPrimer` | A fundamentals explainer on one technique. Extends `PrimerCard`; add the numbered steps. | `technique: string`, `body: string`, `steps: string[]`, `treatment` |
| `TroubleshootingList` | The ways this dish goes wrong. Symptom → cause → fix, as a three-column dense row. | `items: { symptom: string; cause: string; fix: string }[]`, `treatment` |
| `PrepSchedule` | Sequencing work across days when a base is shared. **The shared base must be visually obvious** — that computation is the whole reason the block exists. Acid marks the shared item. | `days: { day: string; tasks: { text: string; recipeTitle?: string; sharedBase?: boolean }[] }[]`, `treatment` |
| `ShoppingList` | Buying, grouped by store section. Utilitarian — where the mono earns its place. | `sections: { name: string; items: { name: string; qty: string }[] }[]`, `treatment` |
| `PantryMatch` | Starting from what is in the house rather than from a dish. **Show the gap, not just the matches** — missing items are as informative as present ones. | `have: string[]`, `missing: string[]`, `matches: { recipe: Recipe; missingCount: number }[]`, `treatment` |
| `SiteChrome` | Masthead, nav, search. **Invariant — identical position on every composition, always.** Ships from `Masthead`; add search. | — |

### P1 — fills out the default page

`TonightShortlist` (`recipes: Recipe[]`, `treatment`) ·
`MakeAheadCallout` (`step`, `recipeTitle`, `treatment`) ·
`LeftoversNote` (`text`, `recipeTitle`) ·
`FromYourHistory` (`text`, `recipe`) — **oneline only** ·
`SeasonalNote` (`text`) — **oneline only** ·
`StoryIntro` (`body`, `treatment`) ·
`ScalingControl` (`defaultYield`, `householdSize`) — the only interactive block ·
`TechniqueNote` (`technique`, `body`, `treatment`) ·
`SubstitutionTable` (`rows: { wants; have; note }[]`, `treatment`)

### P2 — stub or skip

`RecipeHero`, `IngredientList`, `StepList`. Detail-view only, and the demo never
leaves the home screen.

---

## `AllergenNotice` is not like the others

Every other block is something the system **may** use. This one is something it
**must** use, whenever a dish on the page contains an allergen this household has
recorded. It is placed by code before the model is consulted, and no inference
about the person can suppress it.

- **Full treatment only.** It takes no `treatment` prop.
- **Unmissable without being an alert banner.** Acid rule above and below, set at
  reading size, not shrunk into a badge. It is information, not a warning chip.
- **It must not look like a block that lost an argument.** This is the thing the
  room is shown to prove a composed interface can be safe — it should look as
  considered as everything around it.
- Red is not in the palette and is not being added. Acid carries it.

---

## Two things that changed since the home page

**1. Design for the back of the room, not for a laptop.**
The demo runs as pre-recorded video on a conference screen. The kit's floor —
`paper-dim #8A8E7E` micro-labels at 10px, mono body at 13px on a 1180px canvas —
is comfortable at desk distance and marginal at projection distance. For these
blocks:

- Mono body floor is **15px**, not 13px.
- Micro-labels floor is **11.5px**, not 10px.
- Nothing important is set in `paper-dim`. It is for furniture only — if a
  sentence matters, it is `paper-muted` or brighter.

**2. Photography is in, at `full` only.**
Twelve real photographs, house frame: dark ground, tight crop, single dish, no prop
styling. Always inside `FigureWell`. Never at `collapsed` or `oneline`.

---

## Deliverable

Named exports, one component per file, kebab-case filenames
(`technique-thread.tsx`). Props typed with `type`, destructured in the signature.
Server components — no `"use client"` except `ScalingControl`.

Comps are as useful as code if faster. If comps: `full` and `collapsed` for the P0
set is plenty, and `oneline` can be derived.

Match the existing kit's conventions — `.d.ts` prop contracts and `.prompt.md`
usage notes alongside each component would drop straight into the same structure.
