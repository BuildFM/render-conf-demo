# Where this is — 4 Aug 2026, end of day

Read this first. It is the state of play, not a spec — the specs live in the vault
at `~/Documents/_Obsidian/brain/meta/plans/`.

---

## Run it

```bash
pnpm dev --port 3717            # /  ·  /h/h-learner  ·  /h/h-twin-a  ·  /h/h-twin-b  ·  /kit

npx tsx --env-file=.env.local scripts/compose.mjs         # compose all, no browser
npx tsx --env-file=.env.local scripts/compose.mjs --dry    # eligibility only, no model calls
npx tsx --env-file=.env.local scripts/compose.mjs h-twin-a # one household
node scripts/check-content.mjs                             # content consistency
npx tsc --noEmit                                           # typecheck
```

**Work in the harness, not the browser.** Iterating through page renders is a slow
loop with no view of cause and effect, and a day was lost to it. The harness prints
the vocabulary offered, what the model chose, whether it validates, and what
resolved — three seconds per household.

`.env.local` holds the gateway key. It is gitignored. The key arrived under
`VERCEL_AI_GATEWAY_API_KEY`; `lib/env.ts` normalises it to the name the SDK reads.

---

## What works

Four pages, all valid, no fallbacks, 3–6s per composition.

| Page | Lead block | Then | Reasoning sentence |
|---|---|---|---|
| `/` default | RecipeCard @ hero | shortlist, index | "The best home page we can make for everyone." |
| `/h/h-learner` | **TechniqueThread** | Troubleshooting, TechniqueNote | "You finish what presses flat in a pan; cacio e pepe just waits." |
| `/h/h-twin-a` | **ForkedRecipeCard** | Shortlist, Comparison | "You commit when a dish still leaves you something to decide." |
| `/h/h-twin-b` | **PrepSchedule** | ShoppingList, RecipeCard, MakeAhead | "You already braise and press weekly — the gap was never the technique." |

The learner page has **no recipe on it**. The twins declare byte-identical profiles
and share no lead block.

**The pipeline**, in `app/h/[household]/page.tsx`: load manifest → resolve state →
evaluate obligations → filter by precondition → compose → complete assemblies →
validate → repair once → fall back to the default page → resolve slots → render.
Seven of the nine stages are code.

**Profiles are frozen** in `lib/signals/cache/` and committed. They are good, and
regenerating them mid-iteration moved the input twice. In the real system this is a
nightly batch job, so committing yesterday's run is honest.

---

## The two things that made composition work

Both are in the manifest, and both are better talk material than what they replaced.

**1. `role: lead | support`.** Some blocks can be what a page is *about*; the rest
can only support one. A comparison table is useful on a page about choosing and is
never the reason for the page. `blocks[0]` must be a lead — or a support block at
`hero`, which is how the hand-authored default page leads with a dish.

**2. Preconditions that actually discriminate.** Fifteen of sixteen components used
to be eligible for everyone, because the gates asked content questions ("are there
three comparable dishes") that are true for all households. The filter was
decoration and the model chose generically. The gates now key on behaviour —
`cooksForkingDishes`, `abandonsOnListLength`, `hasRhythm`, `expandsTechnique` —
leaving **exactly one eligible lead per household**.

The household's own history narrows the vocabulary to nearly one answer, and the
design system's rules do the narrowing. That is a better sentence for the stage than
anything about the model being clever.

---

## Next, in order

1. **The split-screen manifest view.** Agreed and not started. Manifest on the left,
   composed pages on the right; edit the manifest and the pages change. This is the
   spine of the demo, not its finale — it is the only thing here a personalization
   engine cannot do, and it currently exists as a claim rather than a screen.
2. **The rules-engine baseline** (build spec §8). Fourteen rules, four templates,
   built properly. Not started.
3. **Record** (build spec §14). One clip per beat, under 45s, still final frame.

---

## Open

- **`SubstitutionTable` never resolves** — no substitution authored for the specific
  pantry gaps the twins produce. Small content gap in `editorial.json`.
- **Repair rate.** Turning off extended thinking took composition from 16.5s to
  ~4s, but the model now needs a repair pass more often. Twin B has taken two calls
  on some runs, which is 6–14s. Worth watching before "fast and cheap" is said on
  stage.
- **Five components are built and not in the vocabulary**: `SeasonalNote`,
  `FromYourHistory`, and previously `TonightShortlist`/`StoryIntro`/`LeftoversNote`
  were considered for removal. Only the first two are out. All produce orphans on a
  four-block page — a line about a dish that appears nowhere else.
- **Images**: twelve PNG masters (~104MB) are gitignored; optimised JPEGs at
  `public/images/recipes/` are committed. Regenerate with `sips` if the masters move.

---

## Things not to relearn

- The manifest is read from disk per request and its hash is in the cache key. That
  is what makes the live edit work. Do not bundle it.
- Obligations are placed by the app, never by the model, and they render
  **immediately above the dish they are about** — not at the top of the page.
- Assemblies are completed in code, checked against adjacency first, and the
  completion must run on the repair output too or a retry reintroduces the split.
- `expandsTechnique` and anything else that is a count is computed from the event
  log, not taken from the model's self-reported signals.
- Composition runs with extended thinking **disabled**; the profile call keeps it.
