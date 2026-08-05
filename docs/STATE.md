# Mise — where this is, 5 Aug 2026

**Read this first, from a cold start.** It assumes you know nothing about the
project. It is the state of play, not a spec — the specs live in the vault at
`~/Documents/_Obsidian/brain/meta/plans/`.

---

## What this is

A demo for a 22-minute talk at RenderATL 2026 ("Realtime UIs", UX track). The
argument: **a design system is what earns a model the right to compose an
interface at runtime.** Not a productivity tool — a precondition.

Mise is a fictional recipe site. It has one hand-authored home page and three
households with ninety days of cooking history each. At request time a model
picks which blocks appear on that household's page, in what order, at what depth,
and with which recipes — choosing only from a vocabulary a person defined in
advance, in `lib/manifest/manifest.json`.

The point being proved is not that the pages are good. It is that **the manifest
causes them.** Any single page can be reverse-engineered into an `IF` statement;
a change to the vocabulary propagating across three households without a template
being written cannot. That is why the demo ends on `/stage`, editing the manifest,
rather than on a page.

**It is a proof of concept built in a couple of days**, not a product. Do not
over-engineer it.

### The documents, and which is authoritative

| Document | Authority on |
|---|---|
| **This file** | the live state of the code |
| `~/Documents/_Obsidian/brain/domains/business/renderatl-2026-realtime-uis-talk.md` | the talk as a performance — beats, timings, lines |
| `…/meta/plans/2026-07-26-realtime-ui-demo.md` | the build spec — what the demo must prove and why |
| `…/meta/plans/2026-07-26-demo-design-brief.md` | the visual system and the manifest's contents |
| `…/meta/plans/2026-08-04-mise-implementation-plan.md` | stack and build order |
| `docs/component-direction.md`, `docs/react-handoff.md` | the component catalogue |

Where this file disagrees with a plan about *what the code does*, this file wins.
Where a plan disagrees with this file about *intent*, the plan wins.

**The vault has its own operating rules** (`~/Documents/_Obsidian/brain/CLAUDE.md`)
— notably: never write to `positions/` without approval, and never commit in a
repository other than the vault. Work here is left in the working tree for Brian
to review and commit.

---

## Run it

```bash
pnpm dev --port 3717      # /stage · / · /h/h-learner · /h/h-twin-a · /h/h-twin-b · /kit
```

| Command | What it does |
|---|---|
| `npx tsx --env-file=.env.local scripts/compose.mjs` | compose all three households in the terminal |
| `… scripts/compose.mjs h-twin-a` | one household |
| `… scripts/compose.mjs --dry` | eligibility only, no model calls |
| `… scripts/cost.mjs` | measured token cost of one call of each kind |
| `pnpm bake-off --gateway` | first-pass validity + latency, hosted |
| `pnpm bake-off --local granite4.1:8b qwen3.5:9b` | same, on local models |
| `node scripts/check-content.mjs` | content consistency |
| `pnpm stage:reset` / `stage:after` / `stage:status` | move the manifest between the two recording states |
| `npx tsc --noEmit` | typecheck |

**Work in the harness, not the browser.** Iterating through page renders is a slow
loop with no view of cause and effect, and a day was lost to it. `compose.mjs`
prints the vocabulary offered, what the model chose, whether it validates and what
resolved — three seconds per household. It found every bug worth finding.

`.env.local` holds the gateway key and is gitignored. The key arrives as
`VERCEL_AI_GATEWAY_API_KEY`; `lib/env.ts` normalises it to the name the SDK reads.

---

## Architecture in one pass

**The manifest (`lib/manifest/manifest.json`) is the artifact.** Data, not code,
read from disk on *every request* — never bundled, because the finale is editing
it and watching pages change with no rebuild. 15 components, 1 obligation, 2
assemblies. Each component declares:

- `requires` — a **permission**: a gate the app evaluates against behaviour
- `role: lead | support` — may this block be what a page is *about*?
- `adjacency` — `mustFollow`, `neverWith`, `maxPerPage`
- `treatments` — `hero` / `full` / `collapsed` / `oneline`
- `carriesPhoto` — does it put an image on the page?

Obligations are different in kind: `requiredWhen` is not a choice the model makes.
The app evaluates it and places the block itself.

**Two model calls, deliberately different:**

| Call | Model | When | Why |
|---|---|---|---|
| Profile — *what kind of cook is this?* | Opus 5 | once per household, nightly (frozen to disk here) | the hardest judgment; latency irrelevant |
| Composition — *what should this page be?* | Sonnet 5 | per view, cached | small, structured, latency on screen |

**The pipeline** (`app/h/[household]/page.tsx`): load manifest → resolve state →
evaluate obligations → filter by precondition → compose → complete assemblies →
enforce adjacency → validate → repair once → fall back to the default page →
resolve slots → render. **Eight of the ten stages are code.** That ratio is the
argument.

**The model never emits a fact.** Every value in its output is an id, an enum or a
column heading; the app resolves ids to content. The one exception is `rationale`,
the single sentence of prose it is allowed. So it cannot say anything false about a
dish, because it is not the thing saying anything about a dish.

---

## What works

Four pages plus the stage view. Compositions land valid on the first call, no
repairs, no fallbacks, 3.5–6s each.

| Page | Lead block | Then |
|---|---|---|
| `/` default | RecipeCard @ hero | shortlist, index |
| `/h/h-learner` | **TechniqueThread** | Troubleshooting, TechniqueNote |
| `/h/h-twin-a` | **ForkedRecipeCard** | Shortlist, Comparison |
| `/h/h-twin-b` | **PrepSchedule** | ShoppingList, RecipeCard, MakeAhead |

The learner page has **no recipe on it at all**. The twins declare byte-identical
profiles and share no lead block. Those two facts are most of the demo.

**Profiles are frozen** in `lib/signals/cache/` and committed. In the real system
this is a nightly batch job, so committing yesterday's run is honest — and it stops
the input moving under you mid-iteration.

### `/stage` — the split screen

Manifest left, three composed households right. Edit, save, all three recompose.
Stills in `docs/stills/`.

Laid out to a **fixed 2560×1440 board** (27" Studio Display, 16:9) and scaled to fit
whatever window it is in, so what you see while working is what records. Every size
in `stage-view.tsx` is a constant against that frame.

- The drawer **collapses to a rail, not to zero** (`DRAWER_RAIL_W`) — the cause has
  to stay on screen while the pages change, or the beat is showing outputs again.
- It **edits one top-level manifest section at a time**, spliced back by byte offset
  (`lib/manifest/slice.ts`) — 482 lines cannot be read at projection distance. Every
  byte you did not edit comes back unchanged; the round trip is tested.
- **Writes are validated before they land** (JSON, then schema). A malformed
  manifest on disk takes all three panes down mid-take.
- The **consolidated rail carries the proof numerically** — `obligations 0 → 1` on
  the household that fired. It is the only thing in frame that must be legible from
  the back of the room.
- Telemetry is scraped off the same-origin iframes via `data-k`/`data-v`. The
  composed pages stay pure server components; the only two client components in the
  repo are both in the stage view.

### The compose cache

In-memory `Map` (`lib/compose/cache.ts`), not Next's data cache — Next's would fight
`force-dynamic` and add a concept to explain on stage. **3952ms → 139ms** on a
repeat load. Keyed on manifest hash + household + profile + recipes + eligible
vocabulary + what fired + model label. Only compositions that **passed validation**
are stored; a fallback never is.

> **⚠ Recording: run `MISE_NO_CACHE=1`.** The key includes the manifest hash, so
> `stage:reset` returns the file to a hash that is *already cached* — take 1
> composes for real, take 2 shows `cache hit`. `stage:reset` warns unless the flag
> is set.

### What it costs

`scripts/cost.mjs`, measured, one real call of each kind at list price:

| | Model | When | Tokens | Cost |
|---|---|---|---|---|
| Composition | Sonnet 5 | per view | 4,496 in · 196 out | ~$0.016 |
| Profile | Opus 5 | per user, per night | 5,968 in · 2,218 out | ~$0.085 |

Arranging a page is cheap and caches to nothing. The nightly inference is the one
that scales with user count — it cannot be cached or shared, because being about
exactly one person is its whole purpose. Two-thirds of it is thinking tokens.

### The local-model path

`MISE_PROVIDER=ollama` (default model `qwen3.5:9b`). **Decision: the demo stays on
Sonnet;** local is kept for the dev loop only.

Not for lack of validity — after `StoryIntro` was cut, three local models composed
9/9 valid, same as Sonnet, with *better* worst-case latency. But the validator
cannot see what actually disqualified them: they put a recipe on the learner's page
(killing the absence argument) and wrote reasoning sentences that were flat or
unfair. **Valid was never the same as good.**

The local path deliberately **bypasses the AI SDK** (`lib/compose/ollama.ts`).
Ollama's OpenAI-compatible `/v1` endpoint ignores `think: false`, so a
hybrid-reasoning model spends its whole budget on reasoning and returns empty
content — surfacing as "No object generated", which points nowhere near the cause.
The native `/api/chat` honours `think` and takes a JSON Schema in `format`.

---

## The finding worth keeping

Three unrelated local model families failed at an identical rate (6/9), on the same
household, with the same error. Removing **one** manifest entry took all three to
9/9.

`StoryIntro` could never render (no editorial was ever authored) yet had
`requires: []`, so it was offered to every household, advertised "no recipeIds
needed", and is named like something that goes first. It was bait — and only a
frontier model was expensive enough to ignore it.

**How tight the vocabulary is decides how cheap a model can do the job.** That is
the design system doing the work, and it is the thesis with a number attached.

---

## Open decisions

- **Beat 6's narration does not match what happens.** The spec says the allergen
  notice appears on both households with a recorded allergy. It fires on **Twin A
  only** — Twin B declares the same dairy allergy but composed no dairy dish, so the
  condition never fires. Arguably the better story (the obligation attaches to the
  dish, not the profile), but it is not what is written. Change the narration, or
  give Twin B a dairy dish.
- **`SubstitutionTable` is dead vocabulary**, same class as `StoryIntro`. It treats
  every unmatched ingredient as substitutable, so its gap list is water, salt, pepper
  and bay leaves and the authored substitutions never get a chance. Mark staples
  non-substitutable, or cut it. It has never appeared on a page.
- **The learner page is the only one with no photograph.** Deliberate, but check it
  on a real screen beside the twins. If it reads impoverished rather than austere,
  the answer is the fifth component held in reserve, not an image.
- **Local latency is unsettled.** Side-by-side runs took 21–27s against a 4.2s
  bake-off median an hour earlier. Cold load, `keep_alive` expiry, or memory
  pressure on 18GB — not isolated.
- **Two components are built but out of the vocabulary**: `SeasonalNote`,
  `FromYourHistory`. Both produce orphans on a four-block page.

## If continuing the talk track

1. **The rules-engine baseline** (build spec §8) — fourteen rules, four templates,
   built as a competent team would ship it. Not started; wants a full day. If the
   baseline is obviously bad, the comparison collapses.
2. **Record** (build spec §14) — one clip per beat, under 45s, still final frame,
   `pnpm stage:reset` between takes, `MISE_NO_CACHE=1`.

Neither is load-bearing for the code. **If the next session goes somewhere else
entirely, nothing here needs finishing first.**

---

## Things not to relearn

- **The manifest is read from disk per request** and its hash is in the cache key.
  That is what makes the live edit work. Do not bundle it.
- **Obligations are placed by the app, never the model**, and render *immediately
  above the dish they are about* — not at the top of the page.
- **Adjacency is a rule about units, not members.** A block that must follow
  `PrepSchedule` is satisfied by following the assembly `PrepSchedule` leads. The
  validator and the enforcer share one predicate (`satisfiesMustFollow`) — when they
  held separate copies they fought, and the enforcer looped.
- **Assembly completion can break rules the model never broke** — it can add a fifth
  block to a four-block page, and a completed block must be *constructible*, not just
  named (`ShoppingList` needs two recipes). Both are handled in code.
- **A block that can never render must not be in the vocabulary.** See `StoryIntro`
  above. `SubstitutionTable` is the same problem, still open.
- **Photography is declared (`carriesPhoto`), not inferred from treatment.** Three
  components carry an image. A component that gains one must gain the flag, or the
  density budget silently under-counts.
- **`AllergenNotice` carries no `!` mark.** The design brief sanctions three glyphs
  (`→ · ©`); a fourth doing the job of a warning icon, in a system that bans icon
  sets, was adding emphasis to the most emphatic thing on the page. Do not put it
  back.
- **Anything that is a count is computed from the event log**, never taken from the
  model's self-reported signals.
- **Composition runs with thinking disabled**; the profile call keeps it. That took
  compose from 16.5s to ~4s.
- **The stage view measures pane height from the bottom of the last child**, not
  `scrollHeight` — the iframe is given a tall height to lay out in, and anything
  sized to the viewport reports that height straight back.
- `devIndicators: false` in `next.config.ts` — the Next dev badge sits inside the
  recording frame.
- **Images**: twelve PNG masters (~104MB) are gitignored; optimised JPEGs at
  `public/images/recipes/` are committed. Regenerate with `sips`.
