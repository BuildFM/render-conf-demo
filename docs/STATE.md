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
| `/h/h-twin-b` | **RecipeCard @ hero** ⚠ | ComparisonTable — *see below, this used to be PrepSchedule* |

The learner page has **no recipe on it at all**. The twins declare byte-identical
profiles and share no lead block. Those two facts are most of the demo.

**Profiles are frozen** in `lib/signals/cache/` and committed. In the real system
this is a nightly batch job, so committing yesterday's run is honest — and it stops
the input moving under you mid-iteration.

### What Mise is — the product premise

Set 5 Aug, and it is load-bearing rather than flavour. **Mise is a recipe site whose
actual product is teaching people to cook.** It ships a guided cook mode — one
numbered step on screen at a time, while you cook — and technique material attached
to every dish that you can open or ignore.

That premise is what makes the event log ordinary instead of sinister. The site
knows which step was on screen when someone stopped **because putting one step on
screen is the product**. It knows which technique notes were opened because opening
them is the thing it is trying to get people to do. Nothing is inferred, bought, or
tracked across the web. Say this before the demo and every number afterwards reads
as a site watching its own feature being used; leave it out and the room hears
surveillance. The premise is in the profile prompt verbatim, so the inference is
made in the same frame the audience is given.

### The signals vocabulary

Seven event types, each carrying a `recipeId` and a timestamp. Ranked by **what
they cost the reader**, which is what predicts how much they are worth:

| Tier | Events | Costs them | Truth |
|---|---|---|---|
| Declared | `households.json` | 30 seconds, once | low, decays |
| Ambient | `opened`, `skipped` | nothing | ambiguous alone |
| In-task | `abandoned` + `atStep`, `expanded` + `component` | nothing, but the surface must exist | high |
| **Committal** | **`saved`** | a deliberate act | very high |
| Return | `returned`, repeat `completed` | a second occasion | highest available |

`atStep: 0` is a real state and means they quit on the ingredient list, before the
guided walk-through started — a reaction to the shopping, not the cooking. Twin B
does this 18 times out of 18.

**`saved` was added 5 Aug and is the only committal signal.** What it buys is not
"they liked it" but the CONTRADICTION: `user.savedNeverCooked` is intention on the
record, contradicted by behaviour. The learner saves 8 and has never started 7 of
them. A query reaches "your saved recipes"; it cannot reach "your saved recipes are
a wish list", and that gap is the whole argument for the inference call.

### Recipes have steps, because the model was inventing them

`recipes.json` now carries `steps[]` for all twelve. Not rendered by any block — it
exists so `abandoned atStep 3` can be resolved to a real instruction.

**Before this, the profile pass was told someone quit at step three with no way to
learn what step three was, and it filled the gap in.** The learner's characterization
read "at step three, in the middle of the sear itself" — the step number was real,
the sear was invented. The composition call is locked to ids and enums; the profile
call writes free prose and is not. It is the one place in the system a model can say
something false, and it did. It now quotes the step instead:

> quit early on, at *"Skin down in a hot dry pan, weight on top. Four minutes
> without touching it"*

Every `forkPoint` string names a step number ("At the flip, step 3 of 5"), so
`steps.length` must agree with it. That was asserted when the steps were authored;
re-assert it if you touch either.

### A profile came back empty and cached anyway

The first regeneration returned a learner profile with an empty `salientInference`
and `cookedRecipeIds: []` against a log with four completions. It satisfied the
schema, so it cached, and the page rendered from it — a silent wrong answer rather
than a visible failure, which on a recording day is the worst possible shape.

Fixed in two places: `profileSchema` now requires non-empty strings, and
`getProfile` checks the answer **agrees with the log it was given** (cooked ids
must appear as completions; a log with completions cannot yield none) before
caching, retrying once at a nudged temperature because temperature 0 would
reproduce the same degenerate output. Two failures now throw rather than cache.

### `role: lead` is not actually enforced ⚠

Exposed by the regeneration. Twin B's only eligible lead is still `PrepSchedule`,
and the prompt says "if only one lead is listed, that is the answer" — but the model
returned `RecipeCard @ hero` as blocks[0] and **the validator accepted it**, because
`validate.ts` permits a support block to lead when its treatment is `hero`. That
exception exists so the default page (no household, no eligible leads) can lead with
a recipe; it was never meant to override an eligible lead.

The cost is not abstract: Twin B's page now opens the same way the default page
does, so the twins' contrast is weaker than it was, and "the filtering already
decided" is undercut by the one case where the model overrode the filtering.
**Open decision** — tighten the predicate to "a support block may lead at hero only
when no lead is eligible", which is a composition rule change and recomposes
everything, or accept it.

### `/stage` — the split screen

Manifest left, three composed households right. Edit, save, all three recompose.
Stills in `docs/stills/`.

Laid out to a **fixed 2560×1440 board** (27" Studio Display, 16:9) and scaled to fit
whatever window it is in, so what you see while working is what records. Every size
in `stage-view.tsx` is a constant against that frame.

**The board is positioned by arithmetic, not by `place-items: center`** — fixed
5 Aug. `transform` does not change layout, so the board's layout box stays 2560×1440
however small it is drawn, and a centred item that overflows its grid area gets
clamped to the start edge. The box ran 0→2560, scaling about its own centre parked
it at `left: 560` on a 1440-wide window, and two fifths of the frame was cut off
under `overflow: hidden`. It looked correct at 2560 CSS px and nowhere else, which
is why it was never noticed on the display it was built on. Origin is now top left
with an explicit centred offset; measured whole and unclipped at 2560×1440,
1728×1000, 1440×820 and 1280×700.

**A laptop gets a correct small replica, not a second layout.** Everything scales
together, so a 1440-wide window draws the board at 0.56 and the manifest editor
lands around 12px — workable, and the pages are legible enough to see the shapes
differ. Below roughly 1280×700 the editor drops under 11px and it becomes a preview
rather than somewhere to work.

- **A `PAGES | DATA` switch above the panes** shows the households' data (⌘D) — see below. ⌘S saves, ⌘\ collapses.
- The drawer **collapses to a rail, not to zero** (`DRAWER_RAIL_W`) — the cause has
  to stay on screen while the pages change, or the beat is showing outputs again.
- It **edits one top-level manifest section at a time**, spliced back by byte offset
  (`lib/manifest/slice.ts`) — 482 lines cannot be read at projection distance. Every
  byte you did not edit comes back unchanged; the round trip is tested.
- **The tabs are declared, not derived from the file's keys** (`TABS` in
  `stage-view.tsx`). Six derived tabs wrapped to two lines, and two of them —
  `invariants`, `density` — are words the talk never teaches; `invariants` reads as
  "variation" at a glance. Now four: **blocks · obligations · assemblies · limits**.
  `obligations` and `assemblies` keep their names because beat 3 spends five minutes
  teaching them and the demo should pay that off. `limits` holds *two* sections,
  `density` and `invariants`, each with its own editor and its own splice — the save
  loop writes them sequentially, because each PUT reads the whole file. `version`
  moved to the header beside the hash.
- **`blocks` renders the vocabulary as a list, not as JSON**, with `raw` one click
  away. `components` is 350 of the manifest's 470 lines; as raw text it was a wall,
  and a wall the room cannot read is the same as no cause on screen — the failure
  the split screen exists to fix. Each row is a name, its `role`, its `requires` as
  conditions, and `mustFollow`/`neverWith` where declared. `maxPerPage` is left out:
  every component declares one, so it distinguishes none of them. Fourteen of the
  fifteen are in frame at once, and the four leads are the only rows in acid.
- **Save with nothing edited is deliberate.** It rewrites the same bytes — the hash
  does not move — but it is the only way to re-trigger three compositions without
  touching the manifest, and a take sometimes needs exactly that.
- **Writes are validated before they land** (JSON, then schema). A malformed
  manifest on disk takes all three panes down mid-take.
- The **consolidated rail carries the proof numerically** — `obligations 0 → 1` on
  the household that fired. It is the only thing in frame that must be legible from
  the back of the room.
- **`density` is on the rail as well, as `chosen/maxBlocks`** — added 5 Aug because
  editing `maxBlocks` moved nothing in frame and read as the manifest being ignored.
  It is not ignored: `maxBlocks` is read by the prompt (`compose.ts`), the validator
  (`validate.ts`) and the assembly-overflow trimmer (`gates.ts`). But see below —
  raising it is close to a no-op, so the second number moving on save is the only
  visible confirmation the edit landed. `blocks` stays `rendered/chosen`, which is a
  different question and catches a block that was named but could not be built.
- Telemetry is scraped off the same-origin iframes via `data-k`/`data-v`. The
  composed pages stay pure server components; the only two client components in the
  repo are both in the stage view.

### ⌘D — the other cause

Added 5 Aug. The split screen showed the manifest, which is the cause all three
pages **share**, and never showed the cause that **differs**. Three pages made by
one vocabulary out of three people, with the people off screen, is an argument
with a term missing — the room had to take on trust that the input varied at all.

A **`PAGES | DATA`switch above the panes** swaps the three columns from the composed
pages to the data that made them. Same three columns, input instead of output,
manifest still in frame. ⌘D does the same thing and the shortcut is printed on the
face of the switch — this shipped as a keystroke with nothing on screen saying it
existed, which meant it may as well not have been there. The iframes stay
mounted underneath (`display: none`) — unmounting them would throw away three live
compositions and coming back would cost a model call each.

Three groups, in the order the argument runs:

| Group | Where it comes from | What it decides |
|---|---|---|
| **What they told us** | `households.json`, declared at signup | nothing on its own |
| **What they did** | `computeFacts`, evaluated in **code** | which components are *allowed* — the `vocabulary n/15` on the rail |
| **What the model is told** | `householdContext()`, **verbatim** | how the allowed blocks are *arranged* |

**The middle group never reaches the model.** That is the part worth saying out
loud: the facts that gate the vocabulary are evaluated in code, and the model is
handed a pre-filtered menu it cannot argue with. A personalization engine has one
of these three panels. This has all three, and the model is on the weaker side of
the split.

**The twins are the payoff and it is now visible rather than asserted.** Their
declared blocks are byte-identical — *and so are their pantries* — while `cooked
of comparable` reads 10 against 4, `has rhythm` no against yes, `make ahead
pattern` no against yes. Two people who filled in the same form, read oppositely,
because the system is reading behaviour. Say that over this panel and the
"isn't this just personalization?" question from beat 2 dies here rather than
being argued with.

**Risk to hold in mind:** a per-user data panel can read as "here's the CRM
record", which makes it look *more* like personalization. The framing carries it —
lead with the identical declared block, then reveal the divergent derived facts.
Never introduce it as "the user profile".

Implementation notes: `/api/context` returns all three at once and is fetched on
the first ⌘D, not on mount — doing it on mount would run three profile loads
before the pages have composed, and composition is what the clock in frame is
timing. `test()` is exported from `gates.ts` and `householdContext()` from
`compose.ts`, so the panel evaluates conditions and renders the prompt slice with
**the same code the pipeline uses**. A display copy of either would eventually
disagree with the real one, and the display would be the lie. Only `user.*` facts
are shown; `content.*` is the recipe library and `state.*` is the session, and
neither differs between the three columns.

### The copy rule — labels are direct, prose is not

Set 5 Aug, after the composed pages read as different but not as *legible*. Two
kinds of text are on these pages and they get opposite treatment:

- **A label naming what a block is** must decode in one second, from the back of a
  room, over the top of someone talking. Plain English, no metaphor. These carry
  the argument, because the argument is that the three pages are made of different
  blocks.
- **Editorial prose** — recipe titles, the technique note, troubleshooting text,
  the rationale sentence — keeps its voice. It is authored, the model never writes
  it, and it is what stops the pages reading as generated filler.

The learner page shows the rule working: `YOU HAVEN'T TRIED THIS YET` over
`STARTING THE PAN COLD`, and `WHAT THESE 4 DISHES HAVE IN COMMON` over `CONTACT IS
THE WHOLE JOB`. The label says what it is; the prose underneath keeps the voice.
Before, the prose was doing both jobs and did neither.

What changed: `Recorded for this household` → **`Allergy warning`** (the obligation
never named the thing it warned about, and it is the last block the room sees);
`Fork · step 4 of 6` → `Splits here`; `Branch A` → `Option A`; `Your thread` →
`Every time you've tried…`; `Why these 4 work` → `What these 4 dishes have in
common`; `Compared for your kitchen` → `Compared side by side`; `Axes chosen for
your kitchen` → `Columns chosen for you`; `Shared base` → `Used again later this
week`; `Primer` → `How to do it`; `Shortfall` → `Still need`; `In the house` →
`What you have`; `Larder` → `Pantry`.

**None of this is in the compose cache key**, and none of it is text the model
reads — the model reads the manifest's `intent` strings. So it is the one class of
change that needs no recomposition and no re-verifying that the learner still has
no recipe. Safe to do the night before recording.

**These labels are unreadable in the split screen** — an eyebrow renders about 5px
at three-up scale, where the room is watching page shapes. This work pays off in
the single-page beats and on the `/h/…` pages opened in a new tab.

**The one label the model writes is now constrained too.** `ComparisonTable`'s
column heads come from `axes`, a free `z.array(z.string())` — the only words the
model authors that land on a finished page. It was producing `THE SPLIT ITSELF`,
which meant every label on the twins' page could be read cold except that one.
Both the schema `.describe()` and a prompt rule now demand a one-to-three-word
heading naming what the column measures. Measured over three runs: Twin A gives
`Where it splits · Active time · Total time` every time, Twin B `Technique ·
Active time · Where it splits`. All valid, no repairs, no fallbacks; leads
unchanged, the learner still has no recipe, the twins still diverge.

Nav also reads `HOME · PREP · PANTRY · TECHNIQUE · INDEX` — `Fire` was brand
doing a wayfinding label's job.

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
- **Raising `maxBlocks` is close to a no-op — the prompt overrides it.** Measured
  5 Aug: at `maxBlocks: 8` the three households composed 3, 4 and 4 blocks, the same
  as at 4. `compose.ts` interpolates the cap and then, in four hardcoded sentences
  underneath, asks for three or four blocks anyway — "Add two or three SUPPORT
  blocks", "Three blocks that agree beat four that do not", "let the remaining two
  or three support it", "A page where four blocks are equally important is a page
  with nothing to say", plus "Fewer is better". The manifest sets a ceiling; the
  prose sets the actual count. So density **bites when lowered and frees when
  raised** — try `2` for a live density beat, not `8`. Deliberately left as it is:
  deriving those sentences from `maxBlocks` recomposes all three pages, and the
  learner's recipe-free page and the twins' divergence are what the demo rests on.
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
- **The compose cache key does not include the prompt.** It is manifest hash +
  household + profile + recipes + eligible vocabulary + what fired + model label. So
  editing `compose.ts` and reloading a page serves the OLD composition and the rail
  says `cache hit` — the change looks like it did nothing. Verify prompt changes in
  `compose.mjs`, which never touches the cache, or restart with `MISE_NO_CACHE=1`.
- **`compose.mjs` prints `axes`**, because they are the only words the model writes
  that reach the finished page. A column head reading "The split itself" survived
  until someone opened a browser, which is exactly the loop the harness exists to
  replace. Anything the model authors has to be visible there.
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
